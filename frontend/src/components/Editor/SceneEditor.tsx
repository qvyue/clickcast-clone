/**
 * SceneEditor 组件
 * 功能：编辑单个场景的标题、副标题、配音脚本、图片等属性
 *
 * @param scene - 场景数据对象
 * @param index - 场景在时间轴中的索引
 */
import React, { useState, useRef, useEffect } from 'react';
import { Scene } from '../../types';
import { useEditorStore } from '../../store/editorStore';
import { getScreenshotUrl, generatePreviewVoiceover, uploadImage, fetchAudioDuration } from '../../api/client';
import { ProgressIndicator, useEstimatedTime } from './ProgressIndicator';

interface SceneEditorProps {
  scene: Scene;
  index: number;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, index }) => {
  // 从全局 store 获取状态和方法
  const { domain, updateScene, updateSceneAudioDuration, deleteScene } = useEditorStore();

  // 图片放大模态框显示状态
  const [showImageModal, setShowImageModal] = useState(false);

  // 主配音生成中状态
  const [isGeneratingMain, setIsGeneratingMain] = useState(false);

  // 次配音生成中状态
  const [isGeneratingSub, setIsGeneratingSub] = useState(false);

  // 主配音预览消息（成功/失败提示）
  const [mainPreviewMessage, setMainPreviewMessage] = useState<string | null>(null);

  // 次配音预览消息
  const [subPreviewMessage, setSubPreviewMessage] = useState<string | null>(null);

  // Estimated time for voiceover generation
  const mainEstimatedTime = useEstimatedTime(scene.mainTitle || '');
  const subEstimatedTime = useEstimatedTime(scene.subTitle || '');

  // 图片上传中状态
  const [isUploading, setIsUploading] = useState(false);

  // 隐藏的文件输入框引用
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 消息自动消失 timeout 引用，用于清理
  const mainMessageTimeoutRef = useRef<NodeJS.Timeout>();
  const subMessageTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * 组件卸载时清理所有 timeout
   */
  useEffect(() => {
    return () => {
      if (mainMessageTimeoutRef.current) {
        clearTimeout(mainMessageTimeoutRef.current);
      }
      if (subMessageTimeoutRef.current) {
        clearTimeout(subMessageTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 处理主文案变更（同步 mainTitle + title + 配音文案）
   */
  const handleMainTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    updateScene(index, { mainTitle: value, title: value } as Partial<Scene>);
  };

  /**
   * 处理副文案变更（同步 subTitle + subVoiceover）
   */
  const handleSubTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    updateScene(index, { subTitle: value, subVoiceover: value } as Partial<Scene>);
  };

  /**
   * 删除当前场景
   * 弹出确认框防止误删
   */
  const handleDeleteScene = () => {
    if (confirm('Are you sure you want to delete this scene?')) {
      deleteScene(index);
    }
  };

  /**
   * 生成主配音
   * 调用后端 TTS 接口生成预览音频
   *
   * 步骤：
   * 1. 校验文本是否为空
   * 2. 调用后端 TTS 服务（StreamElements → Google Translate fallback）
   * 3. 更新场景的音频文件路径
   * 4. 更新音频时长（用于两阶段场景的时间计算）
   * 5. 显示成功消息，5秒后自动消失
   */
  const handleGenerateMainVoiceover = async () => {
    // 1. 前置校验
    if (!domain) return;
    const text = scene.mainTitle;
    if (!text || text.trim().length === 0) {
      setMainPreviewMessage('Please enter main title text first (used for both subtitle and voiceover)');
      mainMessageTimeoutRef.current = setTimeout(() => setMainPreviewMessage(null), 3000);
      return;
    }

    // 2. 设置加载状态
    setIsGeneratingMain(true);
    setMainPreviewMessage(null);

    try {
      // 3. 调用后端 TTS 服务（传入 scene.id 用于确定文件名）
      const result = await generatePreviewVoiceover(domain, index, text, 'main', scene.id);

      // 4. 更新场景音频文件路径
      updateScene(index, { audioFile: result.audioFile } as Partial<Scene>);

      // 5. 更新音频时长（用于视频渲染时的场景时长计算）
      if (result.duration > 0) {
        updateSceneAudioDuration(index, result.duration, 'main');
      }

      // 6. 显示成功消息，5秒后自动消失
      setMainPreviewMessage(`Generated: ${result.audioFile} (${result.duration.toFixed(1)}s)`);
      mainMessageTimeoutRef.current = setTimeout(() => setMainPreviewMessage(null), 5000);
    } catch (error) {
      // 失败消息保持显示，让用户有时间查看错误并点击 Retry 按钮
      setMainPreviewMessage('Failed to generate voiceover');
    } finally {
      setIsGeneratingMain(false);
    }
  };

  /**
   * 生成次配音
   * 次配音保存为 preview_scene{index}_sub.mp3
   *
   * 步骤：
   * 1. 校验文本是否为空
   * 2. 如果有主配音文件，先获取主配音的实际时长（用于两阶段场景时间计算）
   * 3. 调用后端 TTS 服务
   * 4. 更新场景的次配音文件路径和时长
   */
  const handleGenerateSubVoiceover = async () => {
    // 1. 前置校验
    if (!domain) return;
    const text = scene.subTitle;
    if (!text || text.trim().length === 0) {
      setSubPreviewMessage('Please enter sub title text first (used for both subtitle and voiceover)');
      subMessageTimeoutRef.current = setTimeout(() => setSubPreviewMessage(null), 3000);
      return;
    }

    // 2. 设置加载状态
    setIsGeneratingSub(true);
    setSubPreviewMessage(null);

    try {
      // 3. 同步主配音的实际时长（生成次配音前确保时间计算准确）
      if (scene.audioFile) {
        try {
          const mainDuration = await fetchAudioDuration(domain, scene.audioFile);
          if (mainDuration > 0) {
            updateScene(index, { mainDuration } as Partial<Scene>);
          }
        } catch (e) {
          console.warn('Failed to fetch main audio duration:', e);
        }
      }

      // 4. 调用后端 TTS 服务（传入 scene.id 用于确定文件名）
      const result = await generatePreviewVoiceover(domain, index, text, 'sub', scene.id);

      // 5. 更新场景次配音文件路径
      updateScene(index, { audioFileSub: result.audioFile } as Partial<Scene>);

      // 6. 更新次配音时长
      if (result.duration > 0) {
        updateSceneAudioDuration(index, result.duration, 'sub');
      }

      // 7. 显示成功消息
      setSubPreviewMessage(`Generated: ${result.audioFile} (${result.duration.toFixed(1)}s)`);
      subMessageTimeoutRef.current = setTimeout(() => setSubPreviewMessage(null), 5000);
    } catch (error) {
      // 失败消息保持显示，让用户有时间点击 Retry 按钮
      setSubPreviewMessage('Failed to generate voiceover');
    } finally {
      setIsGeneratingSub(false);
    }
  };

  /**
   * 上传图片
   * 支持自动检测长图并设置相应属性
   */
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!domain || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    setIsUploading(true);

    try {
      const result = await uploadImage(domain, file);
      if (result.success) {
        // 更新场景图片信息
        updateScene(index, {
          img: result.filename,
          scrollImage: result.isLongImage,
          imageWidth: result.width,
          imageHeight: result.height,
        } as Partial<Scene>);
      }
    } catch (error) {
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
      // 清空文件输入框，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * 获取场景类型显示名称
   */
  const getSceneType = () => {
    if (scene.id === 'intro') return 'Intro';
    if (scene.id === 'outro') return 'Outro';
    return `Scene ${index}`;
  };

  return (
    <div className="scene-editor">
      {/* 场景标题栏 */}
      <div className="scene-editor-header">
        <h3>{getSceneType()}</h3>
        <span className="scene-index">#{index}</span>
      </div>

      {/* 主文案输入（同时用于屏幕标题 + 主配音） */}
      <div className="scene-editor-group">
        <label>Main Title (On-screen Title + Main Voiceover)</label>
        <textarea
          value={scene.mainTitle || ''}
          onChange={handleMainTitleChange}
          placeholder="Main text — shown as subtitle AND spoken as voiceover..."
        />
        {/* 生成主配音按钮 */}
        <button
          className="btn btn-secondary"
          onClick={handleGenerateMainVoiceover}
          disabled={isGeneratingMain}
          style={{ marginTop: '8px' }}
        >
          {isGeneratingMain ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation: 'spin 1s linear infinite'}}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
              Generate Main
            </>
          )}
        </button>
        {/* 进度条 */}
        {isGeneratingMain && (
          <ProgressIndicator estimatedSeconds={mainEstimatedTime} />
        )}
        {/* 生成结果消息 */}
        {mainPreviewMessage && (
          <div className={`voiceover-message ${mainPreviewMessage.includes('Generated') ? 'voiceover-message-success' : 'voiceover-message-error'}`}>
            <span>{mainPreviewMessage}</span>
            {mainPreviewMessage.includes('Failed') && (
              <button className="btn btn-sm" onClick={handleGenerateMainVoiceover} style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px' }}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* 副文案输入（同时用于屏幕副标题 + 副配音） */}
      <div className="scene-editor-group">
        <label>Sub Title (On-screen Subtitle + Sub Voiceover)</label>
        <textarea
          value={scene.subTitle || ''}
          onChange={handleSubTitleChange}
          placeholder="Sub text — shown as subtitle AND spoken as voiceover..."
        />
        {/* 生成副配音按钮 */}
        <button
          className="btn btn-secondary"
          onClick={handleGenerateSubVoiceover}
          disabled={isGeneratingSub}
          style={{ marginTop: '8px' }}
        >
          {isGeneratingSub ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation: 'spin 1s linear infinite'}}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
              Generate Sub
            </>
          )}
        </button>
        {/* 进度条 */}
        {isGeneratingSub && (
          <ProgressIndicator estimatedSeconds={subEstimatedTime + 1} />
        )}
        {/* 生成结果消息 */}
        {subPreviewMessage && (
          <div className={`voiceover-message ${subPreviewMessage.includes('Generated') ? 'voiceover-message-success' : 'voiceover-message-error'}`}>
            <span>{subPreviewMessage}</span>
            {subPreviewMessage.includes('Failed') && (
              <button className="btn btn-sm" onClick={handleGenerateSubVoiceover} style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px' }}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* 图片展示与上传区 */}
      <div className="scene-editor-group">
        <label>Image</label>

        {/* 已有图片时显示预览 */}
        {scene.img && domain ? (
          <>
            <div className="scene-image-wrapper">
              <img
                src={getScreenshotUrl(domain, scene.img)}
                alt={scene.img}
                className="scene-image-preview"
                onClick={() => setShowImageModal(true)}
              />
              {/* 放大按钮 */}
              <button
                onClick={() => setShowImageModal(true)}
                className="scene-image-zoom-btn"
                title="Enlarge image"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          /* 无图片时的占位区域 */
          <div className="empty-image-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-image-placeholder-icon">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <div>
              <div className="empty-image-placeholder-title">No image selected</div>
              <div className="empty-image-placeholder-hint">Upload an image below</div>
            </div>
          </div>
        )}

        {/* 上传新图片按钮 */}
        <div className="scene-editor-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation: 'spin 1s linear infinite'}}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload New
              </>
            )}
          </button>
          {/* 隐藏的文件输入框 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={handleUploadImage}
          />
        </div>
      </div>

      {/* 图片放大模态框 */}
      {showImageModal && scene.img && domain && (
        <div
          onClick={() => setShowImageModal(false)}
          className="image-modal-overlay"
        >
          <img
            src={getScreenshotUrl(domain, scene.img)}
            alt={scene.img}
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
          />
          {/* 关闭按钮 */}
          <button
            onClick={() => setShowImageModal(false)}
            className="image-modal-close"
          >
            ✕ Close
          </button>
        </div>
      )}

      {/* 删除场景按钮 */}
      <div className="scene-editor-actions" style={{ marginTop: '16px' }}>
        <button className="btn btn-danger" onClick={handleDeleteScene}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          Delete Scene
        </button>
      </div>
    </div>
  );
};

export default SceneEditor;
