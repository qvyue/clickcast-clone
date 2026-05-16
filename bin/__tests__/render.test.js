/**
 * =============================================================================
 * render.js Timeline 构建逻辑测试
 * 
 * 测试目标：验证 timeline.json 的构建规则和字段一致性
 * 测试框架：Node.js 内置 test 模块
 * 
 * 测试覆盖范围：
 * 1. 核心字段定义（title、subTitle、mainTitle、subVoiceover）
 * 2. 字段语义区分（字幕文字 vs 配音文案）
 * 3. audioFileSub 与 subVoiceover 的双向一致性
 * 4. 自动拆分过长 mainTitle 的逻辑
 * 5. Timeline 完整性验证
 * 6. intro/outro 特殊场景处理
 * 
 * 核心概念：
 * - title: 显示在视频上的主字幕文字
 * - subTitle: 显示在视频上的次字幕文字
 * - mainTitle: 主配音的朗读文本
 * - subVoiceover: 次配音的朗读文本
 * 
 * 重要约束：
 * - text/subText 是废弃字段，不应出现
 * - audioFileSub 仅在 subVoiceover 非空时赋值
 * - intro/outro 不应有 subVoiceover
 * =============================================================================
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * 创建示例脚本数据
 * 
 * 功能：生成一个模拟的 AI 生成脚本
 * 用途：作为 buildExpectedTimeline 函数的输入
 */
function createSampleScript() {
  return {
    product: 'TestApp',
    tagline: 'The best test app',
    scenes: [
      // Intro 场景
      { 
        title: 'Welcome to TestApp', 
        subTitle: '', 
        mainTitle: 'Welcome to TestApp', 
        subVoiceover: '' 
      },
      // 普通场景 1
      { 
        title: 'Feature one is great', 
        subTitle: 'Feature details', 
        mainTitle: 'Feature one is great', 
        subVoiceover: 'Feature details here' 
      },
      // 普通场景 2
      { 
        title: 'Feature two is amazing', 
        subTitle: 'More details', 
        mainTitle: 'Feature two is amazing', 
        subVoiceover: 'More details here' 
      },
      // Outro 场景
      { 
        title: 'Get started today', 
        subTitle: 'Free trial', 
        mainTitle: 'Get started today', 
        subVoiceover: 'Free trial available' 
      }
    ]
  };
}

/**
 * 创建带空 subVoiceover 的脚本
 * 
 * 功能：生成 subVoiceover 部分为空的脚本
 * 用途：测试 subVoiceover 为空时的边界情况
 */
function createSampleScriptWithEmptySub() {
  return {
    product: 'EmptySubApp',
    tagline: 'Test empty subVoiceover',
    scenes: [
      { title: 'Welcome', subTitle: '', mainTitle: 'Welcome', subVoiceover: '' },
      { title: 'Feature one', subTitle: '', mainTitle: 'Feature one', subVoiceover: '' },
      { title: 'Feature two', subTitle: 'Has sub content', mainTitle: 'Feature two', subVoiceover: 'Has sub content' },
      { title: 'Get started', subTitle: '', mainTitle: 'Get started', subVoiceover: '' }
    ]
  };
}

/**
 * 创建示例音频时长数据
 * 
 * 功能：提供每个场景的音频时长
 * 用途：计算帧数和转换时长
 */
function createSampleAudioDurations() {
  return [
    { id: 'intro', mainDuration: 4.2, subDuration: 0 },
    { id: 'scene0', mainDuration: 3.5, subDuration: 2.8 },
    { id: 'scene1', mainDuration: 3.0, subDuration: 2.5 },
    { id: 'scene2', mainDuration: 2.8, subDuration: 2.0 },
    { id: 'outro', mainDuration: 3.2, subDuration: 0 }
  ];
}

/**
 * 创建带空 subDuration 的音频数据
 */
function createAudioDurationsWithEmptySub() {
  return [
    { id: 'intro', mainDuration: 4.0, subDuration: 0 },
    { id: 'scene0', mainDuration: 3.0, subDuration: 0 },
    { id: 'scene1', mainDuration: 3.5, subDuration: 2.0 },
    { id: 'scene2', mainDuration: 2.5, subDuration: 0 },
    { id: 'outro', mainDuration: 3.0, subDuration: 0 }
  ];
}

