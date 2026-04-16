/**
 * Shared Environment Loader
 *
 * Loads .env file into process.env without any external dependencies.
 * Walks up from the caller's directory (or __dirname) to find the project
 * root where the .env file lives.
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a .env file and set key=value pairs into process.env.
 *
 * @param {string} [startDir]  Directory to start searching from.
 *                              Defaults to the directory of this module's parent
 *                              (i.e. the project root when utils/ sits at top level).
 * @returns {boolean} true if a .env file was loaded, false otherwise.
 */
function loadEnv(startDir) {
  let dir = startDir || path.resolve(__dirname, '..');

  // Walk up at most 10 levels looking for .env
  for (let i = 0; i < 10; i++) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1);
            if (key) {
              process.env[key] = value;
            }
          }
        }
      });
      return true;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return false;
}

module.exports = { loadEnv };
