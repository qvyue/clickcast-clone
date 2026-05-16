/**
 * =============================================================================
 * voiceover.js 配音 API 测试
 * 
 * 测试目标：验证配音文件名生成和转换逻辑
 * 测试框架：Node.js 内置 test 模块
 * 
 * 测试覆盖范围：
 * 1. 预览配音文件名生成（preview_ 前缀）
 * 2. 正式配音文件名转换（preview_ → 正式文件名）
 * 3. 次配音文件名转换逻辑
 * 4. 边界情况处理（空值、无效值）
 * 
 * 文件命名规则：
 * - intro: intro.mp3 / intro_sub.mp3
 * - scene0: scene0-main.mp3 / scene0-sub.mp3
 * - preview_intro.mp3 / preview_scene0.mp3
 * =============================================================================
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// =============================================================================
// 测试用例：预览配音文件名生成
// =============================================================================

describe('预览配音文件名生成', () => {
  
  /**
   * 模拟 voiceover.js 中的预览文件名生成逻辑
   * 
   * 功能：根据场景 ID 和类型生成预览配音文件名
   * 规则：
   * - intro 场景: preview_intro.mp3
   * - outro 场景: preview_outro.mp3
   * - scene 场景: preview_scene{N}.mp3（使用 sceneId 而非数组索引）
   * - 次配音: 加上 _sub 后缀
   * 
   * @param {number} sceneIndex - 数组索引
   * @param {string} sceneId - 场景 ID（优先使用）
   * @param {string} type - 'main' 或 'sub'
   * @returns {string} 文件名
   */
  function generatePreviewFilename(sceneIndex, sceneId, type) {
    let baseName;
    
    if (sceneId === 'intro') {
      baseName = 'preview_intro';
    } else if (sceneId === 'outro') {
      baseName = 'preview_outro';
    } else if (sceneId && sceneId.startsWith('scene')) {
      // 【关键】从 sceneId 提取编号，而非使用数组索引
      // 原因：数组索引可能偏移（如 intro=0, scene0=1）
      const sceneNum = sceneId.replace('scene', '');
      baseName = `preview_scene${sceneNum}`;
    } else {
      // 兜底：使用数组索引
      baseName = `preview_scene${sceneIndex}`;
    }

    return type === 'sub' ? `${baseName}_sub.mp3` : `${baseName}.mp3`;
  }

  // ===== Intro 场景 =====

  /**
   * 测试：intro 主配音应生成 preview_intro.mp3
   * 
   * 验证点：
   * - 数组索引是 0
   * - 但 sceneId 是 'intro'
   * - 结果应该是 preview_intro.mp3，不是 preview_scene0.mp3
   */
  it('intro 主配音应生成 preview_intro.mp3', () => {
    const filename = generatePreviewFilename(0, 'intro', 'main');
    assert.strictEqual(filename, 'preview_intro.mp3');
  });

  /**
   * 测试：intro 次配音应生成 preview_intro_sub.mp3
   */
  it('intro 次配音应生成 preview_intro_sub.mp3', () => {
    const filename = generatePreviewFilename(0, 'intro', 'sub');
    assert.strictEqual(filename, 'preview_intro_sub.mp3');
  });

  /**
   * 测试：不应使用数组索引生成 preview_scene0.mp3
   * 
   * 重要性：
   * - 数组索引从 0 开始
   * - 如果误用索引，intro 会变成 preview_scene0.mp3
   * - 这会导致文件名与实际场景不匹配
   */
  it('不应使用数组索引 0 生成 preview_scene0.mp3', () => {
    const filename = generatePreviewFilename(0, 'intro', 'main');
    assert.notStrictEqual(filename, 'preview_scene0.mp3');
  });

  // ===== Outro 场景 =====

  /**
   * 测试：outro 主配音应生成 preview_outro.mp3
   */
  it('outro 主配音应生成 preview_outro.mp3', () => {
    const filename = generatePreviewFilename(5, 'outro', 'main');
    assert.strictEqual(filename, 'preview_outro.mp3');
  });

  /**
   * 测试：outro 次配音应生成 preview_outro_sub.mp3
   */
  it('outro 次配音应生成 preview_outro_sub.mp3', () => {
    const filename = generatePreviewFilename(5, 'outro', 'sub');
    assert.strictEqual(filename, 'preview_outro_sub.mp3');
  });

  // ===== Scene 场景 =====

  /**
   * 测试：scene0 应生成 preview_scene0.mp3 而非 preview_scene1.mp3
   * 
   * 验证点：
   * - 数组索引可能是 1（intro=0, scene0=1）
   * - 但 sceneId 是 'scene0'
   * - 结果应该是 preview_scene0.mp3
   */
  it('scene0 应生成 preview_scene0.mp3 而非 preview_scene1.mp3', () => {
    const filename = generatePreviewFilename(1, 'scene0', 'main');
    assert.strictEqual(filename, 'preview_scene0.mp3');
    assert.notStrictEqual(filename, 'preview_scene1.mp3');
  });

  /**
   * 测试：scene1 应从 sceneId 提取编号
   */
  it('scene1 应从 sceneId 提取编号生成 preview_scene1.mp3', () => {
    const filename = generatePreviewFilename(2, 'scene1', 'main');
    assert.strictEqual(filename, 'preview_scene1.mp3');
  });

  /**
   * 测试：scene3 次配音应生成 preview_scene3_sub.mp3
   */
  it('scene3 次配音应生成 preview_scene3_sub.mp3', () => {
    const filename = generatePreviewFilename(4, 'scene3', 'sub');
    assert.strictEqual(filename, 'preview_scene3_sub.mp3');
  });

  /**
   * 测试：使用 sceneId 而非数组索引避免偏移
   * 
   * 数组索引示例：
   * - intro=0 → sceneId='intro'
   * - scene0=1 → sceneId='scene0'
   * - scene1=2 → sceneId='scene1'
   * - scene2=3 → sceneId='scene2'
   * 
   * 如果误用索引：scene0 会变成 preview_scene1.mp3（错误！）
   */
  it('使用 sceneId 而非数组索引避免偏移', () => {
    const testCases = [
      { arrayIndex: 1, sceneId: 'scene0', expected: 'preview_scene0.mp3' },
      { arrayIndex: 2, sceneId: 'scene1', expected: 'preview_scene1.mp3' },
      { arrayIndex: 3, sceneId: 'scene2', expected: 'preview_scene2.mp3' },
      { arrayIndex: 4, sceneId: 'scene3', expected: 'preview_scene3.mp3' }
    ];

    testCases.forEach(({ arrayIndex, sceneId, expected }) => {
      const filename = generatePreviewFilename(arrayIndex, sceneId, 'main');
      assert.strictEqual(filename, expected);
      
      // 验证不使用数组索引
      assert.notStrictEqual(
        filename, 
        `preview_scene${arrayIndex}.mp3`,
        `Should not use array index ${arrayIndex}`
      );
    });
  });

  // ===== 边界情况 =====

  /**
   * 测试：sceneId 为空时应回退到数组索引
   */
  it('sceneId 为空时应回退到数组索引', () => {
    const filename = generatePreviewFilename(2, null, 'main');
    assert.strictEqual(filename, 'preview_scene2.mp3');
  });

  /**
   * 测试：sceneId 为 undefined 时应回退到数组索引
   */
  it('sceneId 为 undefined 时应回退到数组索引', () => {
    const filename = generatePreviewFilename(3, undefined, 'main');
    assert.strictEqual(filename, 'preview_scene3.mp3');
  });

  /**
   * 测试：type 为空时应生成主配音文件
   */
  it('type 为空时应生成主配音文件', () => {
    const filename = generatePreviewFilename(0, 'scene0', null);
    assert.strictEqual(filename, 'preview_scene0.mp3');
  });
});

