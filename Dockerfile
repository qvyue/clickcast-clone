# ClickCast Docker Image - 优化内存使用
FROM node:20-slim

# 设置内存限制环境变量
ENV NODE_OPTIONS="--max-old-space-size=512"

# Install system dependencies for Playwright (最小化安装)
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

# Install Node dependencies (包含 Remotion CLI)
RUN npm ci

# Install Playwright browsers (只安装 chromium)
RUN npx playwright install chromium

# Copy application code (包含 BGM 文件)
COPY . .

# 验证 BGM 文件存在
RUN echo "=== Checking BGM file ===" && \
    ls -la /app/public/ && \
    test -f /app/public/bensound-slowlife.mp3 && echo "✅ BGM file OK ($(stat -c%s /app/public/bensound-slowlife.mp3) bytes)" || echo "❌ BGM file MISSING"

# Create output directory
RUN mkdir -p out websites

# Expose port
EXPOSE 3000

# Start server with memory limit
CMD ["node", "--max-old-space-size=512", "server.js"]