/**
 * Render Routes
 * Handles video rendering operations
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateDomain, jobs } = require('../utils/state');
const { getAudioDuration } = require('../utils/audio');

// ElevenLabs TTS
const { generateSpeech, isElevenLabsConfigured } = require('../../lib/elevenlabs-tts.js');

const router = express.Router();

/**
 * Render video endpoint
 * @route POST /api/websites/:domain/render
 * @param {string} domain - Website domain (URL parameter)
 * @body {string} [aspectRatio='landscape'] - Video ratio ('landscape' or 'portrait')
 * @returns {Object} { jobId } Returns job ID for querying render status
 * @returns {Object} { error: string } on error
 * @throws {400} Invalid domain or timeline.json not found
 * @description
 *   Rendering process executes asynchronously with these steps:
 *   1. Generate voiceover (if ElevenLabs is configured)
 *   2. Copy resource files to global public directory
 *   3. Call Remotion to execute video render
 */
router.post('/:domain/render', async (req, res) => {
  const { domain } = req.params;
  const { aspectRatio = 'landscape' } = req.body;

  // Validate domain format
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const websiteDir = path.join(__dirname, '../../websites', domain);
  const publicDir = path.join(websiteDir, 'public');
  const outDir = path.join(websiteDir, 'out');
  const globalPublicDir = path.join(__dirname, '../../public');

  // Check if timeline.json exists (required for rendering)
  const timelinePath = path.join(publicDir, 'timeline.json');
  if (!fs.existsSync(timelinePath)) {
    return res.status(400).json({ error: 'timeline.json not found' });
  }

  // Create output directory
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Generate unique job ID
  const jobId = `${domain}-${Date.now()}`;

  // Initialize job status
  jobs.set(jobId, {
    status: 'pending',
    progress: 0,
    message: 'Preparing...',
    domain,
    aspectRatio,
    createdAt: Date.now()
  });

  // Execute rendering asynchronously (non-blocking)
  renderVideoAsync(jobId, domain, aspectRatio, {
    websiteDir,
    publicDir,
    outDir,
    globalPublicDir,
    timelinePath
  });

  // Return job ID immediately
  res.json({ jobId });
});

/**
 * Core async video rendering function
 * @async
 * @param {string} jobId - Unique job identifier
 * @param {string} domain - Website domain
 * @param {string} aspectRatio - Video ratio ('landscape' or 'portrait')
 * @param {Object} paths - Path configuration object
 * @param {string} paths.websiteDir - Website root directory
 * @param {string} paths.publicDir - Website public directory
 * @param {string} paths.outDir - Output directory
 * @param {string} paths.globalPublicDir - Global public directory
 * @param {string} paths.timelinePath - timeline.json file path
 * @returns {Promise<void>}
 * @description
 *   Complete rendering process:
 *   1. Read timeline.json configuration
 *   2. Generate voiceover files (main and sub)
 *   3. Copy resource files to global directory
 *   4. Call Remotion CLI to execute render
 *   5. Update job status
 */
