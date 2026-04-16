/**
 * ActionBar 组件
 * 功能：底部操作栏，提供保存、渲染横版/竖版视频的功能
 *
 * @param domain - 当前编辑的网站域名
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { renderVideo } from '../../api/client';

interface ActionBarProps {
  domain: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({ domain }) => {
  // 从全局 store 获取状态和方法
  const { timeline, isDirty, isSaving, save, isRendering, setRendering } = useEditorStore();

  // 渲染状态消息
  const [renderStatus, setRenderStatus] = useState<string | null>(null);

  // 保存结果消息
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // timeout 引用，用于组件卸载时清理
  const saveMessageTimeoutRef = useRef<NodeJS.Timeout>();
  const renderStatusTimeoutRef = useRef<NodeJS.Timeout>();
  const pollingTimeoutRef = useRef<NodeJS.Timeout>();
  const pollStartTimeoutRef = useRef<NodeJS.Timeout>();

  // 轮询计数器引用
  const pollAttemptsRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 90; // 最多轮询 90 次（约 3 分钟）

  /**
   * 组件卸载时清理所有 timeout
   */
  useEffect(() => {
    return () => {
      if (saveMessageTimeoutRef.current) {
        clearTimeout(saveMessageTimeoutRef.current);
      }
      if (renderStatusTimeoutRef.current) {
        clearTimeout(renderStatusTimeoutRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (pollStartTimeoutRef.current) {
        clearTimeout(pollStartTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 计算视频总时长（秒）
   * 根据 totalFrames 和 fps 计算
   */
  const videoDuration = useMemo(() => {
    if (!timeline) return 0;
    const fps = timeline.fps || 30;
    return Math.round(timeline.totalFrames / fps);
  }, [timeline]);

  /**
   * 时长警告信息
   * 根据视频长度给出不同级别的建议
   */
  const durationWarning = useMemo(() => {
    if (videoDuration <= 60) return null;
    if (videoDuration <= 90) return { level: 'info', message: `${videoDuration}s — Good for demos` };
    if (videoDuration <= 120) return { level: 'warning', message: `${videoDuration}s — Consider shortening for better engagement` };
    return { level: 'error', message: `${videoDuration}s — Too long! Consider 60-90s for best results` };
  }, [videoDuration]);

  /**
   * 保存时间轴配置
   */
  const handleSave = async () => {
    const success = await save();
    if (success) {
      setSaveMessage({ type: 'success', text: 'Timeline saved!' });
    } else {
      setSaveMessage({ type: 'error', text: 'Failed to save timeline' });
    }
    // 3 秒后清除消息
    saveMessageTimeoutRef.current = setTimeout(() => setSaveMessage(null), 3000);
  };

  /**
   * 渲染视频
   * 支持横版 16:9 和竖版 9:16 两种比例
   * 使用轮询检查渲染进度
   */
  const handleRender = async (aspectRatio: 'landscape' | 'portrait') => {
    // 如果有未保存的更改，提示用户
    if (isDirty) {
      const shouldSave = confirm('You have unsaved changes. Save before rendering?');
      if (shouldSave) {
        await save();
      }
    }

    setRendering(true);
    setRenderStatus('Starting render...');
    // 重置轮询计数器
    pollAttemptsRef.current = 0;

    try {
      // 启动渲染任务
      const { jobId } = await renderVideo(domain, aspectRatio);
      setRenderStatus(`Rendering ${aspectRatio}... (Job: ${jobId})`);

      /**
       * 轮询检查渲染状态
       * 每 2 秒检查一次，直到完成或失败
       */
      const pollStatus = async () => {
        pollAttemptsRef.current++;

        // 检查是否超过最大轮询次数
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          setRenderStatus('Render timeout - please check server logs');
          setRendering(false);
          return;
        }

        try {
          const res = await fetch(`/api/status/${jobId}`);
          const data = await res.json();

          if (data.status === 'completed') {
            setRenderStatus(`${aspectRatio} render complete!`);
            setRendering(false);
            renderStatusTimeoutRef.current = setTimeout(() => setRenderStatus(null), 5000);
          } else if (data.status === 'failed') {
            setRenderStatus('Render failed');
            setRendering(false);
          } else {
            // 渲染中，显示进度
            setRenderStatus(`${data.message} (${data.progress}%)`);
            pollingTimeoutRef.current = setTimeout(pollStatus, 2000);
          }
        } catch (e) {
          setRenderStatus('Failed to check render status');
          setRendering(false);
        }
      };

      // 延迟 2 秒后开始轮询
      pollStartTimeoutRef.current = setTimeout(pollStatus, 2000);
    } catch (e) {
      setRenderStatus('Failed to start render');
      setRendering(false);
    }
  };

  return (
    <div className="action-bar">
      {/* 左侧状态区域 */}
      <div className="action-bar-left">
        {/* 渲染状态消息 */}
        {renderStatus && <span className="render-status">{renderStatus}</span>}
        {/* 时长警告 */}
        {durationWarning && (
          <span className={`duration-warning duration-warning-${durationWarning.level}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {durationWarning.level === 'error' ? (
                <circle cx="12" cy="12" r="10"/>
              ) : (
                <circle cx="12" cy="12" r="10"/>
              )}
              {durationWarning.level === 'error' ? (
                <>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </>
              ) : (
                <line x1="12" y1="8" x2="12" y2="12"/>
              )}
              {durationWarning.level !== 'error' && <line x1="12" y1="16" x2="12.01" y2="16"/>}
            </svg>
            {durationWarning.message}
          </span>
        )}
      </div>

      {/* 右侧操作按钮区域 */}
      <div className="action-bar-right">
        {/* 未保存更改提示 */}
        {isDirty && !saveMessage && <span className="dirty-indicator">Unsaved changes</span>}
        {/* 保存结果消息 */}
        {saveMessage && (
          <span className={`save-toast save-toast-${saveMessage.type}`}>
            {saveMessage.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
            {saveMessage.text}
          </span>
        )}
        {/* 保存按钮 */}
        <button
          className="btn btn-secondary"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{animation: 'spin 1s linear infinite'}}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save
            </>
          )}
        </button>
        {/* 渲染横版视频按钮 */}
        <button
          className="btn btn-primary"
          onClick={() => handleRender('landscape')}
          disabled={isRendering}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="12" rx="2"/>
            <path d="M8 20h8"/>
            <path d="M12 16v4"/>
          </svg>
          Render 16:9
        </button>
        {/* 渲染竖版视频按钮 */}
        <button
          className="btn btn-primary"
          onClick={() => handleRender('portrait')}
          disabled={isRendering}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="2" width="12" height="20" rx="2"/>
          </svg>
          Render 9:16
        </button>
      </div>
    </div>
  );
};

export default ActionBar;
