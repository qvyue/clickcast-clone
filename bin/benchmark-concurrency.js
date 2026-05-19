/**
 * Remotion Concurrency Benchmark
 * Tests different concurrency values to find the optimal setting for rendering.
 *
 * Uses the same render parameters as production:
 *   --gl=swangle --x264-preset=veryfast --enable-multiprocess-on-linux
 *   NODE_ENV removed from env (prevents Chromium heap corruption)
 *
 * Usage:
 *   node bin/benchmark-concurrency.js [--domain clickcast.tech] [--ratio landscape]
 *
 * Or as a module:
 *   const { runBenchmark } = require('./benchmark-concurrency');
 *   runBenchmark({ domain: 'clickcast.tech', ratio: 'landscape' });
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getRenderConfig } = require('./utils/render-config');

// --- Config ---
const CONCURRENCY_RANGE = [1, 2, 3, 4, 6, 8];
const COMPOSITION_MAP = { landscape: 'VidGenPromo-Landscape', portrait: 'VidGenPromo-Portrait' };
const TIMEOUT_MS = 5 * 60 * 1000; // 5 min per test

/**
 * Run a single render with given concurrency and collect metrics.
 */
function runTest(concurrency, opts) {
  return new Promise((resolve) => {
    const outputDir = path.join(__dirname, '../websites', opts.domain, 'out');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, `bench-c${concurrency}.mp4`);

    const baseArgs = [
      'remotion', 'render', opts.compositionId, outputFile,
      `--concurrency=${concurrency}`,
      `--gl=${opts.gl}`,
      '--x264-preset=veryfast',
      '--enable-multiprocess-on-linux',
    ];
    if (opts.chromiumPath) {
      baseArgs.push(`--chromium-executable-path=${opts.chromiumPath}`);
    }

    // Remove NODE_ENV to prevent Chromium heap corruption
    const renderEnv = { ...process.env };
    delete renderEnv.NODE_ENV;

    const startTime = Date.now();
    let stdout = '';

    let spawnCmd, spawnArgs, spawnOpts;
    if (process.platform === 'win32') {
      spawnCmd = process.env.ComSpec || 'cmd.exe';
      spawnArgs = ['/c', 'npx', ...baseArgs];
      spawnOpts = { cwd: path.join(__dirname, '..'), env: renderEnv };
    } else {
      spawnCmd = 'npx';
      spawnArgs = baseArgs;
      spawnOpts = { cwd: path.join(__dirname, '..'), env: renderEnv };
    }

    const child = spawn(spawnCmd, spawnArgs, spawnOpts);

    child.stdout.on('data', (d) => { stdout += d.toString(); });

    const timer = setTimeout(() => {
      if (!child.killed) {
        child.kill();
        resolve({ concurrency, duration: null, fps: null, frames: null, error: 'TIMEOUT' });
      }
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      const wallDuration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code !== 0) {
        resolve({ concurrency, duration: parseFloat(wallDuration), fps: null, frames: null, error: `exit code ${code}` });
        return;
      }

      // Parse: "Rendered 150 frames in 4.5s (33.3 fps)"
      const fpsMatch = stdout.match(/Rendered (\d+) frames in ([0-9.]+)s \(([0-9.]+) fps\)/);
      if (fpsMatch) {
        resolve({
          concurrency,
          duration: parseFloat(fpsMatch[2]),
          fps: parseFloat(fpsMatch[3]),
          frames: parseInt(fpsMatch[1]),
          error: null,
        });
      } else {
        resolve({ concurrency, duration: parseFloat(wallDuration), fps: null, frames: null, error: 'FPS parse failed' });
      }
    });
  });
}

/**
 * Run the full benchmark across all concurrency values.
 * @param {Object} [options]
 * @param {string} [options.domain='clickcast.tech']
 * @param {string} [options.ratio='landscape']
 * @returns {Promise<Object>} Benchmark report
 */
async function runBenchmark(options = {}) {
  const domain = options.domain || 'clickcast.tech';
  const ratio = options.ratio || 'landscape';
  const compositionId = COMPOSITION_MAP[ratio];

  if (!compositionId) {
    throw new Error(`Invalid ratio "${ratio}". Use landscape or portrait.`);
  }

  // Verify the website has a timeline.json
  const timelinePath = path.join(__dirname, '../websites', domain, 'public', 'timeline.json');
  if (!fs.existsSync(timelinePath)) {
    throw new Error(`timeline.json not found at ${timelinePath}. Specify a valid domain with --domain <domain>`);
  }

  const { gl, chromiumPath } = getRenderConfig();

  const opts = { domain, ratio, compositionId, gl, chromiumPath };

  console.log('=== Remotion Concurrency Benchmark ===');
  console.log(`Domain:       ${domain}`);
  console.log(`Composition:  ${compositionId}`);
  console.log(`GL:           ${gl}`);
  console.log(`Chromium:     ${chromiumPath || 'default'}`);
  console.log(`CPU cores:    ${os.cpus().length}`);
  console.log(`Concurrency:  ${CONCURRENCY_RANGE.join(', ')}`);
  console.log('');

  const results = [];

  for (const concurrency of CONCURRENCY_RANGE) {
    console.log(`>>> Testing concurrency=${concurrency} ...`);
    const result = await runTest(concurrency, opts);
    results.push(result);

    if (result.fps) {
      console.log(`    ${result.frames} frames in ${result.duration}s = ${result.fps} fps`);
    } else {
      console.log(`    FAILED: ${result.error}`);
    }

    // Clean up benchmark output to save disk
    const benchFile = path.join(__dirname, '../websites', domain, 'out', `bench-c${concurrency}.mp4`);
    if (fs.existsSync(benchFile)) fs.unlinkSync(benchFile);
  }

  // --- Report ---
  console.log('\n=== Results ===');
  console.log('Concurrency | Frames | Duration(s) | FPS');
  console.log('------------|--------|-------------|-----');

  for (const r of results) {
    const fps = r.fps ? r.fps.toFixed(1) : 'N/A';
    const dur = r.duration ? r.duration.toFixed(1) : 'N/A';
    const frames = r.frames || '-';
    console.log(`${String(r.concurrency).padStart(11)} | ${String(frames).padStart(6)} | ${String(dur).padStart(11)} | ${fps}`);
  }

  const valid = results.filter(r => r.fps);
  let recommended = null;
  if (valid.length > 0) {
    const best = valid.reduce((a, b) => a.fps > b.fps ? a : b);
    recommended = best.concurrency;
    console.log(`\nRecommended concurrency: ${best.concurrency} (${best.fps.toFixed(1)} fps)`);
  }

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    domain,
    ratio,
    compositionId,
    system: {
      platform: process.platform,
      cpuCount: os.cpus().length,
      totalMemoryGB: (os.totalmem() / 1024 ** 3).toFixed(1),
      gl,
      chromiumPath: chromiumPath || 'default',
    },
    results,
    recommended,
  };

  const reportPath = path.join(__dirname, '../benchmark-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nResults saved to ${reportPath}`);

  return report;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const cliOpts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--domain' && args[i + 1]) cliOpts.domain = args[++i];
    if (args[i] === '--ratio' && args[i + 1]) cliOpts.ratio = args[++i];
  }
  runBenchmark(cliOpts).catch(console.error);
}

module.exports = { runBenchmark };
