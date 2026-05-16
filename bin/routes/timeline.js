/**
 * Timeline Routes
 * Handles timeline configuration save operations
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateDomain } = require('../utils/state');

const router = express.Router();

/**
 * 强制执行 timeline 数据规则
 * 与 generate.js 中的 enforceTimelineRules 逻辑一致
 * 确保所有写入 timeline.json 的数据满足业务约束
 */
function enforceTimelineRules(timeline) {
  if (!timeline || !timeline.scenes) return;

  const product = timeline.product || 'this product';

  for (const scene of timeline.scenes) {
    // 旧格式映射
    if (!scene.mainTitle) {
      if (scene.text) {
        scene.mainTitle = scene.text;
        delete scene.text;
      } else if (scene.title) {
        scene.mainTitle = scene.title;
      }
    }

    if (!scene.subTitle) {
      if (scene.subVoiceover) {
        scene.subTitle = scene.subVoiceover;
      } else if (scene.subText) {
        scene.subTitle = scene.subText;
        delete scene.subText;
      }
    }

    // 核心规则：title = mainTitle，subVoiceover = subTitle（文案 = 配音）
    scene.title = scene.mainTitle;
    scene.subVoiceover = scene.subTitle;

    delete scene.text;
    delete scene.subText;

    // 所有场景：填充空的 subTitle（不再拆分 mainTitle）
    if (!scene.subTitle || !scene.subTitle.trim()) {
      scene.subTitle = `Discover more about ${product}.`;
      scene.title = scene.mainTitle;
      scene.subVoiceover = scene.subTitle;
    }
  }
}

/**
 * Save timeline configuration
 * @route POST /api/timeline/:domain
 * @param {string} domain - Website domain (URL parameter)
 * @body {Object} Full timeline.json content
 * @returns {Object} { success: true } on success
 * @returns {Object} { error: string } on error
 * @throws {400} Invalid domain or path traversal attack
 * @throws {500} File write failed
 */
router.post('/:domain', (req, res) => {
  const { domain } = req.params;

  // Validate domain format, prevent illegal characters
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  // Build file path
  const timelinePath = path.join(__dirname, '../../websites', domain, 'public', 'timeline.json');

  // Security check: ensure resolved path is still under websites directory
  const resolved = path.resolve(timelinePath);
  if (!resolved.startsWith(path.resolve(path.join(__dirname, '../../websites')))) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    // 保存前强制执行数据规则
    enforceTimelineRules(req.body);

    // Write JSON file with 2-space indentation
    fs.writeFileSync(timelinePath, JSON.stringify(req.body, null, 2));
    console.log(`Timeline saved: ${domain}`);
    res.json({ success: true });
  } catch (e) {
    console.error('Save timeline error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
