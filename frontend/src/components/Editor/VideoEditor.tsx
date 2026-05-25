/**
 * VideoEditor 组件
 * 功能：视频编辑器主入口，整合预览播放器、场景编辑器、时间轴和操作栏
 *
 * @param domain - 从 URL 参数获取的网站域名
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Player, PlayerRef } from '@remotion/player';
import { useEditorStore } from '../../store/editorStore';
import { fetchTimeline, renderVideo } from '../../api/client';
import { VidGenVideo } from '../../remotion/ClickCastVideo';
import { Timeline } from './Timeline';
import { SceneEditor } from './SceneEditor';
import { ErrorBoundary } from './ErrorBoundary';
import './VideoEditor.css';

export const VideoEditor: React.FC = () => {
  // 从 URL 获取域名参数
  const { domain } = useParams<{ domain: string }>();

  // 从全局 store 获取状态和操作方法
  const { timeline, setDomain, setTimeline, selectedSceneIndex, selectScene, isDirty, save, isRendering, setRendering } = useEditorStore();

  // 渲染状态消息
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  // 渲染成功标志（用于显示成功提示）
  const [renderSuccess, setRenderSuccess] = useState(false);

  // 渲染相关 timeout 引用
  const renderStatusTimeoutRef = useRef<NodeJS.Timeout>();
  const pollingTimeoutRef = useRef<NodeJS.Timeout>();
  const pollStartTimeoutRef = useRef<NodeJS.Timeout>();
  const pollAttemptsRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 300; // 最大轮询次数：300次 × 2秒 = 600秒（10分钟）超时

  // 视频比例：横版 16:9 或竖版 9:16
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait'>('landscape');

  // Remotion 播放器引用，用于控制播放和跳转
  const playerRef = useRef<PlayerRef>(null);

  // 预览区域容器引用，用于计算播放器尺寸
  const previewRef = useRef<HTMLDivElement>(null);

  // 播放器尺寸状态，根据容器自适应
  const [playerSize, setPlayerSize] = useState({ width: 800, height: 450 });

  // 用于防止循环触发：
  // 用户点击时间轴选中场景 → 播放器跳转到对应帧 → frameupdate 事件触发 → 又选中场景
  // 通过此标记跳过 frameupdate 事件中的选中逻辑
  const isSeekingRef = useRef(false);

  // 场景跳转 timeout 引用，用于清理
  const seekTimeoutRef = useRef<NodeJS.Timeout>();

  // 自动保存 timer 引用
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  // 自动保存状态消息
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null);

  /**
   * 初始化：加载时间轴数据
   * 根据域名获取对应的 timeline.json 配置
   */
  useEffect(() => {
    if (domain) {
      setDomain(domain);
      fetchTimeline(domain).then((tl) => {
        setTimeline(tl);
        // 默认选中第一个场景
        if (tl.scenes.length > 0) {
          selectScene(0);
        }
      }).catch(console.error);
    }
  }, [domain]);

  /**
   * 计算播放器尺寸
   * 根据容器大小和视频比例自适应
   */
  useEffect(() => {
    const updateSize = () => {
      if (!previewRef.current) return;

      const container = previewRef.current;
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;

      if (containerWidth <= 0 || containerHeight <= 0) return;

      // 根据视频比例计算实际尺寸
      const videoRatio = aspectRatio === 'landscape' ? 16 / 9 : 9 / 16;
      const containerRatio = containerWidth / containerHeight;

      let width: number;
      let height: number;

      if (containerRatio > videoRatio) {
        // 容器更宽，以高度为基准
        height = containerHeight;
        width = height * videoRatio;
      } else {
        // 容器更高，以宽度为基准
        width = containerWidth;
        height = width / videoRatio;
      }

      setPlayerSize({ width: Math.floor(width), height: Math.floor(height) });
    };

    // 延迟执行确保 DOM 已渲染
    const timer = setTimeout(updateSize, 100);
    window.addEventListener('resize', updateSize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
    };
  }, [aspectRatio, timeline]);

  /**
   * 场景跳转：当用户选中场景时，播放器跳转到对应帧
   * 使用 isSeekingRef 防止与 frameupdate 事件形成循环
   */
  useEffect(() => {
    if (selectedSceneIndex !== null && timeline && playerRef.current) {
      const scene = timeline.scenes[selectedSceneIndex];
      if (scene) {
        isSeekingRef.current = true;
        playerRef.current.seekTo(scene.startFrame);
        // 延迟清除 seeking 标记
        seekTimeoutRef.current = setTimeout(() => {
          isSeekingRef.current = false;
        }, 100);
      }
    }

    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, [selectedSceneIndex, timeline]);

  /**
   * 自动保存：当 isDirty=true 时，2 秒后自动保存
   * 使用 debounce 防止频繁保存
   */
  useEffect(() => {
    if (!isDirty) return;

    // 清除已存在的 timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 设置新的 timer，2 秒后自动保存
    autoSaveTimerRef.current = setTimeout(async () => {
      const success = await save();
      if (success) {
        setAutoSaveMessage('Auto-saved');
        setTimeout(() => setAutoSaveMessage(null), 2000);
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, timeline, save]);

  /**
   * 组件卸载时清理渲染相关的 timeout
   */
  useEffect(() => {
    return () => {
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
   */
  const videoDuration = useMemo(() => {
    if (!timeline) return 0;
    const fps = timeline.fps || 30;
    return Math.round(timeline.totalFrames / fps);
  }, [timeline]);

  /**
   * 时长警告信息
   */
  const durationWarning = useMemo(() => {
    if (videoDuration <= 60) return null;
    if (videoDuration <= 90) return { level: 'info', message: `${videoDuration}s` };
    if (videoDuration <= 120) return { level: 'warning', message: `${videoDuration}s` };
    return { level: 'error', message: `${videoDuration}s` };
  }, [videoDuration]);

  /**
   * 渲染视频
   */
  const handleRender = async () => {
    if (!domain) return;

    // 渲染前确保保存
    await save();

    setRendering(true);
    setRenderStatus('Starting...');
    pollAttemptsRef.current = 0;

    try {
      const { jobId } = await renderVideo(domain, aspectRatio);
      setRenderStatus(`Rendering...`);

      const pollStatus = async () => {
        pollAttemptsRef.current++;

        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          setRenderStatus('Timeout');
          setRendering(false);
          return;
        }

        try {
          const res = await fetch(`/api/status/${jobId}`);
          const data = await res.json();

          if (data.status === 'completed') {
            setRenderStatus('Done!');
            setRendering(false);
            setRenderSuccess(true);  // 显示成功提示
            renderStatusTimeoutRef.current = setTimeout(() => setRenderStatus(null), 3000);
          } else if (data.status === 'failed') {
            setRenderStatus('Failed');
            setRendering(false);
          } else {
            setRenderStatus(`${data.progress}%`);
            pollingTimeoutRef.current = setTimeout(pollStatus, 2000);
          }
        } catch (e) {
          setRenderStatus('Error');
          setRendering(false);
        }
      };

      pollStartTimeoutRef.current = setTimeout(pollStatus, 2000);
    } catch (e) {
      setRenderStatus('Error');
      setRendering(false);
    }
  };

  /**
   * 根据帧号查找对应的场景索引
   * 用于播放时自动高亮当前场景
   */
  const findSceneByFrame = useCallback((frame: number) => {
    if (!timeline) return null;
    for (let i = timeline.scenes.length - 1; i >= 0; i--) {
      const scene = timeline.scenes[i];
      if (frame >= scene.startFrame) {
        return i;
      }
    }
    return 0;
  }, [timeline]);

  /**
   * 监听播放器帧变化
   * 自动选中当前帧对应的场景
   */
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !timeline) return;

    const handleFrameUpdate = (data: { detail: { frame: number } }) => {
      // 如果是用户主动跳转，不处理
      if (isSeekingRef.current) return;

      const frame = data.detail.frame;
      const sceneIndex = findSceneByFrame(frame);
      if (sceneIndex !== null && sceneIndex !== selectedSceneIndex) {
        selectScene(sceneIndex);
      }
    };

    // 延迟添加监听，确保 player 已完全初始化
    const timer = setTimeout(() => {
      player.addEventListener('frameupdate', handleFrameUpdate);
    }, 100);

    return () => {
      clearTimeout(timer);
      player.removeEventListener('frameupdate', handleFrameUpdate);
    };
  }, [findSceneByFrame, selectedSceneIndex, selectScene, timeline]);

  // 加载中状态
  if (!timeline || !domain) {
    return (
      <div className="editor-loading">
        <div className="spinner"></div>
        <p>Loading video project...</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Taking longer than expected? Check your network connection.
        </p>
      </div>
    );
  }

  // 视频参数
  const fps = timeline.fps || 30;
  const compositionWidth = aspectRatio === 'landscape' ? 1920 : 1080;
  const compositionHeight = aspectRatio === 'landscape' ? 1080 : 1920;

  return (
    <ErrorBoundary>
      <div className="editor-container">
        {/* 顶部导航栏 */}
        <div className="editor-header">
          {/* 左侧：返回 + 标题 + 域名 */}
          <button
            className="btn btn-ghost"
            onClick={() => window.location.href = '/'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </button>
          <h1>Video Editor</h1>
          <span className="domain-badge">{domain}</span>
          {autoSaveMessage && (
            <span className="auto-save-message">{autoSaveMessage}</span>
          )}

          {/* 右侧：时长警告 + 比例切换 + 渲染按钮 */}
          <div className="header-right">
            {/* 渲染状态 */}
            {renderStatus && <span className="render-status">{renderStatus}</span>}

            {/* 时长警告 */}
            {durationWarning && (
              <span className={`duration-warning duration-warning-${durationWarning.level}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  {durationWarning.level === 'error' ? (
                    <>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </>
                  ) : (
                    <>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </>
                  )}
                </svg>
                {durationWarning.message}
              </span>
            )}

            {/* 比例切换按钮 */}
            <div className="aspect-toggle">
              <button
                className={`aspect-btn ${aspectRatio === 'landscape' ? 'active' : ''}`}
                onClick={() => setAspectRatio('landscape')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="12" rx="2"/>
                  <path d="M8 20h8"/>
                  <path d="M12 16v4"/>
                </svg>
                16:9
              </button>
              <button
                className={`aspect-btn ${aspectRatio === 'portrait' ? 'active' : ''}`}
                onClick={() => setAspectRatio('portrait')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2"/>
                  <line x1="12" y1="18" x2="12" y2="18.01"/>
                </svg>
                9:16
              </button>
            </div>

            {/* 渲染按钮 */}
            <button
              className="btn btn-primary"
              onClick={handleRender}
              disabled={isRendering}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Render
            </button>
          </div>
        </div>

        {/* 渲染成功提示 */}
        {renderSuccess && (
          <div className="render-success-banner">
            <div className="render-success-content">
              <span className="render-success-icon">✅</span>
              <span>Video rendered successfully!</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.location.href = '/'}
              >
                View on Homepage
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setRenderSuccess(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* 主内容区 */}
        <div className="editor-main">
          {/* 视频预览区域 */}
          <div className="editor-preview" ref={previewRef}>
            <Player
              acknowledgeRemotionLicense
              ref={playerRef}
              component={VidGenVideo}
              durationInFrames={timeline.totalFrames}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              fps={fps}
              inputProps={{ timeline, domain }}
              controls
              style={{
                width: playerSize.width,
                height: playerSize.height,
                overflow: 'hidden'
              }}
            />
          </div>

          {/* 场景编辑器侧边栏 */}
          <div className="editor-sidebar">
            {selectedSceneIndex !== null ? (
              <SceneEditor
                scene={timeline.scenes[selectedSceneIndex]}
                index={selectedSceneIndex}
              />
            ) : (
              <div className="no-selection">
                <p>Select a scene from the timeline to edit</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部时间轴 */}
        <div className="editor-timeline">
          <Timeline timeline={timeline} />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default VideoEditor;