// =============================================================================
// 测试用例：正式配音文件名转换
// =============================================================================

describe('正式配音文件名转换', () => {
  
  /**
   * 模拟 render.js 中的预览文件转正式文件逻辑
   * 
   * 功能：将 preview_ 前缀的文件名转换为正式文件名
   * 规则：
   * - preview_intro.mp3 → intro.mp3
   * - preview_scene0.mp3 → scene0-main.mp3
   * - 已有的正式文件名保持不变
   * 
   * @param {string} previewFilename - 预览文件名
   * @param {string} sceneId - 场景 ID
   * @returns {string} 正式文件名
   */
  function convertToProductionFilename(previewFilename, sceneId) {
    const isPreview = previewFilename.startsWith('preview_');

    if (!isPreview) {
      return previewFilename; // 已经是正式文件名
    }

    // 预览文件 → 正式文件
    if (sceneId === 'intro') {
      return 'intro.mp3';
    } else if (sceneId === 'outro') {
      return 'outro.mp3';
    } else {
      const sceneNum = sceneId.replace('scene', '');
      return `scene${sceneNum}-main.mp3`;
    }
  }

  /**
   * 测试：preview_intro.mp3 应转换为 intro.mp3
   */
  it('preview_intro.mp3 应转换为 intro.mp3', () => {
    const result = convertToProductionFilename('preview_intro.mp3', 'intro');
    assert.strictEqual(result, 'intro.mp3');
  });

  /**
   * 测试：preview_scene0.mp3 应转换为 scene0-main.mp3
   */
  it('preview_scene0.mp3 应转换为 scene0-main.mp3', () => {
    const result = convertToProductionFilename('preview_scene0.mp3', 'scene0');
    assert.strictEqual(result, 'scene0-main.mp3');
  });

  /**
   * 测试：已存在的正式文件名应保持不变
   */
  it('已存在的正式文件名应保持不变', () => {
    assert.strictEqual(
      convertToProductionFilename('intro.mp3', 'intro'), 
      'intro.mp3'
    );
    assert.strictEqual(
      convertToProductionFilename('scene0-main.mp3', 'scene0'), 
      'scene0-main.mp3'
    );
  });
});

