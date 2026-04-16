/**
 * Render Routes
 * Handles video rendering operations
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateDomain, jobs } = require('../utils/state');

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

    // ========== Step 1: Generate voiceover ==========
    // Only generate when ElevenLabs is configured and audio files don't exist
    if (isElevenLabsConfigured()) {
      jobs.set(jobId, { ...jobs.get(jobId), message: 'Generating voiceovers...', progress: 5 });
      console.log(`[${jobId}] Starting voiceover generation for ${scenes.length} scenes...`);

      let voiceoverProgress = 0;
      const totalScenes = scenes.length;
      const progressPerScene = 10 / totalScenes; // Voiceover generation takes 5-15% of progress

      // Iterate all scenes, generate voiceover for each
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneLabel = scene.id || `scene${i}`;

        // Generate main voiceover (scene primary text)
        if (scene.text) {
          // Determine audio filename
          const audioFile = scene.audioFile || (scene.id === 'intro' ? 'intro.mp3' :
                            scene.id === 'outro' ? 'outro.mp3' : `scene${i}-main.mp3`);
          const audioPath = path.join(publicDir, audioFile);

          // Check if voiceover file already exists, avoid regenerating
          if (!fs.existsSync(audioPath)) {
            console.log(`   [${jobId}] Generating ${audioFile}...`);
            const success = await generateSpeech(scene.text, audioPath);
            if (success) {
              console.log(`   [${jobId}] Generated: ${audioFile}`);
            } else {
              console.log(`   [${jobId}] Failed to generate: ${audioFile}`);
            }
          } else {
            console.log(`   [${jobId}] Audio already exists: ${audioFile}`);
          }
        }

        // Generate sub voiceover (scene secondary text, for two-phase animation)
        if (scene.subText) {
          const audioFileSub = scene.audioFileSub || `scene${i}-sub.mp3`;
          const audioPathSub = path.join(publicDir, audioFileSub);

          if (!fs.existsSync(audioPathSub)) {
            console.log(`   [${jobId}] Generating ${audioFileSub}...`);
            const success = await generateSpeech(scene.subText, audioPathSub);
            if (success) {
              console.log(`   [${jobId}] Generated: ${audioFileSub}`);
            } else {
              console.log(`   [${jobId}] Failed to generate: ${audioFileSub}`);
            }
          } else {
            console.log(`   [${jobId}] Audio already exists: ${audioFileSub}`);
          }
        }

        // Update voiceover generation progress
        voiceoverProgress++;
        const progress = Math.round(5 + (voiceoverProgress / totalScenes) * 10);
        jobs.set(jobId, {
          ...jobs.get(jobId),
          message: `Generating voiceovers (${voiceoverProgress}/${totalScenes})...`,
          progress
        });
      }

      console.log(`[${jobId}] Voiceover generation completed.`);
    } else {
      console.log(`[${jobId}] ElevenLabs not configured, skipping voiceover generation.`);
    }

    // Update status: prepare to copy files
    jobs.set(jobId, { ...jobs.get(jobId), message: 'Copying files...', progress: 15 });

    // ========== Step 2: Copy timeline.json to global public directory ==========
    // Remotion reads configuration from global public directory
    const globalTimelinePath = path.join(globalPublicDir, 'timeline.json');
    fs.copyFileSync(timelinePath, globalTimelinePath);

    // ========== Step 3: Copy screenshot files to global public directory ==========
    const screenshotFiles = fs.readdirSync(publicDir).filter(f => f.startsWith('shot') && f.endsWith('.png'));
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
    const compositionId = aspectRatio === 'portrait' ? 'ClickCastPromo-Portrait' : 'ClickCastPromo-Landscape';
    const outputFile = path.join(outDir, `${aspectRatio}.mp4`);

    await new Promise((resolve, reject) => {
      // Use spawn to start Remotion CLI render process
      const remotionProcess = spawn('npx', [
        'remotion',
        'render',
        compositionId,
        outputFile,
        '--concurrency=1',  // Single-threaded render, avoid resource contention
        '--gl=angle'        // Use ANGLE graphics library, improve Windows compatibility
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

module.exports = router;
