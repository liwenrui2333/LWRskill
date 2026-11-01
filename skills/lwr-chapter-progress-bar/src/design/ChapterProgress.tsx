import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import './fonts';
import { COLOR, FONT, SIZE, type SemanticColor } from './tokens';

export type ChapterMark = {
  label: string;
  start: number; // 秒
  end: number; // 秒
};

// #RRGGBB 或 rgba(...) → 带指定 alpha 的颜色
const withAlpha = (color: string, a: number): string => {
  if (color.startsWith('#')) {
    const h = color.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/[\d.]+\)$/, `${a})`);
  }
  return color;
};

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// 分段进度条（soft-white-green 规格）：
//   章节等宽平分 → 每段内部独立推进，当前段填满才进下一段
//   白色大字 + 深色描边 → 任何背景上都读得清
//   段间一道细竖线分隔
// 规格基准 1440×64，实际按画布宽度等比缩放（竖屏/4K 自动适配）。
const BASE_W = 1440;
const BASE_H = 64;
const BASE_FONT = 38;
const BASE_DIVIDER = 1.5;

export const ChapterNav: React.FC<{
  brand?: string;
  series?: string;
  chapters: ChapterMark[];
  accent?: SemanticColor;
  fillColor?: string; // 直接指定填充色（十六进制），优先于 accent
  opacity?: number; // 整条不透明度 0-1，默认 1；半透明才能压在画面上不闷
  height?: number; // 条高；不给则按画布宽度等比缩放 64/1440
  showTime?: boolean;
  progress?: boolean;
  totalSeconds?: number;
  theme?: 'light' | 'dark';
  showBrand?: boolean;
  showLabels?: boolean;
}> = ({
  brand,
  series,
  chapters,
  accent = 'green',
  fillColor,
  opacity = 1,
  height,
  showTime = false,
  progress = true,
  totalSeconds,
  theme = 'dark',
  showBrand = false,
  showLabels = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: canvasWidth } = useVideoConfig();
  const now = frame / fps;
  const total = totalSeconds ?? durationInFrames / fps;

  // 等比缩放：1440 设计基准 → 实际画布宽
  const k = canvasWidth / BASE_W;
  const barH = height ?? Math.round(BASE_H * k);
  const fontSize = Math.round(BASE_FONT * k);
  const dividerW = Math.max(1, Math.round(BASE_DIVIDER * k));
  const strokeW = Math.max(1, Math.round(1.6 * k));

  const fillBase = fillColor ?? COLOR[accent];
  // 填充层也留一点点透，和未播放区同一档次，整条看起来才是"一层玻璃"
  const fill = withAlpha(fillBase, 0.88);

  const activeIdx = chapters.findIndex((ch) => now >= ch.start && now < ch.end);
  const activeFor = activeIdx >= 0 ? (now - chapters[activeIdx].start) * fps : 999;
  const pop = interpolate(activeFor, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  // 每段宽度等分（不是按时间比例）
  const segPct = 100 / Math.max(1, chapters.length);

  // 未播放区用半透明黑：既压得住画面，又不至于把下面的内容闷死。
  // 用 rgba 而不是整体 opacity，是因为整层透明会把文字和填充一起削淡。
  const P =
    theme === 'light'
      ? { empty: 'rgba(255,255,255,0.55)', text: '#FFFFFF', stroke: 'rgba(20,26,16,0.65)' }
      : { empty: 'rgba(12,14,18,0.55)', text: '#FFFFFF', stroke: 'rgba(0,0,0,0.55)' };
  const empty = withAlpha(P.empty, opacity);

  return (
    <div
      data-qc="chapter-nav"
      data-qc-id="ChapterNav"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: barH,
        display: 'flex',
      }}
    >
      {showBrand ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10 * k,
            paddingLeft: 24 * k,
            paddingRight: 16 * k,
            flexShrink: 0,
            background: empty,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontFamily: FONT.en,
              fontWeight: 800,
              fontSize: Math.round(SIZE.t4Lg * k),
              letterSpacing: '0.05em',
              color: P.text,
            }}
          >
            {brand}
          </span>
          {series ? (
            <span
              style={{
                fontFamily: FONT.zh,
                fontWeight: 700,
                fontSize: Math.round(SIZE.t4Lg * k),
                color: P.text,
              }}
            >
              / {series}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 章节段：每段一个容器，内部自己填 */}
      <div style={{ display: 'flex', flex: 1, height: '100%' }}>
        {chapters.map((ch, i) => {
          const isActive = i === activeIdx;
          const isPast = now >= ch.end;
          // 段内进度：已过 = 1，当前 = 段内百分比，未到 = 0
          const p = isPast
            ? 1
            : isActive
              ? Math.min(1, Math.max(0, (now - ch.start) / (ch.end - ch.start)))
              : 0;
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                width: `${segPct}%`,
                height: '100%',
                background: empty,
                borderLeft: i > 0 ? `${dividerW}px solid rgba(255,255,255,0.72)` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {/* 填充层：段内从 0 长到 100% */}
              {progress ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${p * 100}%`,
                    background: fill,
                  }}
                />
              ) : null}

              {/* 章节名：白字 + 深色描边，永远压在填充层之上 */}
              {showLabels ? (
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: FONT.zh,
                    fontWeight: 900,
                    fontSize,
                    lineHeight: 1,
                    color: P.text,
                    whiteSpace: 'nowrap',
                    transform: isActive ? `scale(${1 + 0.04 * (1 - pop)})` : undefined,
                    textShadow: [
                      `${strokeW}px 0 0 ${P.stroke}`,
                      `${-strokeW}px 0 0 ${P.stroke}`,
                      `0 ${strokeW}px 0 ${P.stroke}`,
                      `0 ${-strokeW}px 0 ${P.stroke}`,
                      `${strokeW}px ${strokeW}px 0 ${P.stroke}`,
                      `${-strokeW}px ${strokeW}px 0 ${P.stroke}`,
                      `${strokeW}px ${-strokeW}px 0 ${P.stroke}`,
                      `${-strokeW}px ${-strokeW}px 0 ${P.stroke}`,
                      `0 ${strokeW * 2}px ${strokeW * 3}px rgba(0,0,0,0.35)`,
                    ].join(', '),
                  }}
                >
                  {ch.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {showTime ? (
        <div
          style={{
            position: 'absolute',
            right: 24 * k,
            top: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6 * k,
            fontVariantNumeric: 'tabular-nums',
            zIndex: 2,
          }}
        >
          <span style={{ fontFamily: FONT.en, fontWeight: 800, fontSize: Math.round(SIZE.t4Lg * k), color: P.text }}>
            {fmt(now)}
          </span>
          <span
            style={{
              fontFamily: FONT.en,
              fontWeight: 600,
              fontSize: Math.round(SIZE.t4Sm * k),
              color: P.text,
              opacity: 0.6,
            }}
          >
            /
          </span>
          <span
            style={{
              fontFamily: FONT.en,
              fontWeight: 600,
              fontSize: Math.round(SIZE.t4Lg * k),
              color: P.text,
              opacity: 0.7,
            }}
          >
            {fmt(total)}
          </span>
        </div>
      ) : null}
    </div>
  );
};