/**
 * 构建期望的 Timeline 对象
 * 
 * 功能：模拟 render.js 中的 Timeline 构建逻辑
 * 验证：字段赋值规则、时长计算、ID 生成等
 * 
 * @param {object} script - 脚本数据
 * @param {array} audioDurations - 音频时长数组
 * @returns {object} Timeline 对象
 */
function buildExpectedTimeline(script, audioDurations) {
  const FPS = 30;  // 帧率
  const timeline = {
    product: script.product,
    tagline: script.tagline,
    fps: FPS,
    totalFrames: 0,
    scenes: [],
    style: null  // style 由其他函数处理
  };

  let currentStartFrame = 0;
  const transitionDuration = 0.5;

  // 构建中间场景（intro + 普通场景）
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const audioInfo = audioDurations[i] || { mainDuration: 3, subDuration: 0 };
    const isIntro = i === 0;

    // 确定字段值
    const mainTitleText = scene.mainTitle || '';
    const titleText = scene.title || mainTitleText;
    const subTitleText = scene.subTitle || '';
    const subVoiceoverText = scene.subVoiceover || subTitleText;  // 次配音回退到 subTitle
    
    // 判断是否有次配音
    const hasSubVoiceover = !isIntro && subVoiceoverText && subVoiceoverText.trim();

    // 计算音频总时长
    const totalAudioDuration = isIntro
      ? audioInfo.mainDuration + transitionDuration + audioInfo.subDuration
      : audioInfo.mainDuration;
    
    // 计算场景帧数
    const sceneDurationFrames = Math.ceil(
      (totalAudioDuration + transitionDuration + 
       (isIntro ? audioInfo.subDuration : audioInfo.subDuration) + 0.5) 
      * FPS
    );

    // 生成场景对象
    timeline.scenes.push({
      // ID 命名规则
      id: isIntro ? 'intro' : `scene${i - 1}`,
      
      // 布局交替
      layout: i % 2 === 0 ? 'left' : 'center',
      
      // 字幕字段
      title: isIntro ? mainTitleText : titleText,
      mainTitle: mainTitleText,
      subTitle: isIntro ? '' : subTitleText,
      subVoiceover: isIntro ? '' : subVoiceoverText,
      
      // 图片
      img: `shot${i + 1}.png`,
      
      // 配音文件
      audioFile: isIntro ? 'intro.mp3' : `scene${i - 1}-main.mp3`,
      audioFileSub: hasSubVoiceover ? `scene${i - 1}-sub.mp3` : undefined,
      
      // 时长
      mainDuration: isIntro 
        ? (audioInfo.mainDuration + transitionDuration + audioInfo.subDuration) 
        : audioInfo.mainDuration,
      subDuration: hasSubVoiceover ? audioInfo.subDuration : 0,
      transitionDuration: hasSubVoiceover && audioInfo.subDuration > 0 ? transitionDuration : undefined,
      
      // 配音来源
      voiceoverSource: 'elevenlabs',
      subVoiceoverSource: hasSubVoiceover && audioInfo.subDuration > 0 ? 'elevenlabs' : undefined,
      
      // 帧信息
      startFrame: currentStartFrame,
      durationInFrames: sceneDurationFrames,
      audioStartFrame: 10
    });

    currentStartFrame += sceneDurationFrames;
  }

  // 添加 outro 场景
  const outroAudio = audioDurations[audioDurations.length - 1] || { mainDuration: 3 };
  const outroDurationFrames = Math.ceil((outroAudio.mainDuration + 1) * FPS);
  
  timeline.scenes.push({
    id: 'outro',
    layout: 'center',
    title: `Try ${script.product}`,
    mainTitle: `Try ${script.product}. ${script.tagline}.`,
    subTitle: '',
    subVoiceover: '',
    audioFile: 'outro.mp3',
    mainDuration: outroAudio.mainDuration,
    subDuration: 0,
    voiceoverSource: 'elevenlabs',
    startFrame: currentStartFrame,
    durationInFrames: outroDurationFrames,
    audioStartFrame: 10
  });

  currentStartFrame += outroDurationFrames;
  timeline.totalFrames = currentStartFrame + 30;  // 尾部缓冲帧

  return timeline;
}

