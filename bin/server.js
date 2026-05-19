/**
 * VidGen Web Server
 * Provides URL input interface and video generation service
 *
 * Main features:
 * - Static website hosting
 * - Image upload endpoint
 * - Voiceover generation (Edge-TTS preview / ElevenLabs production)
 * - Video rendering (based on Remotion)
 * - Task status query
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Load environment variables (local development)
require('dotenv').config();

// Import shared state and utilities
const { jobs, rateLimiter, generateExamplesHtml } = require('./utils/state');

// Import route aggregator
const setupRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Middleware Configuration ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== Static File Service ==========
// Global public directory (BGM, common resources)
app.use(express.static(path.join(__dirname, '../public')));
// Website-specific resources directory (screenshots, audio per site)
app.use('/websites', express.static(path.join(__dirname, '../websites')));

// ========== API Routes ==========
setupRoutes(app);

// ========== Homepage HTML Template ==========
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VidGen - AI Video Generator</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 700px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 { color: #1a1a2e; margin-bottom: 8px; font-size: 28px; }
    .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
    .input-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #333; font-weight: 500; }
    input[type="url"] {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    input[type="url"]:focus { outline: none; border-color: #4a90e2; }
    button {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #4a90e2 0%, #7b68ee 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(74, 144, 226, 0.4); }
    button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .progress-container {
      display: none;
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
    }
    .progress-container.active { display: block; }
    .progress-text { text-align: center; margin-bottom: 15px; color: #333; font-size: 15px; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4a90e2, #7b68ee);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .result { display: none; margin-top: 20px; text-align: center; }
    .result.active { display: block; }
    .result video { max-width: 100%; max-height: 400px; border-radius: 12px; margin-top: 15px; }
    .result video.portrait { max-height: 500px; }
    .download-btn {
      display: inline-block;
      margin-top: 15px;
      padding: 12px 30px;
      background: #28a745;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
    .video-list {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .video-list h3 { font-size: 16px; color: #333; margin-bottom: 15px; }
    .video-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 15px;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .video-info { text-align: left; }
    .video-domain { font-weight: 600; color: #333; }
    .video-meta { font-size: 12px; color: #666; }
    .video-actions a {
      display: inline-block;
      padding: 6px 12px;
      background: #4a90e2;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      font-size: 12px;
      margin-left: 8px;
    }
    .video-actions a:hover { opacity: 0.8; }
    .video-actions a.delete {
      background: #dc3545;
    }
    .video-actions a.delete:hover { background: #c82333; }
    .steps { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .steps-title { font-size: 12px; color: #999; margin-bottom: 10px; }
    .step {
      display: inline-block;
      padding: 6px 12px;
      background: #f0f0f0;
      border-radius: 20px;
      font-size: 12px;
      color: #666;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    .examples { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .examples h3 { font-size: 16px; color: #333; margin-bottom: 15px; }
    .examples-grid { display: flex; flex-direction: column; gap: 15px; }
    .example-card { background: #f8f9fa; border-radius: 12px; overflow: hidden; }
    .example-card iframe { width: 100%; aspect-ratio: 16 / 9; border: none; }
    .example-info { padding: 12px 15px; }
    .example-title { font-weight: 600; color: #333; margin-bottom: 4px; }
    .example-desc { font-size: 12px; color: #666; }
    /* Sign In button & modal */
    .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .header-row h1 { margin-bottom: 0; }
    .sign-in-btn {
      width: auto; padding: 8px 18px; font-size: 13px; font-weight: 500;
      background: white; color: #171717; border: 1px solid #e0e0e0;
      border-radius: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .sign-in-btn:hover { background: #f5f5f5; transform: none; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .user-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333; }
    .user-info img { width: 28px; height: 28px; border-radius: 50%; }
    .user-info .sign-out { color: #999; cursor: pointer; font-size: 12px; margin-left: 4px; }
    .user-info .sign-out:hover { color: #e53e3e; }
    .modal-overlay {
      display: none; position: fixed; inset: 0; z-index: 50;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    }
    .modal-overlay.active { display: flex; }
    .modal-card {
      position: relative; width: 100%; max-width: 400px;
      background: rgba(23,23,23,0.97); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }
    .modal-accent { height: 3px; background: linear-gradient(to right, #9b4dff, #d946ef, #9b4dff); }
    .modal-close {
      position: absolute; top: 12px; right: 12px;
      background: none; border: none; color: #a3a3a3;
      cursor: pointer; padding: 6px;
    }
    .modal-body { padding: 40px 32px 32px; }
    .modal-body h2 { font-size: 22px; font-weight: 700; color: #fff; text-align: center; margin-bottom: 6px; }
    .modal-body .modal-sub { font-size: 14px; color: #a3a3a3; text-align: center; margin-bottom: 28px; }
    .google-btn {
      width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
      background: #fff; color: #171717; font-weight: 500; font-size: 14px;
      padding: 12px 16px; border: none; border-radius: 10px; cursor: pointer;
    }
    .google-btn:hover { background: #f5f5f5; }
    .modal-terms { font-size: 11px; color: #737373; text-align: center; margin-top: 20px; }
    .modal-terms a { color: #c084fc; text-decoration: none; }
    .modal-trial { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; }
    .modal-trial p { font-size: 13px; color: #c084fc; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <h1>VidGen</h1>
      <div id="authArea">
        <button class="sign-in-btn" id="signInBtn" onclick="openLoginModal()">Sign In</button>
      </div>
    </div>
    <p class="subtitle">Enter a URL, AI automatically generates a marketing video</p>
    <div class="input-group">
      <label for="url">Website URL</label>
      <input type="url" id="url" placeholder="github.com or https://example.com" required>
    </div>
    <button id="generateBtn" onclick="generateVideo()">Generate Video</button>
    <div class="progress-container" id="progress">
      <p class="progress-text" id="progressText">Preparing...</p>
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill" style="width: 0%"></div>
      </div>
    </div>
    <div class="result" id="result">
      <p>Video generated successfully!</p>
      <video id="videoPlayer" controls></video>
      <br>
      <a id="downloadLink" class="download-btn" href="#" download>Download Video</a>
    </div>

    <div class="video-list" id="videoListSection" style="display:none;">
      <h3>Generated Videos</h3>
      <div id="videoList"></div>
    </div>

    <div class="steps">
      <p class="steps-title">Workflow</p>
      <span class="step">Enter URL</span>
      <span class="step">Playwright Screenshot</span>
      <span class="step">AI Analysis</span>
      <span class="step">Script Generation</span>
      <span class="step">AI Voiceover</span>
      <span class="step">Remotion Render</span>
    </div>

    {{EXAMPLES_SECTION}}
  </div>
  <script>
    /**
     * HTML escape function to prevent XSS attacks
     * @param {string} str - String to escape
     * @returns {string} Escaped safe string
     */
    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    let currentJobId = null;       // Current job ID
    let pollInterval = null;       // Polling timer
    let pollingStartTime = null;   // Polling start time

    /**
     * Load generated video list
     * @async
     * @description Fetches video list from server and renders to page
     */
    async function loadVideoList() {
      try {
        const res = await fetch('/api/videos');
        const data = await res.json();

        if (data.videos && data.videos.length > 0) {
          document.getElementById('videoListSection').style.display = 'block';
          document.getElementById('videoList').innerHTML = data.videos.map(v =>
            '<div class="video-item" id="video-' + escapeHtml(v.domain) + '">' +
              '<div class="video-info">' +
                '<div class="video-domain">' + escapeHtml(v.domain) + '</div>' +
                '<div class="video-meta">' + escapeHtml(v.file) + ' · ' + escapeHtml(v.size) + ' MB</div>' +
              '</div>' +
              '<div class="video-actions">' +
                '<a href="/editor/' + escapeHtml(v.domain) + '">Edit</a>' +
                '<a href="' + escapeHtml(v.url) + '" target="_blank">Play</a>' +
                '<a href="' + escapeHtml(v.url) + '" download>Download</a>' +
                '<a href="#" class="delete" data-domain="' + escapeHtml(v.domain) + '">Delete</a>' +
              '</div>' +
            '</div>'
          ).join('');
        }
      } catch (e) {
        console.error('Failed to load video list:', e);
      }
    }

    /**
     * Submit video generation request
     * @async
     * @description Validates input, sends request, starts status polling
     */
    async function generateVideo() {
      const url = document.getElementById('url').value.trim();
      const btn = document.getElementById('generateBtn');
      const progress = document.getElementById('progress');
      const result = document.getElementById('result');

      // Input validation
      if (!url) { alert('Please enter a URL'); return; }

      // Update UI state
      btn.disabled = true;
      btn.textContent = 'Submitting...';
      progress.classList.add('active');
      result.classList.remove('active');
      document.getElementById('progressFill').style.width = '0%';

      try {
        // Send generation request
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, aspectRatio: 'landscape' })
        });
        const data = await res.json();

        // Error handling
        if (data.error) {
          alert(data.error);
          btn.disabled = false;
          btn.textContent = 'Generate Video';
          return;
        }

        // Start status polling
        currentJobId = data.jobId;
        pollingStartTime = Date.now();
        btn.textContent = 'Generating...';
        pollStatus();
        pollInterval = setInterval(pollStatus, 2000);
      } catch (error) {
        alert('Submission failed: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Generate Video';
      }
    }

    /**
     * Poll job status
     * @async
     * @description Queries job status every 2 seconds until complete or failed
     */
    async function pollStatus() {
      if (!currentJobId) return;

      // Timeout check (8 minutes)
      if (pollingStartTime && Date.now() - pollingStartTime > 480000) {
        clearInterval(pollInterval);
        alert('Generation timed out. Please try again.');
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('generateBtn').textContent = 'Generate Video';
        pollingStartTime = null;
        currentJobId = null;
        return;
      }

      try {
        const res = await fetch('/api/status/' + currentJobId);
        const data = await res.json();

        // Update progress display
        document.getElementById('progressText').textContent = data.message;
        document.getElementById('progressFill').style.width = data.progress + '%';

        // Render complete
        if (data.status === 'completed') {
          clearInterval(pollInterval);

          // 如果有 domain 但没有 videoUrl，说明是 generate 流程完成，跳转到编辑器
          if (data.domain && !data.videoUrl) {
            window.location.href = '/editor/' + data.domain;
            return;
          }

          // 如果有 videoUrl，说明是 render 流程完成，显示视频
          if (data.videoUrl) {
            const vp = document.getElementById('videoPlayer');
            vp.src = data.videoUrl;
            vp.classList.toggle('portrait', data.aspectRatio === 'portrait');
            document.getElementById('downloadLink').href = data.videoUrl;
          }
          document.getElementById('result').classList.add('active');
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').textContent = 'Generate Video';
          loadVideoList();
        }

        // Render failed
        if (data.status === 'failed') {
          clearInterval(pollInterval);
          alert('Generation failed, please try again');
          document.getElementById('generateBtn').disabled = false;
          document.getElementById('generateBtn').textContent = 'Generate Video';
        }
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }

    // Delete button event delegation
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('delete')) {
        e.preventDefault();
        var domain = e.target.getAttribute('data-domain');
        if (domain) {
          deleteVideo(domain);
        }
      }
    });

    /**
     * Delete video
     * @async
     * @param {string} domain - Website domain
     */
    async function deleteVideo(domain) {
      if (!confirm('Delete video and cache for ' + domain + '?')) return;

      try {
        const res = await fetch('/api/delete/' + domain, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          // Remove from UI
          var item = document.getElementById('video-' + domain);
          if (item) item.remove();

          // Check if list is empty
          var list = document.getElementById('videoList');
          if (list.children.length === 0) {
            document.getElementById('videoListSection').style.display = 'none';
          }

          alert('Deleted successfully');
        } else {
          alert('Delete failed: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Delete failed: ' + e.message);
      }
    }

    // Load video list on page load
    loadVideoList();
  </script>

  <!-- Login Modal -->
  <div class="modal-overlay" id="loginModal">
    <div class="modal-card">
      <div class="modal-accent"></div>
      <button class="modal-close" onclick="closeLoginModal()">&#10005;</button>
      <div class="modal-body">
        <h2>Welcome to VidGen</h2>
        <p class="modal-sub">Sign in to create videos and manage your dashboard</p>
        <button class="google-btn" onclick="signInWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <p class="modal-terms">By signing in, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a></p>
        <div class="modal-trial"><p>🎉 Get 2 day free trial</p></div>
      </div>
      <div class="modal-accent"></div>
    </div>
  </div>

  <!-- Supabase Auth -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script>
    const SUPABASE_URL = '{{SUPABASE_URL}}';
    const SUPABASE_ANON_KEY = '{{SUPABASE_ANON_KEY}}';
    let sb = null;

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      // Check existing session
      sb.auth.getSession().then(({ data: { session } }) => {
        if (session) showUserInfo(session.user);
      });
      // Listen for auth changes (e.g. after OAuth callback redirect)
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) showUserInfo(session.user);
        if (event === 'SIGNED_OUT') showSignInBtn();
      });
    }

    function openLoginModal() {
      document.getElementById('loginModal').classList.add('active');
    }
    function closeLoginModal() {
      document.getElementById('loginModal').classList.remove('active');
    }
    async function signInWithGoogle() {
      if (!sb) { alert('Auth not configured'); return; }
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth/callback' }
      });
      if (error) alert(error.message);
    }
    async function signOut() {
      if (!sb) return;
      await sb.auth.signOut();
      showSignInBtn();
    }
    function showUserInfo(user) {
      const name = user.user_metadata?.full_name || user.email || 'User';
      const avatar = user.user_metadata?.avatar_url || '';
      document.getElementById('authArea').innerHTML =
        '<div class="user-info">' +
          (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="avatar">' : '') +
          '<span>' + escapeHtml(name) + '</span>' +
          '<span class="sign-out" onclick="signOut()">Sign Out</span>' +
        '</div>';
      closeLoginModal();
    }
    function showSignInBtn() {
      document.getElementById('authArea').innerHTML =
        '<button class="sign-in-btn" onclick="openLoginModal()">Sign In</button>';
    }
  </script>
</body>
</html>`;

/**
 * Homepage route
 * @route GET /
 * @returns {string} Homepage HTML (including example videos section)
 */
app.get('/', (req, res) => {
  // Replace placeholders in template
  let html = indexHtml.replace('{{EXAMPLES_SECTION}}', generateExamplesHtml());
  html = html.replace('{{SUPABASE_URL}}', process.env.SUPABASE_URL || '');
  html = html.replace('{{SUPABASE_ANON_KEY}}', process.env.SUPABASE_ANON_KEY || '');
  res.send(html);
});

// ========== Frontend SPA Service ==========
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');

// Check if frontend is built
if (fs.existsSync(frontendDistPath)) {
  // Serve frontend static assets (JS, CSS, etc.)
  app.use(express.static(frontendDistPath));

  // SPA fallback: return index.html for frontend routes (e.g., /editor/:domain)
  // Must be after API routes, so API calls are handled first
  // Use middleware to catch all unmatched routes
  app.use((req, res, next) => {
    // Skip if it's an API route or static file request
    if (req.path.startsWith('/api/') || req.path.startsWith('/websites/')) {
      return next();
    }
    // Return index.html for SPA routes
    res.sendFile('index.html', { root: frontendDistPath }, (err) => {
      if (err) {
        console.error('SendFile error:', err.message);
        res.status(500).send('Error loading page');
      }
    });
  });

  console.log('Frontend SPA enabled (serving from ' + frontendDistPath + ')');
} else {
  console.log('Frontend not built. Run "cd frontend && npm run build" to enable SPA routes.');
}

// ========== Server Initialization ==========

// Ensure websites directory exists
const websitesDir = path.join(__dirname, '../websites');
if (!fs.existsSync(websitesDir)) {
  fs.mkdirSync(websitesDir, { recursive: true });
}

// Verify BGM file exists
const bgmPath = path.join(__dirname, '../public', 'bensound-slowlife.mp3');
if (fs.existsSync(bgmPath)) {
  const stats = fs.statSync(bgmPath);
  console.log(`BGM file found: ${stats.size} bytes`);
} else {
  console.log(`BGM file missing: ${bgmPath}`);
}

/**
 * Auto cleanup expired jobs
 * @description Cleans up job records older than 2 hours every 30 minutes
 */
setInterval(() => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt && Date.now() - job.createdAt > TWO_HOURS) {
      jobs.delete(id);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

/**
 * Periodic cleanup of expired rate limit records
 * @description Cleans up expired IP request records every minute
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter) {
    if (now > entry.resetAt) {
      rateLimiter.delete(ip);
    }
  }
}, 60000); // Run every minute

// Start HTTP server
app.listen(PORT, () => {
  console.log(`
========================================
   VidGen Web UI
   http://localhost:${PORT}
========================================
  `);
});
