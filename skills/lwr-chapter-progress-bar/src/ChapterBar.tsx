import React from 'react';
import { AbsoluteFill } from 'remotion';
import './design/fonts';
import { ChapterNav, type ChapterMark } from './design/ChapterProgress';
import type { SemanticColor } from './design/tokens';

export type ChapterBarProps = {
  brand: string;
  series?: string;
  chapters: ChapterMark[];
  accent?: SemanticColor;
  position?: 'top' | 'bottom';
  theme?: 'light' | 'dark';
  progress?: boolean;
  showTime?: boolean;
  height?: number; // 条高（不是画布高）
  totalSeconds?: number;
  width?: number; // 画布尺寸，由 scripts/render-chapter-bar.mjs 从源视频 ffprobe 传入
  canvasHeight?: number;
  fps?: number;
  showBrand?: boolean;
  showLabels?: boolean;
  fillColor?: string;
  opacity?: number;
};

// 独立章节条合成：整帧透明，只画一条 HUD 横带。
// 导出 ProRes 4444 就是可直接拖进剪映的透明素材；也可给 ffmpeg 当 overlay 叠在成片上。
// 画布尺寸由 props.width/canvasHeight 经 Root.tsx 的 calculateMetadata 决定。
export const ChapterBar: React.FC<ChapterBarProps> = ({
  brand,
  series,
  chapters,
  accent = 'red',
  position = 'top',
  theme = 'dark',
  progress = true,
  showTime = false,
  height,
  totalSeconds,
  showBrand = false,
  showLabels = true,
  fillColor,
  opacity,
}) => {
  const offset = position === 'top' ? { top: 0 } : { bottom: 0 };
  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, ...offset }}>
        <ChapterNav
          brand={brand}
          series={series}
          chapters={chapters}
          accent={accent}
          height={height}
          showTime={showTime}
          progress={progress}
          theme={theme}
          totalSeconds={totalSeconds}
          showBrand={showBrand}
          showLabels={showLabels}
          fillColor={fillColor}
          opacity={opacity}
        />
      </div>
    </AbsoluteFill>
  );
};