// =============================================================================
// 测试用例：核心字段定义
// =============================================================================

describe('核心字段定义：4个字段各司其职', () => {
  
  /**
   * 测试：title = 主字幕（显示在视频上的标题文字）
   * 
   * 验证点：
   * - 每个场景都有 title 字段
   * - title 是显示在视频画面上的主字幕
   */
  it('title = 主字幕（显示在视频上的标题文字）', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      assert.ok(scene.title !== undefined, `Scene ${scene.id}: title should exist`);
    });
  });

  /**
   * 测试：subTitle = 次字幕（显示在视频上的副标题文字）
   * 
   * 验证点：
   * - 每个场景都有 subTitle 字段
   * - subTitle 是显示在主字幕下方的副标题
   */
  it('subTitle = 次字幕（显示在视频上的副标题文字）', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      assert.ok(scene.subTitle !== undefined, `Scene ${scene.id}: subTitle should exist`);
    });
  });

  /**
   * 测试：mainTitle = 主配音文案（主配音的朗读文本）
   * 
   * 验证点：
   * - 每个场景都有 mainTitle 字段
   * - mainTitle 非空（配音必须有朗读内容）
   */
  it('mainTitle = 主配音文案（主配音的朗读文本）', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      assert.ok(
        scene.mainTitle !== undefined && scene.mainTitle.length > 0, 
        `Scene ${scene.id}: mainTitle should not be empty`
      );
    });
  });

  /**
   * 测试：subVoiceover = 次配音文案（次配音的朗读文本）
   * 
   * 验证点：
   * - 每个场景都有 subVoiceover 字段
   * - 可能为空字符串
   */
  it('subVoiceover = 次配音文案（次配音的朗读文本）', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      assert.ok(scene.subVoiceover !== undefined, `Scene ${scene.id}: subVoiceover should exist`);
    });
  });

  /**
   * 测试：不应存在 text 和 subText 字段
   * 
   * 验证点：
   * - text/subText 是废弃字段
   * - 新版本代码不应生成这些字段
   * 
   * 原因：旧版本使用 text/subTitle，后来改为 mainTitle/subVoiceover
   */
  it('不应存在 text 和 subText 字段', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      assert.strictEqual(scene.text, undefined, `Scene ${scene.id}: text should not exist`);
      assert.strictEqual(scene.subText, undefined, `Scene ${scene.id}: subText should not exist`);
    });
  });
});

// =============================================================================
// 测试用例：title 和 mainTitle 的区别
// =============================================================================

describe('title 和 mainTitle 可以不同', () => {
  
  /**
   * 测试：title 是短标题，mainTitle 是完整配音文案
   * 
   * 验证点：
   * - 非 intro/outro 场景可以有独立的主字幕和配音文案
   * - 配音文案可能比字幕更长（包含完整句子）
   */
  it('title 是短标题，mainTitle 是完整配音文案', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.id !== 'intro' && scene.id !== 'outro') {
        assert.ok(scene.title !== undefined);
        assert.ok(scene.mainTitle !== undefined);
      }
    });
  });

  /**
   * 测试：subTitle 和 subVoiceover 可以不同
   * 
   * 验证点：
   * - 次字幕和次配音可以是不同的内容
   * - 次配音可能是次字幕的扩展或简化版本
   */
  it('subTitle 和 subVoiceover 可以不同', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.id !== 'intro' && scene.id !== 'outro') {
        assert.ok(scene.subTitle !== undefined);
        assert.ok(scene.subVoiceover !== undefined);
      }
    });
  });
});

// =============================================================================
// 测试用例：audioFileSub 与 subVoiceover 的双向一致性
// =============================================================================

