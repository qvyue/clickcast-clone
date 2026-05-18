/**
 * 视频质量检测工具
 *
 * 检测视频体验问题：
 * 1. 截图重复
 * 2. 文案与截图不匹配
 * 3. 颜色对比度问题
 * 4. 场景数量是否合理
 */

const fs = require('fs');
const path = require('path');

/**
 * 检测 timeline.json 的质量问题
 */
function detectTimelineIssues(timelinePath) {
  const issues = [];
  const warnings = [];
  const suggestions = [];

  if (!fs.existsSync(timelinePath)) {
    return { error: 'timeline.json 不存在', issues: [], warnings: [], suggestions: [] };
  }

  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));

  // 1. 检测截图重复
  const screenshotUsage = {};
  const screenshotTypes = {}; // 记录每个截图的类型

  timeline.scenes.forEach((scene, index) => {
    if (scene.img) {
      if (!screenshotUsage[scene.img]) {
        screenshotUsage[scene.img] = [];
        // 尝试从 scraped.json 获取截图类型
      }
      screenshotUsage[scene.img].push({
        sceneId: scene.id,
        sceneIndex: index,
        title: scene.title
      });
    }
  });

  // 报告重复的截图
  const duplicateScreenshots = Object.entries(screenshotUsage)
    .filter(([img, uses]) => uses.length > 1);

  if (duplicateScreenshots.length > 0) {
    duplicateScreenshots.forEach(([img, uses]) => {
      issues.push({
        type: 'DUPLICATE_SCREENSHOT',
        severity: 'HIGH',
        screenshot: img,
        usedIn: uses.map(u => `${u.sceneId}("${u.title}")`).join(', '),
        message: `截图 ${img} 被重复使用在 ${uses.length} 个场景中`
      });
    });
  }

  // 2. 检测场景数量
  const sceneCount = timeline.scenes.length;
  if (sceneCount < 3) {
    warnings.push({
      type: 'TOO_FEW_SCENES',
      message: `场景数量过少 (${sceneCount}个)，建议 4-6 个场景`
    });
  } else if (sceneCount > 8) {
    warnings.push({
      type: 'TOO_MANY_SCENES',
      message: `场景数量过多 (${sceneCount}个)，视频可能过长`
    });
  }

  // 3. 检测文案长度
  timeline.scenes.forEach((scene, index) => {
    if (scene.title) {
      const titleWords = scene.title.split(/\s+/).length;
      if (titleWords > 8) {
        warnings.push({
          type: 'LONG_TITLE',
          scene: scene.id,
          message: `场景 "${scene.id}" 标题过长 (${titleWords} 词): "${scene.title}"`
        });
      }
    }

    if (scene.subText) {
      const subTextWords = scene.subText.split(/\s+/).length;
      if (subTextWords > 15) {
        warnings.push({
          type: 'LONG_SUBTEXT',
          scene: scene.id,
          message: `场景 "${scene.id}" 副标题过长 (${subTextWords} 词)`
        });
      }
    }
  });

  // 4. 检测颜色对比度
  if (timeline.style?.colors) {
    const colors = timeline.style.colors;

    // 计算按钮文字颜色（与 VidGenVideo/ClickCastVideo.tsx 逻辑一致）
    const primaryLum = getLuminance(colors.primary || '#000000');
    const secondaryLum = getLuminance(colors.secondary || '#000000');
    const avgButtonLum = (primaryLum + secondaryLum) / 2;
    // 按钮文字颜色是动态计算的
    const buttonTextColor = avgButtonLum > 128 ? '#000000' : '#FFFFFF';
    const buttonTextLum = getLuminance(buttonTextColor);

    // 检测按钮对比度：如果背景亮度接近临界值(120-140)，可能会有对比度问题
    if (avgButtonLum >= 120 && avgButtonLum <= 140) {
      suggestions.push({
        type: 'BUTTON_CONTRAST_EDGE',
        message: `按钮背景亮度接近临界值(${Math.round(avgButtonLum)})，可能存在对比度边界情况`
      });
    }

    // 检测背景与文字对比度
    const bgLum = getLuminance(colors.background || '#000000');
    const textLum = getLuminance(colors.text || '#FFFFFF');
    if (Math.abs(bgLum - textLum) < 100) {
      issues.push({
        type: 'LOW_CONTRAST',
        severity: 'HIGH',
        message: `背景与文字对比度不足：背景亮度 ${Math.round(bgLum)}，文字亮度 ${Math.round(textLum)}`
      });
    }
  }

  // 5. 检测截图与内容匹配度（需要 scraped.json）
  const scrapedPath = timelinePath.replace('timeline.json', 'scraped.json');
  if (fs.existsSync(scrapedPath)) {
    const scraped = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));

    if (scraped.screenshots && timeline.scenes) {
      // 检查是否有截图未被使用
      const usedScreenshots = new Set(timeline.scenes.map(s => s.img).filter(Boolean));
      const availableScreenshots = scraped.screenshots.map(s => s.file);

      const unusedScreenshots = availableScreenshots.filter(s => !usedScreenshots.has(s));
      if (unusedScreenshots.length > 0) {
        suggestions.push({
          type: 'UNUSED_SCREENSHOTS',
          message: `以下截图未被使用: ${unusedScreenshots.join(', ')}`,
          screenshots: unusedScreenshots
        });
      }

      // 检查使用的截图是否存在
      timeline.scenes.forEach(scene => {
        if (scene.img && !availableScreenshots.includes(scene.img)) {
          issues.push({
            type: 'MISSING_SCREENSHOT',
            severity: 'HIGH',
            scene: scene.id,
            message: `场景 "${scene.id}" 使用的截图 "${scene.img}" 不在可用截图列表中`
          });
        }
      });
    }
  }

  // 计算整体质量分数
  let score = 100;
  issues.forEach(issue => {
    if (issue.severity === 'HIGH') score -= 20;
    else if (issue.severity === 'MEDIUM') score -= 10;
    else score -= 5;
  });
  warnings.forEach(() => score -= 3);
  score = Math.max(0, score);

  return {
    score,
    issues,
    warnings,
    suggestions,
    summary: {
      totalScenes: timeline.scenes.length,
      uniqueScreenshots: Object.keys(screenshotUsage).length,
      duplicateCount: duplicateScreenshots.length,
      passed: issues.length === 0
    }
  };
}

