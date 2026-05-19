/**
 * Render Configuration Module
 * Dynamically computes optimal Remotion render settings based on platform and hardware.
 *
 * - Concurrency: CPU-aware (Linux) or conservative (Windows)
 * - GL backend: swangle on Linux (ANGLE+SwiftShader, no GPU needed), angle on Windows
 * - Chromium path: auto-discovery for Playwright installs in Docker
 * - Environment variable overrides: REMOTION_CONCURRENCY, REMOTION_GL
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Validate GL backend availability at startup.
 * If angle/vulkan is chosen but Vulkan ICD is missing, fall back to swangle.
 */
function validateGlBackend(gl) {
  if (gl === 'angle' || gl === 'vulkan') {
    const icdPaths = [
      '/etc/vulkan/icd.d',
      '/usr/share/vulkan/icd.d',
      '/usr/local/share/vulkan/icd.d'
    ];
    const hasVulkanICD = icdPaths.some(p => {
      try {
        return fs.readdirSync(p).some(f => f.endsWith('.json'));
      } catch { return false; }
    });
    if (!hasVulkanICD) {
      console.warn(`[render-config] Vulkan ICD not found, falling back from '${gl}' to 'swangle'`);
      return 'swangle';
    }
  }
  return gl;
}

/**
 * Discover Chromium binary path for Remotion rendering.
 * Finds Playwright's installed Chromium so Remotion can share it.
 * @returns {string|null} Absolute path to Chromium, or null if not found
 */
function discoverChromiumPath() {
  // 1. Explicit env var
  if (process.env.CHROMIUM_EXECUTABLE_PATH && fs.existsSync(process.env.CHROMIUM_EXECUTABLE_PATH)) {
    return process.env.CHROMIUM_EXECUTABLE_PATH;
  }

  // 2. Search Playwright's browser directories
  const searchPaths = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,  // /data/browsers in Docker
    path.join(os.homedir(), '.cache', 'ms-playwright'),  // default local
  ].filter(Boolean);

  for (const playwrightPath of searchPaths) {
    if (!fs.existsSync(playwrightPath)) continue;
    try {
      const dirs = fs.readdirSync(playwrightPath)
        .filter(d => d.startsWith('chromium'));
      for (const d of dirs) {
        // Playwright v1.50+ uses chrome-headless-shell
        const headlessPath = path.join(playwrightPath, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
        const linuxPath = path.join(playwrightPath, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(headlessPath)) return headlessPath;
        if (fs.existsSync(linuxPath)) return linuxPath;
      }
    } catch { /* ignore */ }
  }

  return null;
}

/**
 * Get optimal render configuration for the current platform.
 * @returns {{ concurrency: number, gl: string, chromiumPath: string|null }}
 */
function getRenderConfig() {
  const isLinux = process.platform === 'linux';
  const cpuCount = os.cpus().length;

  // --- Concurrency ---
  // Linux (Railway production): 3 is optimal for 8 vCPU without GPU
  //   Chrome shares one process across all tabs; higher concurrency yields
  //   diminishing returns and can even slow down due to resource contention.
  // Windows (local dev): keep at 1 for stability
  let concurrency;
  if (isLinux) {
    concurrency = Math.min(Math.max(Math.round(cpuCount / 2) - 1, 2), 4);
  } else {
    concurrency = 1;
  }

  // Environment variable override
  if (process.env.REMOTION_CONCURRENCY) {
    concurrency = parseInt(process.env.REMOTION_CONCURRENCY, 10);
  }

  // --- GL backend ---
  // Linux without GPU: 'swangle' (ANGLE on SwiftShader) — Remotion Lambda's default.
  //   Faster than plain swiftshader, no Vulkan ICD required.
  // Windows: 'angle' (works well after NODE_ENV fix)
  let gl;
  if (isLinux) {
    gl = 'swangle';
  } else {
    gl = 'angle';
  }

  // Environment variable override
  if (process.env.REMOTION_GL) {
    gl = process.env.REMOTION_GL;
  }

  // Validate: fall back to swangle if Vulkan ICD is missing
  if (isLinux) {
    gl = validateGlBackend(gl);
  }

  // --- Chromium path ---
  const chromiumPath = discoverChromiumPath();

  return { concurrency, gl, chromiumPath };
}

module.exports = { getRenderConfig };