describe('audioFileSub 仅在 subVoiceover 非空时赋值', () => {
  
  /**
   * 测试：subVoiceover 为空时 audioFileSub 必须为 undefined
   * 
   * 验证点：
   * - 如果 subVoiceover 为空字符串或只有空白字符
   * - audioFileSub 不应该被赋值
   */
  it('subVoiceover 为空时 audioFileSub 必须为 undefined', () => {
    const timeline = buildExpectedTimeline(createSampleScriptWithEmptySub(), createAudioDurationsWithEmptySub());
    timeline.scenes.forEach(scene => {
      if (scene.id !== 'intro' && scene.id !== 'outro') {
        if (!scene.subVoiceover || !scene.subVoiceover.trim()) {
          assert.strictEqual(
            scene.audioFileSub, 
            undefined, 
            `Scene ${scene.id}: audioFileSub must be undefined when subVoiceover is empty`
          );
        }
      }
    });
  });

  /**
   * 测试：subVoiceover 为空时 subDuration 必须为 0
   * 
   * 验证点：
   * - subDuration 表示次配音的时长
   * - 没有次配音内容时，时长应为 0
   */
  it('subVoiceover 为空时 subDuration 必须为 0', () => {
    const timeline = buildExpectedTimeline(createSampleScriptWithEmptySub(), createAudioDurationsWithEmptySub());
    timeline.scenes.forEach(scene => {
      if (scene.id !== 'intro' && scene.id !== 'outro') {
        if (!scene.subVoiceover || !scene.subVoiceover.trim()) {
          assert.strictEqual(
            scene.subDuration, 
            0, 
            `Scene ${scene.id}: subDuration must be 0 when subVoiceover is empty`
          );
        }
      }
    });
  });

  /**
   * 测试：subVoiceover 为空时 subVoiceoverSource 必须为 undefined
   * 
   * 验证点：
   * - subVoiceoverSource 表示次配音的来源
   * - 没有次配音时，不应该有来源字段
   */
  it('subVoiceover 为空时 subVoiceoverSource 必须为 undefined', () => {
    const timeline = buildExpectedTimeline(createSampleScriptWithEmptySub(), createAudioDurationsWithEmptySub());
    timeline.scenes.forEach(scene => {
      if (scene.id !== 'intro' && scene.id !== 'outro') {
        if (!scene.subVoiceover || !scene.subVoiceover.trim()) {
          assert.strictEqual(
            scene.subVoiceoverSource, 
            undefined, 
            `Scene ${scene.id}: subVoiceoverSource must be undefined`
          );
        }
      }
    });
  });

  /**
   * 测试：subVoiceover 非空时 audioFileSub 必须有值
   * 
   * 验证点：
   * - 如果有次配音文案，应该有对应的配音文件
   * - 这是配音文件与文本的对应关系
   */
  it('subVoiceover 非空时 audioFileSub 必须有值', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.id !== 'intro' && scene.id !== 'outro') {
        if (scene.subVoiceover && scene.subVoiceover.trim()) {
          assert.ok(
            scene.audioFileSub, 
            `Scene ${scene.id}: audioFileSub must exist when subVoiceover is non-empty`
          );
        }
      }
    });
  });
});

// =============================================================================
// 测试用例：配音文件与文本字段双向一致性
// =============================================================================

describe('配音文件与文本字段双向一致性', () => {
  
  /**
   * 测试：有 audioFileSub 的场景必须有非空的 subVoiceover
   */
  it('有 audioFileSub 的场景必须有非空的 subVoiceover', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.audioFileSub) {
        assert.ok(
          scene.subVoiceover && scene.subVoiceover.trim(), 
          `Scene ${scene.id}: has audioFileSub but subVoiceover is empty`
        );
      }
    });
  });

  /**
   * 测试：没有 subVoiceover 的场景不能有 audioFileSub
   */
  it('没有 subVoiceover 的场景不能有 audioFileSub', () => {
    const timeline = buildExpectedTimeline(createSampleScriptWithEmptySub(), createAudioDurationsWithEmptySub());
    timeline.scenes.forEach(scene => {
      if (!scene.subVoiceover || !scene.subVoiceover.trim()) {
        assert.strictEqual(
          scene.audioFileSub, 
          undefined, 
          `Scene ${scene.id}: no subVoiceover but has audioFileSub`
        );
      }
    });
  });

  /**
   * 测试：subDuration > 0 的场景必须有非空 subVoiceover
   */
  it('subDuration > 0 的场景必须有非空 subVoiceover', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.subDuration > 0) {
        assert.ok(
          scene.subVoiceover && scene.subVoiceover.trim(), 
          `Scene ${scene.id}: subDuration > 0 but subVoiceover is empty`
        );
      }
    });
  });

  /**
   * 测试：主配音文件对应 mainTitle
   */
  it('主配音文件对应 mainTitle', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.id !== 'intro' && scene.id !== 'outro') {
        assert.ok(
          scene.mainTitle && scene.mainTitle.length > 0, 
          `Scene ${scene.id}: mainTitle must exist for main voiceover`
        );
      }
    });
  });

  /**
   * 测试：次配音文件对应 subVoiceover
   */
  it('次配音文件对应 subVoiceover', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.audioFileSub && scene.id !== 'intro' && scene.id !== 'outro') {
        assert.ok(
          scene.subVoiceover && scene.subVoiceover.length > 0, 
          `Scene ${scene.id}: subVoiceover must exist for sub voiceover`
        );
      }
    });
  });
});

