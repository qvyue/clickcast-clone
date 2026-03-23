/**
 * 行业信息搜索模块
 *
 * 功能：
 * 1. 从网站内容提取行业关键词
 * 2. 联网搜索行业趋势、竞品信息
 * 3. 整合为 AI 可用的上下文
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载 .env
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

const CONFIG = {
  // 使用 DeepSeek 或其他 AI 来提取关键词
  API_KEY: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.deepseek.com',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
};

/**
 * AI 提取行业关键词
 */
async function extractIndustryKeywords(scrapedData) {
  const prompt = `Analyze this website and extract industry-related keywords for market research.

Website: ${scrapedData.url}
Product: ${scrapedData.productName}
Title: ${scrapedData.title}
Description: ${scrapedData.description}

Content Summary:
${scrapedData.core_text?.substring(0, 1000) || ''}

Extract:
1. Industry keywords (2-3 words) - what industry is this product in?
2. Competitor keywords - what products compete with this?
3. Market trends keywords - what trends are relevant?

Output ONLY valid JSON, no markdown:
{"industry": ["keyword1", "keyword2"], "competitors": ["competitor1"], "trends": ["trend1"], "searchQueries": ["query1"]}`;

  const result = await callAI(prompt);
  if (!result) return null;

  // 解析 JSON（处理可能的 markdown 包裹）
  try {
    let jsonStr = result;
    // 移除 markdown 代码块标记
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
    }
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    console.log('   ⚠️ JSON 解析失败，尝试提取...');
    // 尝试提取 JSON
    const match = result.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}

/**
 * 使用 DuckDuckGo 进行搜索 (无需 API Key)
 */
async function searchWeb(query) {
  return new Promise((resolve, reject) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;

    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = [];

          // 提取相关主题
          if (json.RelatedTopics) {
            for (const topic of json.RelatedTopics.slice(0, 5)) {
              if (topic.Text) {
                results.push({
                  text: topic.Text,
                  url: topic.FirstURL || ''
                });
              }
            }
          }

          // 提取摘要
          if (json.Abstract) {
            results.unshift({
              text: json.Abstract,
              url: json.AbstractURL || ''
            });
          }

          resolve(results);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

/**
 * 使用 AI 搜索 (通过 API 调用)
 */
async function searchWithAI(query) {
  const prompt = `You are a market research assistant. Provide brief, factual information about:

"${query}"

Provide:
1. Key facts (2-3 sentences)
2. Market context
3. Recent trends or developments

Keep it concise and factual. No speculation.`;

  const result = await callAI(prompt, 500);
  return result?.text || result?.facts || null;
}

/**
 * 调用 AI API
 */
async function callAI(prompt, maxTokens = 800) {
  if (!CONFIG.API_KEY) return null;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: CONFIG.AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3
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
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

/**
 * 完整的行业研究流程
 */
async function researchIndustry(scrapedData) {
  console.log('\n🔍 开始行业研究...');

  // 1. 提取关键词
  console.log('   📊 提取行业关键词...');
  const keywords = await extractIndustryKeywords(scrapedData);

  if (!keywords) {
    console.log('   ⚠️ 关键词提取失败，使用默认');
    return null;
  }

  console.log(`   ✅ 行业: ${keywords.industry?.join(', ') || 'Unknown'}`);
  console.log(`   ✅ 竞品: ${keywords.competitors?.slice(0, 3).join(', ') || 'N/A'}`);
  console.log(`   ✅ 趋势: ${keywords.trends?.slice(0, 3).join(', ') || 'N/A'}`);

  // 2. 搜索行业信息
  const searchResults = [];
  const queries = keywords.searchQueries || [
    `${scrapedData.productName} product features`,
    `${keywords.industry?.[0] || ''} industry trends 2024`
  ];

  console.log('   🌐 搜索行业信息...');

  for (const query of queries.slice(0, 2)) {
    if (!query || query.length < 3) continue;

    console.log(`      搜索: ${query.substring(0, 40)}...`);

    // 使用 AI 获取相关信息
    const aiResult = await searchWithAI(query);
    if (aiResult) {
      searchResults.push({
        query,
        result: aiResult
      });
    }

    // 避免请求过快
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. 整合研究结果
  const research = {
    keywords,  // 存储解析后的对象
    searchResults,
    summary: formatResearchForAI(keywords, searchResults)
  };

  console.log(`   ✅ 行业研究完成 (${research.summary.length} 字符)`);

  return research;
}

/**
 * 格式化研究结果为 AI 可用格式
 */
function formatResearchForAI(keywords, searchResults) {
  // 如果 keywords 是字符串，尝试解析
  let kw = keywords;
  if (typeof keywords === 'string') {
    try {
      let jsonStr = keywords;
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```\s*/g, '');
      }
      kw = JSON.parse(jsonStr.trim());
    } catch (e) {
      kw = {};
    }
  }

  const parts = [];

  if (kw.industry?.length > 0) {
    parts.push(`【行业定位】${kw.industry.join(' / ')}`);
  }

  if (kw.competitors?.length > 0) {
    parts.push(`【主要竞品】${kw.competitors.slice(0, 5).join(', ')}`);
  }

  if (kw.trends?.length > 0) {
    parts.push(`【行业趋势】${kw.trends.join(', ')}`);
  }

  if (searchResults?.length > 0) {
    parts.push(`【市场研究】`);
    searchResults.forEach((r, i) => {
      if (r.result) {
        parts.push(`${i + 1}. ${r.result.substring(0, 200)}`);
      }
    });
  }

  return parts.join('\n');
}

/**
 * 增强 scraped 数据
 * @param {Object} scrapedData - 网站抓取的数据
 * @param {string} savePath - 可选，保存路径（不提供则不保存）
 */
async function enhanceWithIndustryResearch(scrapedData, savePath = null) {
  const research = await researchIndustry(scrapedData);

  if (research) {
    // 添加到原始数据
    scrapedData.industryResearch = research;

    // 添加到 core_text
    if (scrapedData.core_text) {
      scrapedData.core_text += '\n\n' + research.summary;
    }

    // 如果提供了保存路径，则保存
    if (savePath) {
      fs.writeFileSync(savePath, JSON.stringify(scrapedData, null, 2));
      console.log(`   📝 已更新 scraped.json，新增 ${research.summary?.length || 0} 字符行业信息`);
    } else {
      console.log(`   📝 已添加行业研究信息: ${research.summary?.length || 0} 字符`);
    }
  }

  return scrapedData;
}

// 命令行测试
if (require.main === module) {
  const scrapedPath = path.join(__dirname, 'public', 'scraped.json');
  if (fs.existsSync(scrapedPath)) {
    const scrapedData = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
    enhanceWithIndustryResearch(scrapedData).then(() => {
      console.log('\n完成！');
    });
  } else {
    console.log('请先运行 capture.js');
  }
}

module.exports = {
  extractIndustryKeywords,
  searchWeb,
  searchWithAI,
  researchIndustry,
  enhanceWithIndustryResearch
};