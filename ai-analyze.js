/**
 * AI Analysis Module
 * 使用 DeepSeek/OpenAI 兼容 API 分析网站内容
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载 .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    });
  }
}
loadEnv();

const CONFIG = {
  API_KEY: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.deepseek.com',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
};

/**
 * 调用 AI API 生成视频脚本
 */
async function generateScript(scrapedData) {
  if (!CONFIG.API_KEY) {
    console.log('未设置 API Key，使用默认文案');
    return generateDefaultScript();
  }

  const prompt = `You are a professional TikTok/Reels video scriptwriter. Based on the following website information, generate a short video script.

Website Title: ${scrapedData.title || ''}
Description: ${scrapedData.description || ''}
Core Content: ${scrapedData.core_text || ''}

Generate 4-5 scenes with SHORT, PUNCHY titles suitable for voiceover.

RULES:
- Titles must be 3-6 words MAX (short and attention-grabbing for TikTok/Reels)
- Titles should be impactful statements, not descriptions
- Avoid filler words (the, a, an, your, etc.)
- SubText can be slightly longer but keep it under 10 words
- Each title should work as a standalone voiceover line

Output JSON format:
{
  "product": "Product Name",
  "tagline": "Catchy tagline",
  "scenes": [
    {"title": "Powerful AI Assistant", "subText": "Your coding partner everywhere"}
  ]
}`;

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: CONFIG.AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500
    });

    const url = new URL(`${CONFIG.API_BASE_URL}/v1/chat/completions`);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            const content = json.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const script = JSON.parse(jsonMatch[0]);
              // 确保 scenes 数组存在
              if (script && script.scenes && Array.isArray(script.scenes)) {
                console.log('AI 分析完成!');
                resolve(script);
                return;
              }
            }
          }
        } catch (e) {
          console.error('API 响应解析失败:', e.message);
        }
        console.log('AI 解析失败，使用默认文案');
        resolve(generateDefaultScript());
      });
    });

    req.on('error', (e) => {
      console.error('API 请求失败:', e.message);
      resolve(generateDefaultScript());
    });

    req.write(postData);
    req.end();
  });
}

function generateDefaultScript() {
  return {
    product: "Your Product",
    tagline: "Amazing Solution",
    scenes: [
      { title: "Welcome", subText: "Discover the future" },
      { title: "Powerful Features", subText: "Built for you" },
      { title: "Easy to Use", subText: "Intuitive design" },
      { title: "Trusted by Millions", subText: "Join our community" },
      { title: "Get Started", subText: "Try it free" }
    ]
  };
}

// 命令行测试
if (require.main === module) {
  console.log('请通过 pipeline.js 运行');
}

module.exports = { generateScript, generateDefaultScript };