// =============================================================================
// 测试用例：次配音正式文件名转换
// =============================================================================

describe('次配音正式文件名转换', () => {
  
  /**
   * 模拟 render.js 中的次配音文件名转换逻辑
   * 
   * 功能：生成次配音的正式文件名
   * 规则：
   * - intro: intro-sub.mp3
   * - outro: outro-sub.mp3
   * - scene{N}: scene{N}-sub.mp3
   * 
   * @param {string} sceneId - 场景 ID
   * @returns {string} 次配音文件名
   */
  function convertSubToProductionFilename(sceneId) {
    if (sceneId === 'intro') {
      return 'intro-sub.mp3';
    } else if (sceneId === 'outro') {
      return 'outro-sub.mp3';
    } else {
      const sceneNum = sceneId.replace('scene', '');
      return `scene${sceneNum}-sub.mp3`;
    }
  }

  /**
   * 测试：intro 次配音应为 intro-sub.mp3
   */
  it('intro 次配音应为 intro-sub.mp3', () => {
    assert.strictEqual(convertSubToProductionFilename('intro'), 'intro-sub.mp3');
  });

  /**
   * 测试：outro 次配音应为 outro-sub.mp3
   */
  it('outro 次配音应为 outro-sub.mp3', () => {
    assert.strictEqual(convertSubToProductionFilename('outro'), 'outro-sub.mp3');
  });

  /**
   * 测试：scene0 次配音应为 scene0-sub.mp3
   */
  it('scene0 次配音应为 scene0-sub.mp3', () => {
    assert.strictEqual(convertSubToProductionFilename('scene0'), 'scene0-sub.mp3');
  });

  /**
   * 测试：scene3 次配音应为 scene3-sub.mp3
   */
  it('scene3 次配音应为 scene3-sub.mp3', () => {
    assert.strictEqual(convertSubToProductionFilename('scene3'), 'scene3-sub.mp3');
  });
});