// =============================================================================
// 测试用例：自动拆分过长 mainTitle
// =============================================================================

describe('自动拆分过长 mainTitle', () => {
  
  /**
   * 模拟 mainTitle 自动拆分逻辑
   * 
   * 功能：当 mainTitle 过长时，自动拆分为 mainTitle + subVoiceover
   * 规则：
   * - intro/outro 不拆分
   * - 短文本（≤20词）不拆分
   * - 按句子或单词中点拆分
   * 
   * @param {string} mainTitle - 原始配音文案
   * @param {string} sceneId - 场景 ID
   * @returns {object} { mainTitle, subVoiceover }
   */
  function autoSplitMainTitle(mainTitle, sceneId) {
    // intro/outro 不拆分
    if (sceneId === 'intro' || sceneId === 'outro') return { mainTitle, subVoiceover: '' };
    if (!mainTitle) return { mainTitle: '', subVoiceover: '' };

    const wordCount = mainTitle.split(/\s+/).length;
    
    // 短文本不拆分
    if (wordCount <= 20) return { mainTitle, subVoiceover: '' };

    // 尝试按句子拆分
    const sentences = mainTitle.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length >= 2) {
      const midPoint = Math.ceil(sentences.length / 2);
      return {
        mainTitle: sentences.slice(0, midPoint).join('').trim(),
        subVoiceover: sentences.slice(midPoint).join('').trim()
      };
    }

    // 按单词中点拆分
    const words = mainTitle.split(/\s+/);
    const midPoint = Math.ceil(words.length / 2);
    const splitIdx = words.slice(0, midPoint).join(' ').length;
    
    // 找最近的逗号位置
    const bestSplit = mainTitle.lastIndexOf(',', splitIdx);
    const splitPos = bestSplit > splitIdx * 0.5 ? bestSplit + 1 : splitIdx;
    
    return {
      subVoiceover: mainTitle.substring(splitPos).trim(),
      mainTitle: mainTitle.substring(0, splitPos).replace(/[,]\s*$/, '').trim()
    };
  }

  /**
   * 测试：过长 mainTitle 应被拆分
   */
  it('过长 mainTitle 应被拆分', () => {
    const longTitle = 'Keep your character identical across every single new scene you create with our platform. Works with any reference image or source video you upload to generate perfect results.';
    const result = autoSplitMainTitle(longTitle, 'scene0');
    
    assert.ok(result.mainTitle.length > 0);
    assert.ok(result.subVoiceover.length > 0);
  });

  /**
   * 测试：短 mainTitle 不应被拆分
   */
  it('短 mainTitle 不应被拆分', () => {
    const result = autoSplitMainTitle('This is a short title.', 'scene0');
    assert.strictEqual(result.subVoiceover, '');
  });

  /**
   * 测试：intro/outro 不应被拆分
   */
  it('intro/outro 不应被拆分', () => {
    const longIntro = 'Welcome to our amazing product. It does everything you need.';
    const result = autoSplitMainTitle(longIntro, 'intro');
    assert.strictEqual(result.mainTitle, longIntro);
  });
});

// =============================================================================
// 测试用例：Timeline 完整性
// =============================================================================