async function renderVideoAsync(jobId, domain, aspectRatio, paths) {
  const { websiteDir, publicDir, outDir, globalPublicDir, timelinePath } = paths;

  try {
    // Update status: start reading configuration
    jobs.set(jobId, { ...jobs.get(jobId), status: 'rendering', message: 'Reading timeline...', progress: 2 });

    // Read timeline.json configuration
    const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    const scenes = timeline.scenes || [];

    let timelineUpdated = false;

    // ========== Step 0: Normalize audio filenames ==========
    // 修复混合格式如 preview_scene0-main.mp3 → preview_scene0.mp3
    // 确保文件名引用与实际文件一致
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      if (scene.audioFile) {
        const normalized = normalizeAudioFilename(scene.audioFile, scene.id || `scene${i}`, 'main');
        if (normalized !== scene.audioFile) {
          console.log(`   [${jobId}] Normalized audioFile: ${scene.audioFile} → ${normalized}`);
          scene.audioFile = normalized;
          timelineUpdated = true;
        }

        if (!fs.existsSync(path.join(publicDir, scene.audioFile))) {
          const fallback = findAudioFallback(scene.audioFile, scene.id || `scene${i}`, 'main', publicDir);
          if (fallback) {
            console.log(`   [${jobId}] Audio fallback: ${scene.audioFile} not found, using ${fallback}`);
            scene.audioFile = fallback;
            timelineUpdated = true;
          }
        }
      }

      if (scene.audioFileSub) {
        const normalized = normalizeAudioFilename(scene.audioFileSub, scene.id || `scene${i}`, 'sub');
        if (normalized !== scene.audioFileSub) {
          console.log(`   [${jobId}] Normalized audioFileSub: ${scene.audioFileSub} → ${normalized}`);
          scene.audioFileSub = normalized;
          timelineUpdated = true;
        }

        if (!fs.existsSync(path.join(publicDir, scene.audioFileSub))) {
          const fallback = findAudioFallback(scene.audioFileSub, scene.id || `scene${i}`, 'sub', publicDir);
          if (fallback) {
            console.log(`   [${jobId}] Audio sub fallback: ${scene.audioFileSub} not found, using ${fallback}`);
            scene.audioFileSub = fallback;
            timelineUpdated = true;
          }
        }
      }
    }

    // ========== Step 1: Verify voiceovers and sync durations ==========
    if (isElevenLabsConfigured()) {
      jobs.set(jobId, { ...jobs.get(jobId), message: 'Verifying voiceovers...', progress: 5 });
      console.log(`[${jobId}] Verifying voiceovers for ${scenes.length} scenes...`);

      let voiceoverProgress = 0;
      const totalScenes = scenes.length;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneLabel = scene.id || `scene${i}`;

        if (scene.audioFile) {
          const audioPath = path.join(publicDir, scene.audioFile);

          if (!fs.existsSync(audioPath)) {
            const mainText = scene.mainTitle || '';
            if (mainText) {
              console.log(`   [${jobId}] Audio missing, generating: ${scene.audioFile}...`);
              const success = await generateSpeech(mainText, audioPath);
              if (success) {
                scene.voiceoverSource = 'elevenlabs';
                timelineUpdated = true;
                console.log(`   [${jobId}] Generated: ${scene.audioFile}`);
              }
            } else {
              console.log(`   [${jobId}] Audio missing and no text: ${scene.audioFile}`);
            }
          }

          if (fs.existsSync(audioPath)) {
            const actualDuration = getAudioDuration(audioPath);
            if (actualDuration > 0 && Math.abs((scene.mainDuration || 0) - actualDuration) > 0.5) {
              console.log(`   [${jobId}] Synced mainDuration: ${actualDuration.toFixed(2)}s (was ${(scene.mainDuration || 0).toFixed(2)}s)`);
              scene.mainDuration = actualDuration;
              timelineUpdated = true;
            }
            if (!scene.voiceoverSource) {
              scene.voiceoverSource = 'elevenlabs';
              timelineUpdated = true;
            }
          }
        }

        if (scene.audioFileSub) {
          const audioSubPath = path.join(publicDir, scene.audioFileSub);

          if (!fs.existsSync(audioSubPath)) {
            const subText = scene.subVoiceover || '';
            if (subText) {
              console.log(`   [${jobId}] Sub audio missing, generating: ${scene.audioFileSub}...`);
              const success = await generateSpeech(subText, audioSubPath);
              if (success) {
                scene.subVoiceoverSource = 'elevenlabs';
                timelineUpdated = true;
                console.log(`   [${jobId}] Generated: ${scene.audioFileSub}`);
              }
            }
          }

          if (fs.existsSync(audioSubPath)) {
            const actualDuration = getAudioDuration(audioSubPath);
            if (actualDuration > 0 && Math.abs((scene.subDuration || 0) - actualDuration) > 0.5) {
              console.log(`   [${jobId}] Synced subDuration: ${actualDuration.toFixed(2)}s (was ${(scene.subDuration || 0).toFixed(2)}s)`);
              scene.subDuration = actualDuration;
              timelineUpdated = true;
            }
            if (!scene.subVoiceoverSource) {
              scene.subVoiceoverSource = 'elevenlabs';
              timelineUpdated = true;
            }
          }
        }

        voiceoverProgress++;
        const progress = Math.round(5 + (voiceoverProgress / totalScenes) * 10);
        jobs.set(jobId, {
          ...jobs.get(jobId),
          message: `Verifying voiceovers (${voiceoverProgress}/${totalScenes})...`,
          progress
        });
      }

      if (timelineUpdated) {
        console.log(`[${jobId}] Recalculating timeline...`);
        let currentFrame = 0;
        for (const s of scenes) {
          s.startFrame = currentFrame;
          if (s.audioFileSub && s.subDuration > 0) {
            const mainDur = s.mainDuration || 0;
            const subDur = s.subDuration;
            const transDur = s.transitionDuration || 0.5;
            s.durationInFrames = Math.ceil((mainDur + transDur + subDur + 0.5) * (timeline.fps || 30));
          } else if (s.mainDuration > 0) {
            s.durationInFrames = Math.ceil((s.mainDuration + 0.5) * (timeline.fps || 30));
          }
          currentFrame += s.durationInFrames;
        }
        timeline.totalFrames = currentFrame;

        fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
        console.log(`[${jobId}] Timeline updated and saved. Total frames: ${timeline.totalFrames}`);
      }

      console.log(`[${jobId}] Voiceover verification completed.`);
    } else {
      console.log(`[${jobId}] ElevenLabs not configured, skipping voiceover verification.`);
    }

    // Update status: prepare to copy files
    jobs.set(jobId, { ...jobs.get(jobId), message: 'Copying files...', progress: 15 });

    // ========== Step 2: Copy timeline.json to global public directory ==========
    // Remotion reads configuration from global public directory
    const globalTimelinePath = path.join(globalPublicDir, 'timeline.json');
    fs.copyFileSync(timelinePath, globalTimelinePath);

    // ========== Step 3: Copy screenshot files to global public directory ==========
    const screenshotFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.png'));
    for (const file of screenshotFiles) {
      const src = path.join(publicDir, file);
      const dest = path.join(globalPublicDir, file);
      fs.copyFileSync(src, dest);
    }

    // ========== Step 4: Copy audio files to global public directory ==========
    const audioFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.mp3'));
    for (const file of audioFiles) {
      const src = path.join(publicDir, file);
      const dest = path.join(globalPublicDir, file);
      fs.copyFileSync(src, dest);
    }

    // Update status: start Remotion render
    jobs.set(jobId, { ...jobs.get(jobId), message: 'Starting Remotion render...', progress: 20 });

    // ========== Step 5: Execute Remotion render ==========
    // Select corresponding Composition ID based on ratio
    const compositionId = aspectRatio === 'portrait' ? 'VidGenPromo-Portrait' : 'VidGenPromo-Landscape';
    const outputFile = path.join(outDir, `${aspectRatio}.mp4`);

    await new Promise((resolve, reject) => {
      // Use spawn to start Remotion CLI render process
      // Calculate optimal concurrency based on CPU cores (leave 2 for system)
      const os = require('os');
      const cpuCores = os.cpus().length;
      const concurrency = Math.max(1, Math.min(cpuCores - 2, 6));

      const remotionProcess = spawn('npx', [
        'remotion',
        'render',
        compositionId,
        outputFile,
        `--concurrency=${concurrency}`,
        '--gl=swiftshader'     // Software rendering, more stable than angle
      ], {
        cwd: path.join(__dirname, '../..'),
        shell: true,
        env: { ...process.env, NODE_ENV: 'production' }
      });

      let lastProgress = 20;

      // Listen to stdout, parse render progress
      remotionProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Remotion ${jobId}] ${output}`);

        // Parse progress (Remotion output format: "Rendering frame 100/300")
        const frameMatch = output.match(/Rendering frame (\d+)\/(\d+)/);
        if (frameMatch) {
          const current = parseInt(frameMatch[1]);
          const total = parseInt(frameMatch[2]);
          // Render progress takes 20-95%
          const progress = Math.round(20 + (current / total) * 75);
          if (progress > lastProgress) {
            lastProgress = progress;
            jobs.set(jobId, {
              ...jobs.get(jobId),
              progress,
              message: `Rendering frame ${current}/${total}...`
            });
          }
        }
      });

      // Listen to stderr
      remotionProcess.stderr.on('data', (data) => {
        console.error(`[Remotion Error ${jobId}] ${data.toString()}`);
      });

      // Listen to process exit
      remotionProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Remotion exited with code ${code}`));
        }
      });

      // Listen to process error
      remotionProcess.on('error', (err) => {
        reject(err);
      });
    });

    // ========== Step 6: Render success ==========
    jobs.set(jobId, {
      ...jobs.get(jobId),
      status: 'completed',
      progress: 100,
      message: 'Render completed!',
      videoUrl: `/websites/${domain}/out/${aspectRatio}.mp4`,
      aspectRatio
    });

    console.log(`Render completed: ${jobId}`);

  } catch (error) {
    // Render failed, update status
    console.error(`Render failed: ${jobId}`, error);
    jobs.set(jobId, {
      ...jobs.get(jobId),
      status: 'failed',
      message: error.message || 'Render failed'
    });
  }
}

