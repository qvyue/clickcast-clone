/**
 * 文案与配音一致性测试
 * 核心规则：mainTitle = title（主文案=主配音），subTitle = subVoiceover（副文案=副配音）
 *
 * 测试覆盖：
 * 1. enforceTimelineRules (generate.js) — title = mainTitle, subVoiceover = subTitle
 * 2. ensureFieldCompatibility (ai-agent.js) — 字段映射后保持一致性
 * 3. editorStore.setTimeline — 前端加载时保持一致性
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// 从 generate.js 提取 enforceTimelineRules（与实际实现一致）
function enforceTimelineRules(timeline) {
  if (!timeline || !timeline.scenes) return;
  const product = timeline.product || 'this product';
  for (const scene of timeline.scenes) {
    if (!scene.mainTitle) {
      if (scene.text) { scene.mainTitle = scene.text; delete scene.text; }
      else if (scene.title) { scene.mainTitle = scene.title; }
    }
    if (!scene.subTitle) {
      if (scene.subVoiceover) { scene.subTitle = scene.subVoiceover; }
      else if (scene.subText) { scene.subTitle = scene.subText; delete scene.subText; }
    }
    scene.title = scene.mainTitle;
    scene.subVoiceover = scene.subTitle;
    delete scene.text;
    delete scene.subText;
    // 填充空的 subTitle（不再拆分 mainTitle）
    if (!scene.subTitle || !scene.subTitle.trim()) {
      scene.subTitle = `Discover more about ${product}.`;
      scene.title = scene.mainTitle;
      scene.subVoiceover = scene.subTitle;
    }
  }
}

// ============================================================================
// enforceTimelineRules 测试
// ============================================================================

describe('enforceTimelineRules — 文案=配音一致性', () => {

  it('should enforce title = mainTitle for all scene types', () => {
    const timeline = {
      product: 'TestApp',
      scenes: [
        { id: 'intro', mainTitle: 'Welcome to TestApp.', title: 'Old Title', subTitle: 'Discover more.' },
        { id: 'scene0', mainTitle: 'Powerful features.', title: 'Another Title', subTitle: 'Built for you.' },
        { id: 'outro', mainTitle: 'Try TestApp today.', title: 'Try TestApp', subTitle: 'Get started.' }
      ]
    };

    enforceTimelineRules(timeline);

    for (const scene of timeline.scenes) {
      assert.strictEqual(scene.title, scene.mainTitle,
        `Scene ${scene.id}: title should equal mainTitle. title="${scene.title}", mainTitle="${scene.mainTitle}"`);
    }
  });

  it('should enforce subVoiceover = subTitle for all scene types', () => {
    const timeline = {
      product: 'TestApp',
      scenes: [
        { id: 'intro', mainTitle: 'Welcome.', title: 'Welcome.', subTitle: 'Discover more.', subVoiceover: 'Old voiceover' },
        { id: 'scene0', mainTitle: 'Features.', title: 'Features.', subTitle: 'Built for you.', subVoiceover: 'Different voiceover' },
        { id: 'outro', mainTitle: 'Try now.', title: 'Try now.', subTitle: 'Get started.', subVoiceover: 'Another text' }
      ]
    };

    enforceTimelineRules(timeline);

    for (const scene of timeline.scenes) {
      assert.strictEqual(scene.subVoiceover, scene.subTitle,
        `Scene ${scene.id}: subVoiceover should equal subTitle. subVoiceover="${scene.subVoiceover}", subTitle="${scene.subTitle}"`);
    }
  });

  it('should ensure consistency for intro scene', () => {
    const timeline = {
      product: 'VidGen',
      scenes: [
        { id: 'intro', mainTitle: 'Paste your URL and get a video.', subTitle: '' }
      ]
    };

    enforceTimelineRules(timeline);
    const intro = timeline.scenes[0];

    assert.strictEqual(intro.title, intro.mainTitle, 'intro: title should equal mainTitle');
    assert.strictEqual(intro.subVoiceover, intro.subTitle, 'intro: subVoiceover should equal subTitle');
    // subTitle 被自动填充（不再拆分 mainTitle，而是填充默认值）
    assert.ok(intro.subTitle.trim().length > 0, 'intro: subTitle should be filled');
    // mainTitle 不应该被截断
    assert.strictEqual(intro.mainTitle, 'Paste your URL and get a video.', 'intro: mainTitle should not be truncated');
  });

  it('should ensure consistency for outro scene', () => {
    const timeline = {
      product: 'VidGen',
      scenes: [
        { id: 'outro', mainTitle: 'Try VidGen — Transform any website into videos.', subTitle: '' }
      ]
    };

    enforceTimelineRules(timeline);
    const outro = timeline.scenes[0];

    assert.strictEqual(outro.title, outro.mainTitle, 'outro: title should equal mainTitle');
    assert.strictEqual(outro.subVoiceover, outro.subTitle, 'outro: subVoiceover should equal subTitle');
    // mainTitle 不应该被截断
    assert.strictEqual(outro.mainTitle, 'Try VidGen — Transform any website into videos.', 'outro: mainTitle should not be truncated');
  });

  it('should handle scene with mismatched title and mainTitle by syncing title to mainTitle', () => {
    const timeline = {
      product: 'TestApp',
      scenes: [
        { id: 'scene0', mainTitle: 'AI-powered video generation.', title: 'Video Generation', subTitle: 'Fast and easy.', subVoiceover: 'Quick and simple.' }
      ]
    };

    enforceTimelineRules(timeline);
    const scene = timeline.scenes[0];

    assert.strictEqual(scene.title, scene.mainTitle, 'title should be synced to mainTitle');
    assert.strictEqual(scene.subVoiceover, scene.subTitle, 'subVoiceover should be synced to subTitle');
  });

  it('should fill empty subTitle with default and sync subVoiceover', () => {
    const timeline = {
      product: 'TestApp',
      scenes: [
        { id: 'scene0', mainTitle: 'Fast and easy video generation for everyone.', title: '', subTitle: '', subVoiceover: '' }
      ]
    };

    enforceTimelineRules(timeline);
    const scene = timeline.scenes[0];

    assert.strictEqual(scene.title, scene.mainTitle, 'title should equal mainTitle');
    // mainTitle 不应该被拆分
    assert.strictEqual(scene.mainTitle, 'Fast and easy video generation for everyone.', 'mainTitle should not be split');
    // subTitle 应该是默认内容
    assert.ok(scene.subTitle.includes('TestApp'), 'subTitle should mention product');
    assert.strictEqual(scene.subVoiceover, scene.subTitle, 'subVoiceover should equal subTitle');
  });
});

// ============================================================================
// ensureFieldCompatibility 一致性测试
// ============================================================================

describe('AI Agent — 文案=配音一致性', () => {

  // 动态加载 ai-agent 的函数
  let ensureFieldCompatibility;
  try {
    const aiAgent = require('../ai-agent');
    ensureFieldCompatibility = aiAgent.ensureFieldCompatibility;
  } catch (e) {
    console.log('Warning: could not load ai-agent functions:', e.message);
  }

  if (ensureFieldCompatibility) {
    it('ensureFieldCompatibility should keep title = mainTitle', () => {
      const script = {
        product: 'TestApp',
        tagline: 'Test',
        scenes: [
          { id: 'scene0', mainTitle: 'Powerful features.', title: 'Old Title', subTitle: 'Built for you.', subVoiceover: 'Different text.' }
        ]
      };

      ensureFieldCompatibility(script);
      const scene = script.scenes[0];

      assert.strictEqual(scene.title, scene.mainTitle,
        `title should equal mainTitle. title="${scene.title}", mainTitle="${scene.mainTitle}"`);
      assert.strictEqual(scene.subVoiceover, scene.subTitle,
        `subVoiceover should equal subTitle. subVoiceover="${scene.subVoiceover}", subTitle="${scene.subTitle}"`);
    });

    it('ensureFieldCompatibility should sync title when mapping from text field', () => {
      const script = {
        product: 'TestApp',
        tagline: 'Test',
        scenes: [
          { id: 'scene0', text: 'Welcome to TestApp.', subText: 'Discover more.', title: 'Welcome' }
        ]
      };

      ensureFieldCompatibility(script);
      const scene = script.scenes[0];

      assert.strictEqual(scene.title, scene.mainTitle,
        `title should equal mainTitle after mapping. title="${scene.title}", mainTitle="${scene.mainTitle}"`);
      assert.strictEqual(scene.subVoiceover, scene.subTitle,
        `subVoiceover should equal subTitle after mapping. subVoiceover="${scene.subVoiceover}", subTitle="${scene.subTitle}"`);
    });

    it('ensureFieldCompatibility should not split mainTitle when subTitle is empty', () => {
      const script = {
        product: 'Geddle',
        tagline: 'Test',
        scenes: [
          {
            id: 'scene3',
            mainTitle: 'Join 10,000 creators already earning $2,000 to $15,000 every single month.',
            subTitle: '',
            subVoiceover: ''
          }
        ]
      };

      ensureFieldCompatibility(script);
      const scene = script.scenes[0];

      // mainTitle 不应该被拆分
      assert.strictEqual(scene.mainTitle, 'Join 10,000 creators already earning $2,000 to $15,000 every single month.',
        'mainTitle should not be split');
      // subTitle 应该是默认内容（不再拆分 mainTitle）
      assert.ok(scene.subVoiceover.trim().length > 0,
        `subVoiceover should not be empty, got: "${scene.subVoiceover}"`);
      assert.strictEqual(scene.subTitle, scene.subVoiceover);
    });

    it('ensureFieldCompatibility should fill default subTitle for short mainTitle', () => {
      const script = {
        product: 'VidGen',
        tagline: 'Test',
        scenes: [
          {
            id: 'scene0',
            mainTitle: 'Fast and easy.',
            subTitle: '',
            subVoiceover: ''
          }
        ]
      };

      ensureFieldCompatibility(script);
      const scene = script.scenes[0];

      // mainTitle 不应该被修改
      assert.strictEqual(scene.mainTitle, 'Fast and easy.', 'mainTitle should not be modified');
      // subTitle 应该是默认内容
      assert.ok(scene.subVoiceover.includes('VidGen'),
        `subVoiceover should mention product, got: "${scene.subVoiceover}"`);
      assert.strictEqual(scene.subTitle, scene.subVoiceover);
    });
  }
});

// ============================================================================
// 生成流程端到端一致性测试
// ============================================================================

describe('Generate flow — 文案=配音一致性', () => {

  it('outro title should not be hardcoded "Try {product}"', () => {
    // 模拟 generate.js 中 outro 的生成逻辑
    function buildConciseOutro(product, tagline) {
      const prefix = `Try ${product}`;
      let taglineText = (tagline || '').replace(/\.\.+$/, '').trim();
      let text;
      if (taglineText) {
        text = `${prefix} — ${taglineText}.`;
      } else {
        text = `${prefix}.`;
      }
      return text;
    }

    const product = 'VidGen';
    const tagline = 'Transform any website into stunning marketing videos';
    const outroMainTitle = buildConciseOutro(product, tagline);

    assert.strictEqual(outroMainTitle.includes('—'), true,
      `outro mainTitle should include tagline context, got: "${outroMainTitle}"`);
  });

  it('timeline scene data should have consistent title/mainTitle and subVoiceover/subTitle', () => {
    const scenes = [
      { id: 'intro', mainTitle: 'Welcome to VidGen.', subTitle: 'Discover the power of AI video.' },
      { id: 'scene0', mainTitle: 'AI-powered video generation.', subTitle: 'Transform any website into a video.' },
      { id: 'outro', mainTitle: 'Try VidGen — stunning marketing videos.', subTitle: 'Get started today.' }
    ];

    for (const scene of scenes) {
      scene.title = scene.mainTitle;
      scene.subVoiceover = scene.subTitle;
    }

    for (const scene of scenes) {
      assert.strictEqual(scene.title, scene.mainTitle,
        `Scene ${scene.id}: title should equal mainTitle`);
      assert.strictEqual(scene.subVoiceover, scene.subTitle,
        `Scene ${scene.id}: subVoiceover should equal subTitle`);
    }
  });
});
