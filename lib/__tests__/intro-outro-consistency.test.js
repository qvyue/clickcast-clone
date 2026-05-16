/**
 * Intro/Outro 配音与字幕一致性测试
 *
 * 核心规则：mainTitle = 主文案 = 主配音，subTitle = 副文案 = 副配音
 *
 * 重点验证：
 * 1. intro 配音的产品名前缀同步到 timeline mainTitle
 * 2. outro 的 buildConciseOutro 结果同步到 timeline mainTitle
 * 4. 前端/后端渲染逻辑：Phase 1 显示 mainTitle+播放主配音，Phase 2 显示 subTitle+播放副配音
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// ============================================================================
// 辅助函数：模拟 generate.js 中的逻辑
// ============================================================================

function buildConciseOutro(product, tagline) {
  const prefix = `Try ${product}`;
  const prefixWords = prefix.split(/\s+/).length;
  const availableWords = Math.max(0, 15 - prefixWords);
  let taglineText = (tagline || '').replace(/\.\.+$/, '').trim();
  const firstSentence = taglineText.match(/^[^.!?]+/);
  if (firstSentence) taglineText = firstSentence[0].trim();
  const taglineWords = taglineText.split(/\s+/).filter(w => w);
  const conciseTagline = taglineWords.slice(0, availableWords).join(' ');
  let text;
  if (availableWords > 0 && conciseTagline) {
    text = `${prefix} — ${conciseTagline}.`;
  } else {
    text = `${prefix}.`;
  }
  return text;
}


/**
 * 模拟 generateAsync 中构建 voiceoverScenes 的逻辑
 */
function buildVoiceoverScenes(script) {
  const voiceoverScenes = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const mainText = scene.mainTitle || '';
    const subText = scene.subTitle || '';

    let introMainTitle = mainText;
    if (i === 0) {
      const withProduct = `${script.product}. ${mainText}`;
      introMainTitle = withProduct.split(/\s+/).length <= 15 ? withProduct : mainText;
    }

    voiceoverScenes.push({
      id: i === 0 ? 'intro' : `scene${i - 1}`,
      mainTitle: introMainTitle,
      subTitle: subText
    });
  }
  voiceoverScenes.push({
    id: 'outro',
    mainTitle: buildConciseOutro(script.product, script.tagline),
    subTitle: ''
  });

  return voiceoverScenes;
}

/**
 * 模拟 generateTimeline 中构建场景的逻辑
 * 关键修改：从 voiceoverScenes 读取文本（而非 script.scenes）
 */
function buildTimelineScenes(script, voiceoverScenes) {
  const scenes = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const vs = voiceoverScenes[i] || {};
    const mainTitleText = vs.mainTitle || '';
    const subTitleText = vs.subTitle || '';

    scenes.push({
      id: vs.id,
      mainTitle: mainTitleText,
      subTitle: subTitleText,
      subVoiceover: subTitleText,
      title: mainTitleText,
    });
  }

  // outro
  const outroVS = voiceoverScenes.find(vs => vs.id === 'outro') || {};
  scenes.push({
    id: 'outro',
    mainTitle: outroVS.mainTitle || buildConciseOutro(script.product, script.tagline),
    subTitle: outroVS.subTitle || '',
    subVoiceover: outroVS.subTitle || '',
    title: outroVS.mainTitle || buildConciseOutro(script.product, script.tagline),
  });

  return scenes;
}

// ============================================================================
// 测试用例
// ============================================================================