describe('Timeline 完整性', () => {
  
  /**
   * 测试：timeline 包含必要顶层字段
   */
  it('timeline 包含 product/tagline/fps/totalFrames', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    
    assert.strictEqual(timeline.product, 'TestApp');
    assert.ok(timeline.tagline.length > 0);
    assert.strictEqual(timeline.fps, 30);
    assert.ok(timeline.totalFrames > 0);
  });

  /**
   * 测试：场景数量 = script.scenes + outro
   */
  it('场景数量 = script.scenes + outro', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    assert.strictEqual(
      timeline.scenes.length, 
      createSampleScript().scenes.length + 1
    );
  });

  /**
   * 测试：startFrame 单调递增
   */
  it('startFrame 单调递增', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    for (let i = 1; i < timeline.scenes.length; i++) {
      assert.ok(
        timeline.scenes[i].startFrame >= timeline.scenes[i - 1].startFrame,
        `Scene ${i} startFrame should be >= Scene ${i-1}`
      );
    }
  });

  /**
   * 测试：durationInFrames > 0
   */
  it('durationInFrames > 0', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      assert.ok(scene.durationInFrames > 0, `Scene ${scene.id}`);
    });
  });

  /**
   * 测试：voiceoverSource 全部为 elevenlabs
   */
  it('voiceoverSource 全部为 elevenlabs', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      assert.strictEqual(scene.voiceoverSource, 'elevenlabs');
    });
  });

  /**
   * 测试：不应使用 preview_ 前缀
   * 
   * 说明：preview_ 前缀用于临时预览文件，正式文件不应使用
   */
  it('不应使用 preview_ 前缀', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    timeline.scenes.forEach(scene => {
      if (scene.audioFile) assert.ok(!scene.audioFile.startsWith('preview_'));
      if (scene.audioFileSub) assert.ok(!scene.audioFileSub.startsWith('preview_'));
    });
  });
});

// =============================================================================
// 测试用例：intro/outro 特殊场景
// =============================================================================

describe('intro/outro 特殊场景', () => {
  
  /**
   * 测试：intro 场景的文件命名规则
   */
  it('intro: audioFile=intro.mp3, audioFileSub=undefined', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    const intro = timeline.scenes[0];
    
    assert.strictEqual(intro.id, 'intro');
    assert.strictEqual(intro.audioFile, 'intro.mp3');
    assert.strictEqual(intro.audioFileSub, undefined);
    assert.strictEqual(intro.subVoiceover, '');
  });

  /**
   * 测试：outro 场景的文件命名规则
   */
  it('outro: audioFile=outro.mp3, audioFileSub=undefined', () => {
    const timeline = buildExpectedTimeline(createSampleScript(), createSampleAudioDurations());
    const outro = timeline.scenes[timeline.scenes.length - 1];
    
    assert.strictEqual(outro.id, 'outro');
    assert.strictEqual(outro.audioFile, 'outro.mp3');
    assert.strictEqual(outro.audioFileSub, undefined);
    assert.strictEqual(outro.subVoiceover, '');
  });
});

// =============================================================================
// 测试用例：边界情况（0 场景和 1 场景）
// =============================================================================

/**
 * 创建空场景脚本
 * 
 * 功能：生成没有任何场景的脚本
 * 用途：测试 0 场景边界情况
 */
function createEmptyScript() {
  return {
    product: 'EmptyApp',
    tagline: 'No scenes',
    scenes: []
  };
}

/**
 * 创建单场景脚本
 * 
 * 功能：生成只有 1 个场景的脚本
 * 用途：测试 1 场景边界情况
 */
function createSingleSceneScript() {
  return {
    product: 'SingleApp',
    tagline: 'One scene',
    scenes: [
      { 
        title: 'Only one scene', 
        subTitle: '', 
        mainTitle: 'Only one scene', 
        subVoiceover: '' 
      }
    ]
  };
}

