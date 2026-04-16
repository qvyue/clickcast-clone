/**
 * Timeline 组件
 * 功能：底部时间轴，展示所有场景的缩略图和时长，支持场景选择
 *
 * @param timeline - 时间轴数据对象，包含所有场景配置
 */
import React from 'react';
import { Timeline as TimelineType } from '../../types';
import { useEditorStore } from '../../store/editorStore';
import { getScreenshotUrl } from '../../api/client';

interface TimelineProps {
  timeline: TimelineType;
}

export const Timeline: React.FC<TimelineProps> = ({ timeline }) => {
  // 从全局 store 获取状态和方法
  const { domain, selectedSceneIndex, selectScene, setCurrentFrame } = useEditorStore();

  // 帧率，默认 30fps
  const fps = timeline.fps || 30;

  /**
   * 将帧数转换为时间格式 (分:秒)
   */
  const formatTime = (frames: number) => {
    const seconds = Math.floor(frames / fps);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算总时长显示
  const totalDuration = formatTime(timeline.totalFrames);

  /**
   * 处理场景块点击
   * 选中场景并跳转到起始帧
   */
  const handleBlockClick = (index: number, startFrame: number) => {
    selectScene(index);
    setCurrentFrame(startFrame);
  };

  /**
   * 获取场景显示标签
   * Intro/Outro 特殊标识，其他场景用 S{index}
   */
  const getSceneLabel = (sceneId: string, index: number) => {
    if (sceneId === 'intro') return 'Intro';
    if (sceneId === 'outro') return 'Outro';
    return `S${index}`;
  };

  return (
    <div className="timeline-container">
      {/* 时间轴标题栏 */}
      <div className="timeline-header">
        <h4>Timeline</h4>
        <span className="timeline-duration">{totalDuration}</span>
      </div>

      {/* 场景轨道 */}
      <div className="timeline-track">
        {timeline.scenes.map((scene, index) => {
          // 计算场景时长和宽度百分比
          const duration = scene.durationInFrames ?? 300;
          const widthPercent = (duration / timeline.totalFrames) * 100;

          // 获取场景缩略图 URL
          const imageUrl = scene.img && domain ? getScreenshotUrl(domain, scene.img) : null;

          return (
            <div
              key={scene.id || index}
              className={`timeline-block ${selectedSceneIndex === index ? 'selected' : ''}`}
              style={{ width: `${Math.max(widthPercent, 3)}%` }}
              onClick={() => handleBlockClick(index, scene.startFrame)}
            >
              {/* 缩略图容器 */}
              <div className="timeline-block-thumbnail">
                {/* 场景缩略图 */}
                {imageUrl && <img src={imageUrl} alt={scene.title || ''} />}
                {/* 场景信息覆盖层 */}
                <div className="timeline-block-overlay">
                  <span className="timeline-block-title">
                    {getSceneLabel(scene.id, index)}
                  </span>
                  <span className="timeline-block-time">{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