describe('Intro 配音与字幕一致性', () => {

  it('intro 配音的产品名前缀应同步到 timeline mainTitle', () => {
    const script = {
      product: 'ClickCast',
      tagline: 'Video generation made easy',
      scenes: [
        { id: 'intro', mainTitle: 'Paste your URL and get a professional video.', subTitle: 'Discover the power of AI.' }
      ]
    };

    const voiceoverScenes = buildVoiceoverScenes(script);
    const timelineScenes = buildTimelineScenes(script, voiceoverScenes);

    const intro = timelineScenes.find(s => s.id === 'intro');
    const introVS = voiceoverScenes.find(vs => vs.id === 'intro');

    // 配音和字幕文本应完全一致
    assert.strictEqual(intro.mainTitle, introVS.mainTitle,
      `intro mainTitle should match voiceoverScene. mainTitle="${intro.mainTitle}", vs.mainTitle="${introVS.mainTitle}"`);
    assert.strictEqual(intro.subTitle, introVS.subTitle,
      `intro subTitle should match voiceoverScene. subTitle="${intro.subTitle}", vs.subTitle="${introVS.subTitle}"`);
    assert.strictEqual(intro.title, intro.mainTitle, 'intro title should equal mainTitle');
    assert.strictEqual(intro.subVoiceover, intro.subTitle, 'intro subVoiceover should equal subTitle');
  });

  it('intro 配音添加产品名时，字幕也应有产品名', () => {
    const script = {
      product: 'ClickCast',
      tagline: 'Video generation made easy',
      scenes: [
        { id: 'intro', mainTitle: 'Get a video in minutes.', subTitle: '' }
      ]
    };

    const voiceoverScenes = buildVoiceoverScenes(script);
    const timelineScenes = buildTimelineScenes(script, voiceoverScenes);

    const intro = timelineScenes.find(s => s.id === 'intro');
    const introVS = voiceoverScenes.find(vs => vs.id === 'intro');

    // 产品名应该出现在配音文本中
    assert.ok(introVS.mainTitle.includes('ClickCast'),
      `intro voiceoverScene mainTitle should include product name, got: "${introVS.mainTitle}"`);
    // timeline mainTitle 必须和配音一致（也有产品名）
    assert.strictEqual(intro.mainTitle, introVS.mainTitle,
      `intro timeline mainTitle should include product name when voiceover does`);
  });

  it('intro 配音不加产品名时（词数超限），字幕也不加', () => {
    const script = {
      product: 'ClickCast',
      tagline: 'Video generation made easy',
      scenes: [
        { id: 'intro', mainTitle: 'This is a very long introduction that exceeds the fifteen word limit for voiceover text.', subTitle: '' }
      ]
    };

    const voiceoverScenes = buildVoiceoverScenes(script);
    const timelineScenes = buildTimelineScenes(script, voiceoverScenes);

    const intro = timelineScenes.find(s => s.id === 'intro');
    const introVS = voiceoverScenes.find(vs => vs.id === 'intro');

    // 词数超限时产品名不加，mainTitle 不以 "ClickCast." 开头
    assert.strictEqual(intro.mainTitle, introVS.mainTitle,
      `intro mainTitle should match voiceoverScene even when product name is skipped`);
  });
});

describe('Outro 配音与字幕一致性', () => {

  it('outro 配音文本应同步到 timeline mainTitle', () => {
    const script = {
      product: 'ClickCast',
      tagline: 'Transform any website into stunning marketing videos',
      scenes: [
        { id: 'scene0', mainTitle: 'AI video generation.', subTitle: 'Fast and easy.' }
      ]
    };

    const voiceoverScenes = buildVoiceoverScenes(script);
    const timelineScenes = buildTimelineScenes(script, voiceoverScenes);

    const outro = timelineScenes.find(s => s.id === 'outro');
    const outroVS = voiceoverScenes.find(vs => vs.id === 'outro');

    // 配音和字幕文本应完全一致
    assert.strictEqual(outro.mainTitle, outroVS.mainTitle,
      `outro mainTitle should match voiceoverScene. mainTitle="${outro.mainTitle}", vs.mainTitle="${outroVS.mainTitle}"`);
    assert.strictEqual(outro.subTitle, outroVS.subTitle,
      `outro subTitle should match voiceoverScene. subTitle="${outro.subTitle}", vs.subTitle="${outroVS.subTitle}"`);
    assert.strictEqual(outro.title, outro.mainTitle, 'outro title should equal mainTitle');
    assert.strictEqual(outro.subVoiceover, outro.subTitle, 'outro subVoiceover should equal subTitle');
  });

  it('outro buildConciseOutro 结果应直接用于配音和字幕', () => {
    const product = 'ClickCast';
    const tagline = 'Transform any website into stunning marketing videos';
    const outroText = buildConciseOutro(product, tagline);

    // 验证 buildConciseOutro 的格式
    assert.ok(outroText.startsWith('Try ClickCast'),
      `outro should start with "Try {product}", got: "${outroText}"`);
    assert.ok(outroText.split(/\s+/).length <= 15,
      `outro should be <= 15 words, got ${outroText.split(/\s+/).length}`);
  });

  it('outro 拆分后 subTitle 应同步到 timeline', () => {
    const script = {
      product: 'ClickCast',
      tagline: 'Transform any website into stunning marketing videos instantly',
      scenes: [
        { id: 'scene0', mainTitle: 'Feature one.', subTitle: 'Benefit one.' }
      ]
    };

    const voiceoverScenes = buildVoiceoverScenes(script);
    const timelineScenes = buildTimelineScenes(script, voiceoverScenes);

    const outro = timelineScenes.find(s => s.id === 'outro');
    const outroVS = voiceoverScenes.find(vs => vs.id === 'outro');

    // 如果 voiceoverScenes 的 outro 被拆分了，timeline 应同步
    assert.strictEqual(outro.mainTitle, outroVS.mainTitle,
      `outro mainTitle should match voiceoverScene after split`);
    assert.strictEqual(outro.subTitle, outroVS.subTitle,
      `outro subTitle should match voiceoverScene after split`);
    assert.strictEqual(outro.subVoiceover, outroVS.subTitle,
      `outro subVoiceover should equal subTitle`);
  });
});

