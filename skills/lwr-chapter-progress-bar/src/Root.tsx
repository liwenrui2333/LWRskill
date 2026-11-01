import React from 'react';
import { Composition } from 'remotion';
import { ChapterBar, type ChapterBarProps } from './ChapterBar';

// 画布尺寸 / 时长 / 帧率全部由 props 决定：
// 竖屏 1080×1920、横屏 1920×1080、方形 1080×1080 都走同一条合成，
// 靠 calculateMetadata 换尺寸，不另建 composition。
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ChapterBar"
      component={ChapterBar}
      defaultProps={
        {
          brand: 'BRAND',
          series: '系列名',
          chapters: [
            { label: '具体问题一', start: 0, end: 10 },
            { label: '具体问题二', start: 10, end: 20 },
          ],
          accent: 'red',
          position: 'top',
          theme: 'dark',
          progress: true,
          showTime: true,
          height: 52,
          totalSeconds: 20,
          width: 1920,
          canvasHeight: 1080,
          fps: 30,
        } as ChapterBarProps
      }
      durationInFrames={Math.round(20 * 30)}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={({ props }) => {
        const p = props as ChapterBarProps;
        const fps = p.fps ?? 30;
        const dur = p.totalSeconds ?? 20;
        return {
          width: p.width ?? 1920,
          height: p.canvasHeight ?? 1080,
          fps,
          durationInFrames: Math.max(1, Math.round(dur * fps)),
        };
      }}
    />
  );
};
