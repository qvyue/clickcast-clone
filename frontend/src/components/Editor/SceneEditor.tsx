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
import { getScreenshotUrl, generatePreviewVoiceover, uploadImage } from '../../api/client';

interface SceneEditorProps {
  scene: Scene;
  index: number;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, index }) => {
  // 从全局 store 获取状态和方法
  const { domain, updateScene, deleteScene } = useEditorStore();

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
   * 处理标题变更
   */
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateScene(index, { title: e.target.value });
  };

  /**
   * 处理副标题变更
   */
  const handleSubTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateScene(index, { subText: e.target.value });
  };

  /**
   * 处理主配音文本变更
   */
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateScene(index, { text: e.target.value } as Partial<Scene>);
  };

  /**
   * 处理次配音文本变更
   */
  const handleSubVoiceoverChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateScene(index, { subVoiceover: e.target.value } as Partial<Scene>);
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
   */
  const handleGenerateMainVoiceover = async () => {
    if (!domain) return;
    const text = scene.text;
    if (!text || text.trim().length === 0) {
      setMainPreviewMessage('Please enter main voiceover text first');
      mainMessageTimeoutRef.current = setTimeout(() => setMainPreviewMessage(null), 3000);
      return;
    }

    setIsGeneratingMain(true);
    setMainPreviewMessage(null);

    try {
      const result = await generatePreviewVoiceover(domain, index, text);
      setMainPreviewMessage(`Generated: ${result.audioFile}`);
      mainMessageTimeoutRef.current = setTimeout(() => setMainPreviewMessage(null), 5000);
    } catch (error) {
      setMainPreviewMessage('Failed to generate voiceover');
      mainMessageTimeoutRef.current = setTimeout(() => setMainPreviewMessage(null), 3000);
    } finally {
      setIsGeneratingMain(false);
    }
  };

  /**
   * 生成次配音
   * 次配音保存为 preview_scene{index}_sub.mp3
   */
  const handleGenerateSubVoiceover = async () => {
    if (!domain) return;
    const text = scene.subVoiceover;
    if (!text || text.trim().length === 0) {
      setSubPreviewMessage('Please enter sub voiceover text first');
      subMessageTimeoutRef.current = setTimeout(() => setSubPreviewMessage(null), 3000);
      return;
    }

    setIsGeneratingSub(true);
    setSubPreviewMessage(null);

    try {
      // 次配音保存为 preview_scene{index}_sub.mp3
      const result = await generatePreviewVoiceover(domain, index, text);
      setSubPreviewMessage(`Generated: ${result.audioFile}`);
      subMessageTimeoutRef.current = setTimeout(() => setSubPreviewMessage(null), 5000);
    } catch (error) {
      setSubPreviewMessage('Failed to generate voiceover');
      subMessageTimeoutRef.current = setTimeout(() => setSubPreviewMessage(null), 3000);
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

      {/* 标题输入 */}
      <div className="scene-editor-group">
        <label>Title</label>
        <input
          type="text"
          value={scene.title || ''}
          onChange={handleTitleChange}
          placeholder="Scene title..."
        />
      </div>

      {/* 副标题输入 */}
      <div className="scene-editor-group">
        <label>Subtitle</label>
        <textarea
          value={scene.subText || ''}
          onChange={handleSubTextChange}
          placeholder="Scene subtitle..."
        />
      </div>

      {/* 主配音编辑区 */}
      <div className="scene-editor-group">
        <label>Main Voiceover Script</label>
        <textarea
          value={scene.text || ''}
          onChange={handleTextChange}
          placeholder="Main voiceover text (plays first)..."
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
        {/* 生成结果消息 */}
        {mainPreviewMessage && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: mainPreviewMessage.includes('Generated') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${mainPreviewMessage.includes('Generated') ? '#22c55e' : '#ef4444'}`,
            borderRadius: '4px',
            fontSize: '12px',
            color: mainPreviewMessage.includes('Generated') ? '#22c55e' : '#ef4444'
          }}>
            {mainPreviewMessage}
          </div>
        )}
      </div>

      {/* 次配音编辑区 */}
      <div className="scene-editor-group">
        <label>Sub Voiceover Script</label>
        <textarea
          value={scene.subVoiceover || ''}
          onChange={handleSubVoiceoverChange}
          placeholder="Sub voiceover text (plays after main, optional)..."
        />
        {/* 生成次配音按钮 */}
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
        {/* 生成结果消息 */}
        {subPreviewMessage && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: subPreviewMessage.includes('Generated') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${subPreviewMessage.includes('Generated') ? '#22c55e' : '#ef4444'}`,
            borderRadius: '4px',
            fontSize: '12px',
            color: subPreviewMessage.includes('Generated') ? '#22c55e' : '#ef4444'
          }}>
            {subPreviewMessage}
          </div>
        )}
      </div>

      {/* 图片展示与上传区 */}
      <div className="scene-editor-group">
        <label>Image</label>

        {/* 已有图片时显示预览 */}
        {scene.img && domain ? (
          <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={getScreenshotUrl(domain, scene.img)}
                alt={scene.img}
                className="scene-image-preview"
                style={{ maxHeight: '120px', objectFit: 'contain', cursor: 'pointer' }}
                onClick={() => setShowImageModal(true)}
              />
              {/* 放大按钮 */}
              <button
                onClick={() => setShowImageModal(true)}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: '#fff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
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
            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
              {scene.img}
            </div>
          </>
        ) : (
          /* 无图片时的占位区域 */
          <div style={{
            padding: '40px 20px',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)',
            borderRadius: '12px',
            border: '2px dashed #3a3a5a',
            textAlign: 'center',
            color: '#666',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>No image selected</div>
              <div style={{ fontSize: '11px', color: '#555' }}>Upload an image below</div>
            </div>
          </div>
        )}

        {/* 上传新图片按钮 */}
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{ fontSize: '12px' }}
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'pointer'
          }}
        >
          <img
            src={getScreenshotUrl(domain, scene.img)}
            alt={scene.img}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* 关闭按钮 */}
          <button
            onClick={() => setShowImageModal(false)}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✕ Close
          </button>
        </div>
      )}

      {/* 布局选择器 */}
      <div className="scene-editor-group">
        <label>Layout</label>
        <select
          value={scene.layout}
          onChange={(e) => updateScene(index, { layout: e.target.value as 'left' | 'center' | 'right' })}
          style={{
            width: '100%',
            padding: '10px',
            background: '#0f0f1a',
            border: '1px solid #2a2a4a',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px'
          }}
        >
          <option value="left">Left (Image Right)</option>
          <option value="center">Center</option>
          <option value="right">Right (Image Left)</option>
        </select>
      </div>

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