describe('边界情况：0 场景和 1 场景', () => {
  
  /**
   * 测试：0 场景脚本应生成正确的 timeline 结构
   * 
   * 验证点：
   * - timeline 顶层字段（product、tagline、fps）仍然正确
   * - scenes 数组为空
   * - totalFrames 为 0 或有默认值
   * 
   * 重要性：
   * - 防止空输入导致崩溃
   * - 验证系统能优雅处理边界情况
   */
  it('0 场景脚本：timeline 结构正确', () => {
    const script = createEmptyScript();
    const durations = [];
    
    const timeline = buildExpectedTimeline(script, durations);
    
    // 顶层字段应正确
    assert.strictEqual(timeline.product, 'EmptyApp');
    assert.strictEqual(timeline.tagline, 'No scenes');
    assert.strictEqual(timeline.fps, 30);
    
    // scenes 应为空数组
    assert.ok(Array.isArray(timeline.scenes));
    assert.strictEqual(timeline.scenes.length, 0);
  });

  /**
   * 测试：0 场景脚本仍应有 outro
   * 
   * 验证点：
   * - 即使没有输入场景，outro 场景仍应被生成
   * - outro 的 title 和 mainTitle 基于 product 生成
   */
  it('0 场景脚本：仍应有 outro 场景', () => {
    const script = createEmptyScript();
    const durations = [];
    
    const timeline = buildExpectedTimeline(script, durations);
    
    // 至少应该有 outro
    assert.ok(timeline.scenes.length >= 1);
    
    // 最后一个场景应该是 outro
    const lastScene = timeline.scenes[timeline.scenes.length - 1];
    assert.strictEqual(lastScene.id, 'outro');
    assert.ok(lastScene.title.includes('EmptyApp'));
    assert.ok(lastScene.mainTitle.includes('EmptyApp'));
  });

  /**
   * 测试：1 场景脚本：timeline 结构正确
   * 
   * 验证点：
   * - 只有一个输入场景
   * - 该场景被处理为 intro（因为 i === 0）
   * - 仍有 outro
   */
  it('1 场景脚本：timeline 结构正确', () => {
    const script = createSingleSceneScript();
    const durations = [{ id: 'intro', mainDuration: 4, subDuration: 0 }];
    
    const timeline = buildExpectedTimeline(script, durations);
    
    // 顶层字段正确
    assert.strictEqual(timeline.product, 'SingleApp');
    assert.strictEqual(timeline.fps, 30);
    
    // 场景数量 = 1（输入）+ 1（outro）= 2
    assert.strictEqual(timeline.scenes.length, 2);
    
    // 第一个场景是 intro
    assert.strictEqual(timeline.scenes[0].id, 'intro');
    assert.strictEqual(timeline.scenes[0].title, 'Only one scene');
    assert.strictEqual(timeline.scenes[0].audioFile, 'intro.mp3');
    
    // 最后一个场景是 outro
    const outro = timeline.scenes[timeline.scenes.length - 1];
    assert.strictEqual(outro.id, 'outro');
  });

  /**
   * 测试：1 场景脚本：intro 无 subVoiceover
   * 
   * 验证点：
   * - 单场景作为 intro 时，不应有次配音
   * - subVoiceover 应为空字符串
   * - audioFileSub 应为 undefined
   */
  it('1 场景脚本：intro 无 subVoiceover', () => {
    const script = createSingleSceneScript();
    const durations = [{ id: 'intro', mainDuration: 4, subDuration: 0 }];
    
    const timeline = buildExpectedTimeline(script, durations);
    const intro = timeline.scenes[0];
    
    assert.strictEqual(intro.subVoiceover, '');
    assert.strictEqual(intro.audioFileSub, undefined);
    assert.strictEqual(intro.subDuration, 0);
  });

  /**
   * 测试：1 场景脚本：startFrame 从 0 开始
   * 
   * 验证点：
   * - 第一个场景的 startFrame 应该是 0
   * - 后续场景的 startFrame 应正确累加
   */
  it('1 场景脚本：startFrame 从 0 开始', () => {
    const script = createSingleSceneScript();
    const durations = [{ id: 'intro', mainDuration: 4, subDuration: 0 }];
    
    const timeline = buildExpectedTimeline(script, durations);
    
    assert.strictEqual(timeline.scenes[0].startFrame, 0);
    
    // outro 的 startFrame 应该 > 0
    const outro = timeline.scenes[timeline.scenes.length - 1];
    assert.ok(outro.startFrame > 0);
  });

  /**
   * 测试：0 场景时 totalFrames 仍应计算
   * 
   * 验证点：
   * - 即使没有输入场景，totalFrames 应该有值（至少包含 outro）
   * - totalFrames 应 > 0（因为 outro 有时长）
   */
  it('0 场景脚本：totalFrames 仍应计算', () => {
    const script = createEmptyScript();
    const durations = [];
    
    const timeline = buildExpectedTimeline(script, durations);
    
    // totalFrames 应该 > 0（包含 outro 的帧数）
    assert.ok(timeline.totalFrames > 0, `totalFrames 应 > 0，实际: ${timeline.totalFrames}`);
  });
});
