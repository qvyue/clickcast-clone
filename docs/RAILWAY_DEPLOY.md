# Railway + R2 部署指南

## 部署架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Railway   │────▶│  ClickCast  │────▶│  Cloudflare │
│   (Web)     │     │   Server    │     │     R2      │
│  $20-30/月  │     │             │     │   $0-5/月   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 1. 创建 Cloudflare R2 存储桶

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **R2 Object Storage**
3. 点击 **Create bucket**
4. 命名为 `clickcast-videos` (或其他名称)
5. 进入 bucket 设置，启用 **Public Access**
6. 记录以下信息：
   - Bucket Name: `clickcast-videos`
   - Public URL: `https://pub-xxx.r2.dev`

## 2. 创建 R2 API Token

1. 进入 **R2 Overview** → **Manage R2 API Tokens**
2. 点击 **Create API token**
3. 权限选择：**Object Read & Write**
4. 指定 bucket: `clickcast-videos`
5. 创建后记录：
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (格式: `https://<account_id>.r2.cloudflarestorage.com`)

## 3. 部署到 Railway

### 方式一：连接 GitHub (推荐)

1. 登录 [Railway](https://railway.app/)
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择 `clickcast-clone` 仓库
4. Railway 会自动检测 `railway.toml`

### 方式二：CLI 部署

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 部署
railway up
```

## 4. 配置环境变量

在 Railway Dashboard → 项目 → Variables 添加：

```env
# AI API
DEEPSEEK_API_KEY=sk-xxx
API_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat

# 配音
VOICE=en-US-ChristopherNeural

# R2 存储 (可选)
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access_key_id>
R2_SECRET_ACCESS_KEY=<secret_access_key>
R2_BUCKET_NAME=clickcast-videos
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

## 5. 资源配置

在 Railway 中设置：
- **Memory**: 4GB (视频渲染需要)
- **CPU**: 2 核

```bash
# 或通过 CLI
railway variables set RAILWAY_CPU=2
railway variables set RAILWAY_MEMORY=4096
```

## 6. 验证部署

```bash
# 检查日志
railway logs

# 测试 API
curl https://your-app.railway.app/api/videos
```

## 成本估算

| 服务 | 配置 | 月费 |
|------|------|------|
| Railway | 4GB 内存 + 2 CPU | $20-30 |
| R2 存储 | 10GB 存储 + 流量 | $0-5 |
| **总计** | | **$20-35/月** |

### R2 免费额度
- 存储: 10GB
- Class A 操作: 100 万次
- Class B 操作: 1000 万次
- 出口流量: 10GB/月

## 故障排查

### 内存不足
```
Error: JavaScript heap out of memory
```
解决方案: 增加内存到 4GB 或更高

### Playwright 启动失败
确保 Dockerfile 中安装了所有依赖：
```dockerfile
RUN npx playwright install chromium --with-deps
```

### R2 上传失败
检查环境变量是否正确配置：
```bash
railway variables
```

## 持久化存储

Railway 默认存储是临时的，重启后丢失。使用 R2 可持久化视频文件。

如果需要持久化 `websites/` 目录，可以使用 Railway Volume：
```bash
railway volume create --mount /app/websites
```