/**
 * 计算颜色亮度
 */
function getLuminance(hex) {
  if (!hex || typeof hex !== 'string') return 128;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 128;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 自动修复截图重复问题
 */
function fixDuplicateScreenshots(timelinePath) {
  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
  const scrapedPath = timelinePath.replace('timeline.json', 'scraped.json');

  if (!fs.existsSync(scrapedPath)) {
    return { fixed: false, message: 'scraped.json 不存在，无法修复' };
  }

  const scraped = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
  const availableScreenshots = scraped.screenshots?.map(s => s.file) || [];

  if (availableScreenshots.length === 0) {
    return { fixed: false, message: '没有可用的截图' };
  }

  // 记录已使用的截图
  const usedScreenshots = new Set();
  let fixed = false;

  timeline.scenes.forEach((scene, index) => {
    if (scene.img) {
      if (usedScreenshots.has(scene.img)) {
        // 找一个未使用的截图
        const unusedScreenshot = availableScreenshots.find(s => !usedScreenshots.has(s));
        if (unusedScreenshot) {
          console.log(`   🔧 修复: ${scene.id} 的截图从 ${scene.img} 改为 ${unusedScreenshot}`);
          scene.img = unusedScreenshot;
          usedScreenshots.add(unusedScreenshot);
          fixed = true;
        }
      } else {
        usedScreenshots.add(scene.img);
      }
    }
  });

  if (fixed) {
    fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
    return { fixed: true, message: '已修复截图重复问题' };
  }

  return { fixed: false, message: '没有需要修复的问题' };
}

/**
 * 检测网站目录下的视频质量
 */
function checkWebsiteVideoQuality(websiteDir) {
  const timelinePath = path.join(websiteDir, 'public', 'timeline.json');
  const videoPath = path.join(websiteDir, 'out', 'landscape.mp4');

  console.log('\n========================================');
  console.log('   视频质量检测报告');
  console.log('========================================\n');

  // 检测 timeline.json
  console.log('📋 检测 timeline.json...');
  const result = detectTimelineIssues(timelinePath);

  console.log(`\n📊 质量评分: ${result.score}/100`);
  console.log(`   场景数量: ${result.summary.totalScenes}`);
  console.log(`   独立截图: ${result.summary.uniqueScreenshots}`);
  console.log(`   重复截图: ${result.summary.duplicateCount}`);

  if (result.issues.length > 0) {
    console.log('\n❌ 问题列表:');
    result.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. [${issue.severity}] ${issue.type}`);
      console.log(`      ${issue.message}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    result.warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning.message}`);
    });
  }

  if (result.suggestions.length > 0) {
    console.log('\n💡 建议:');
    result.suggestions.forEach((suggestion, i) => {
      console.log(`   ${i + 1}. ${suggestion.message}`);
    });
  }

  // 检测视频文件
  if (fs.existsSync(videoPath)) {
    const stats = fs.statSync(videoPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`\n🎥 视频文件: landscape.mp4 (${sizeMB} MB)`);
  } else {
    console.log('\n🎥 视频文件: 不存在');
  }

  console.log('\n========================================');

  return result;
}

// 命令行接口
if (require.main === module) {
  const websiteDir = process.argv[2];

  if (!websiteDir) {
    console.log('使用方法: node video-quality-checker.js <website-directory>');
    console.log('示例: node video-quality-checker.js ./websites/github.com');
    process.exit(1);
  }

  const result = checkWebsiteVideoQuality(websiteDir);

  // 自动修复选项
  if (result.issues.some(i => i.type === 'DUPLICATE_SCREENSHOT')) {
    console.log('\n🔧 尝试自动修复截图重复问题...');
    const fixResult = fixDuplicateScreenshots(path.join(websiteDir, 'public', 'timeline.json'));
    console.log(`   ${fixResult.message}`);
  }
}

module.exports = {
  detectTimelineIssues,
  fixDuplicateScreenshots,
  checkWebsiteVideoQuality,
  getLuminance
};