/**
 * VideoEditor 组件
 * 功能：视频编辑器主入口，整合预览播放器、场景编辑器、时间轴和操作栏
 *
 * @param domain - 从 URL 参数获取的网站域名
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Player, PlayerRef } from '@remotion/player';
import { useEditorStore } from '../../store/editorStore';
import { fetchTimeline } from '../../api/client';
import { ClickCastVideo } from '../../remotion/ClickCastVideo';
import { Timeline } from './Timeline';
import { SceneEditor } from './SceneEditor';
import { ActionBar } from './ActionBar';
import './VideoEditor.css';

export const VideoEditor: React.FC = () => {
  // 从 URL 获取域名参数
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();

  // 从全局 store 获取状态和操作方法
  const { timeline, setDomain, setTimeline, selectedSceneIndex, selectScene } = useEditorStore();

  // 视频比例：横版 16:9 或竖版 9:16
  const [aspectRatio, setAspectRatio] = useState<'landscape' | 'portrait'>('landscape');

  // Remotion 播放器引用，用于控制播放和跳转
  const playerRef = useRef<PlayerRef>(null);

  // 预览区域容器引用，用于计算播放器尺寸
  const previewRef = useRef<HTMLDivElement>(null);

  // 播放器尺寸状态，根据容器自适应
  const [playerSize, setPlayerSize] = useState({ width: 800, height: 450 });

  // 用于防止循环触发：用户点击时间轴时设置，跳转完成后清除
  const isSeekingRef = useRef(false);

  // 场景跳转 timeout 引用，用于清理
  const seekTimeoutRef = useRef<NodeJS.Timeout>();

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
        <p>Loading timeline...</p>
      </div>
    );
  }

  // 视频参数
  const fps = timeline.fps || 30;
  const compositionWidth = aspectRatio === 'landscape' ? 1920 : 1080;
  const compositionHeight = aspectRatio === 'landscape' ? 1080 : 1920;

  return (
    <div className="editor-container">
      {/* 顶部导航栏 */}
      <div className="editor-header">
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/websites')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <h1>Video Editor</h1>
        <span className="domain-badge">{domain}</span>
        {/* 比例切换按钮 */}
        <div className="aspect-toggle" style={{ marginLeft: 'auto' }}>
          <button
            className={`aspect-btn ${aspectRatio === 'landscape' ? 'active' : ''}`}
            onClick={() => setAspectRatio('landscape')}
          >
            16:9
          </button>
          <button
            className={`aspect-btn ${aspectRatio === 'portrait' ? 'active' : ''}`}
            onClick={() => setAspectRatio('portrait')}
          >
            9:16
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="editor-main">
        {/* 视频预览区域 */}
        <div className="editor-preview" ref={previewRef}>
          <Player
            acknowledgeRemotionLicense
            ref={playerRef}
            component={ClickCastVideo}
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

      {/* 底部操作栏 */}
      <ActionBar domain={domain} />
    </div>
  );
};

export default VideoEditor;