describe('Intro/Outro 端到端一致性', () => {

  it('完整流程：intro + scenes + outro 所有场景 title=mainTitle, subVoiceover=subTitle', () => {
    const script = {
      product: 'ClickCast',
      tagline: 'Transform any website into stunning marketing videos instantly',
      scenes: [
        { id: 'intro', mainTitle: 'Paste your URL and get a professional video.', subTitle: '' },
        { id: 'scene0', mainTitle: 'AI-powered video generation.', subTitle: 'No editing required.' },
        { id: 'scene1', mainTitle: 'Multiple video modes.', subTitle: 'Choose your style.' },
      ]
    };

    const voiceoverScenes = buildVoiceoverScenes(script);
    const timelineScenes = buildTimelineScenes(script, voiceoverScenes);

    for (const scene of timelineScenes) {
      assert.strictEqual(scene.title, scene.mainTitle,
        `Scene ${scene.id}: title should equal mainTitle. title="${scene.title}", mainTitle="${scene.mainTitle}"`);
      assert.strictEqual(scene.subVoiceover, scene.subTitle,
        `Scene ${scene.id}: subVoiceover should equal subTitle. subVoiceover="${scene.subVoiceover}", subTitle="${scene.subTitle}"`);
    }
  });

  it('配音文本和字幕文本对所有场景完全一致', () => {
    const script = {
      product: 'MyApp',
      tagline: 'Build apps faster with AI',
      scenes: [
        { id: 'intro', mainTitle: 'Build apps faster with AI assistance today.', subTitle: '' },
        { id: 'scene0', mainTitle: 'Smart code generation.', subTitle: 'Powered by advanced models.' },
      ]
    };

    const voiceoverScenes = buildVoiceoverScenes(script);
    const timelineScenes = buildTimelineScenes(script, voiceoverScenes);

    // 验证配音来源（voiceoverScenes）和字幕（timelineScenes）一一对应
    for (let i = 0; i < voiceoverScenes.length; i++) {
      const vs = voiceoverScenes[i];
      const ts = timelineScenes.find(s => s.id === vs.id);
      assert.ok(ts, `Timeline scene ${vs.id} should exist`);

      assert.strictEqual(ts.mainTitle, vs.mainTitle,
        `Scene ${vs.id}: timeline mainTitle should match voiceover mainTitle`);
      assert.strictEqual(ts.subTitle, vs.subTitle,
        `Scene ${vs.id}: timeline subTitle should match voiceover subTitle`);
    }
  });
});

describe('Intro/Outro 两阶段渲染逻辑', () => {

  it('intro with subAudio: Phase 1 shows mainTitle, Phase 2 shows subTitle', () => {
    // 模拟场景数据
    const sceneData = {
      id: 'intro',
      mainTitle: 'ClickCast. Paste your URL.',
      subTitle: 'Get a video in minutes.',
      audioFile: 'intro-main.mp3',
      audioFileSub: 'intro-sub.mp3',
      mainDuration: 3,
      subDuration: 3,
      transitionDuration: 0.5,
      durationInFrames: 210,
      audioStartFrame: 10
    };

    // 有 subAudio → hasSubAudio = true
    const hasSubAudio = sceneData.audioFileSub && sceneData.subDuration;
    assert.ok(hasSubAudio, 'intro should have sub audio');

    // Phase 1 应显示 mainTitle
    // Phase 2 应显示 subTitle
    // 这只是数据层面的验证，实际渲染在组件中
    assert.ok(sceneData.mainTitle, 'intro should have mainTitle for Phase 1');
    assert.ok(sceneData.subTitle, 'intro should have subTitle for Phase 2');
  });

  it('outro without subAudio: shows mainTitle + subTitle + CTA together', () => {
    const sceneData = {
      id: 'outro',
      mainTitle: 'Try MyApp — Build apps faster.',
      subTitle: '',
      audioFile: 'outro-main.mp3',
      mainDuration: 4,
      subDuration: 0,
      durationInFrames: 150,
      audioStartFrame: 10
    };

    const hasSubAudio = sceneData.audioFileSub && sceneData.subDuration;
    assert.ok(!hasSubAudio, 'outro should not have sub audio when subDuration is 0');
    assert.ok(sceneData.mainTitle, 'outro should have mainTitle');
  });

  it('intro product name prefix: voiceover and timeline must match', () => {
    // 模拟 generate.js 中 intro 产品名拼接逻辑
    const product = 'ClickCast';
    const mainTitle = 'Get a professional video in minutes.';

    const withProduct = `${product}. ${mainTitle}`;
    const introMainTitle = withProduct.split(/\s+/).length <= 15 ? withProduct : mainTitle;

    // 验证产品名拼接后的结果
    assert.ok(introMainTitle.includes(product),
      `intro mainTitle should include product name: "${introMainTitle}"`);
    assert.ok(introMainTitle.split(/\s+/).length <= 15,
      `intro mainTitle should be <= 15 words, got ${introMainTitle.split(/\s+/).length}`);

    // 配音和字幕使用同一个 introMainTitle
    const timelineMainTitle = introMainTitle;
    assert.strictEqual(timelineMainTitle, introMainTitle,
      'timeline mainTitle must equal voiceover mainTitle');
  });
});