function normalizeAudioFilename(filename, sceneId, type) {
  if (!filename) return filename;

  const isPreview = filename.startsWith('preview_');
  if (!isPreview) return filename;

  const isIntro = sceneId === 'intro';
  const isOutro = sceneId === 'outro';
  const sceneNum = sceneId.startsWith('scene') ? sceneId.replace('scene', '') : null;

  if (isIntro) {
    return type === 'sub' ? 'intro-sub.mp3' : 'intro.mp3';
  } else if (isOutro) {
    return type === 'sub' ? 'outro-sub.mp3' : 'outro.mp3';
  } else if (sceneNum !== null) {
    return type === 'sub' ? `scene${sceneNum}-sub.mp3` : `scene${sceneNum}-main.mp3`;
  }

  return filename;
}

function findAudioFallback(filename, sceneId, type, publicDir) {
  if (!filename) return null;

  const isIntro = sceneId === 'intro';
  const isOutro = sceneId === 'outro';
  const sceneNum = sceneId.startsWith('scene') ? sceneId.replace('scene', '') : null;
  const isPreview = filename.startsWith('preview_');

  let candidates = [];

  if (isIntro) {
    candidates = type === 'sub'
      ? ['intro-sub.mp3', 'preview_intro_sub.mp3']
      : ['intro.mp3', 'preview_intro.mp3'];
  } else if (isOutro) {
    candidates = type === 'sub'
      ? ['outro-sub.mp3', 'preview_outro_sub.mp3']
      : ['outro.mp3', 'preview_outro.mp3'];
  } else if (sceneNum !== null) {
    if (isPreview) {
      candidates = type === 'sub'
        ? [`scene${sceneNum}-sub.mp3`, `preview_scene${sceneNum}_sub.mp3`]
        : [`scene${sceneNum}-main.mp3`, `preview_scene${sceneNum}.mp3`];
    } else {
      candidates = type === 'sub'
        ? [`scene${sceneNum}-sub.mp3`, `preview_scene${sceneNum}_sub.mp3`]
        : [`scene${sceneNum}-main.mp3`, `preview_scene${sceneNum}.mp3`];
    }
  }

  for (const candidate of candidates) {
    if (candidate !== filename && fs.existsSync(path.join(publicDir, candidate))) {
      return candidate;
    }
  }

  return null;
}

module.exports = router;
