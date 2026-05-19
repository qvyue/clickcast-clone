# VidGen Docker Image - 优化内存使用
FROM node:20-slim

# 设置内存限制环境变量 (8GB实例，Node.js使用4GB)
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV REMOTION_GL=swangle
# Skip Playwright browser download during npm install
# Browsers are installed at runtime to persistent volume
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/data/browsers
# Use RAM disk for temp files (faster than disk IO for video rendering)
ENV TMPDIR=/dev/shm

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libvulkan1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install edge-tts for voice generation
RUN pip3 install --no-cache-dir edge-tts --break-system-packages

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies only (browser download skipped)
RUN npm ci && \
    npm cache clean --force && \
    rm -rf /root/.npm /tmp/*

# Copy application code
COPY . .

# 验证 BGM 文件存在
RUN echo "=== Checking BGM file ===" && \
    ls -la /app/public/ && \
    test -f /app/public/bensound-slowlife.mp3 && echo "✅ BGM file OK ($(stat -c%s /app/public/bensound-slowlife.mp3) bytes)" || echo "❌ BGM file MISSING"

# Expose port
EXPOSE 3000

# Entrypoint: set up persistent volume directories, install browsers on first run
# /data is mounted as a persistent volume (5GB) on Railway
# - /data/browsers  → Playwright/Remotion Chromium
# - /data/websites  → Website screenshots, audio, rendered videos
# /app/websites is symlinked → /data/websites so all existing code works unchanged
RUN printf '#!/bin/sh\n\
set -e\n\
\n\
# Create /data subdirectories if they dont exist\n\
mkdir -p /data/browsers /data/websites\n\
\n\
# Symlink /app/websites → /data/websites (persistent volume)\n\
# Remove default dir if it exists and is not already a symlink\n\
if [ ! -L /app/websites ]; then\n\
  rm -rf /app/websites\n\
  ln -s /data/websites /app/websites\n\
  echo "Linked /app/websites → /data/websites"\n\
fi\n\
\n\
# Install Playwright Chromium if not already present\n\
if [ ! -f /data/browsers/.installed ]; then\n\
  echo "Installing Playwright Chromium to /data/browsers..."\n\
  npx playwright install chromium\n\
  touch /data/browsers/.installed\n\
  echo "Playwright Chromium installed."\n\
else\n\
  echo "Playwright Chromium already installed."\n\
fi\n\
\n\
# Enlarge /dev/shm for Chromium rendering\n\
mount -o remount,size=2G /dev/shm 2>/dev/null || true\n\
\n\
exec node --max-old-space-size=4096 bin/server.js\n' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
