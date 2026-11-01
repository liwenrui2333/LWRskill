import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import './fonts';
import { COLOR, FONT, SIZE, type SemanticColor } from './tokens';

export type ChapterMark = {
  label: string;
  start: number; // 秒
  end: number; // 秒
};

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// 顶部章节导航条（NANA 式）：白底横贯画面顶部，左品牌 / 中章节 / 右时间码，底边一道语义色线。
// 关键认知：这类条不是"进度填充"，章节名本身就是进度指示器——当前章节加深 + 换色圆点，
// 已讲过变中灰，未讲到浅灰。加一条随时间伸长的填充条反而和章节高亮打架。
// 时间码连续走（它是时钟，禁用缓动）；动效只给「跨过段边界」这一个事件：新段圆点弹一下。
// 覆盖式：占住画面上方 height px，下层素材要让位就整体下移同等高度。
export const ChapterNav: React.FC<{
  brand: string;
  series?: string;
  chapters: ChapterMark[];
  accent?: SemanticColor; // 当前章节标记色 + 底线色，默认 red（对齐参考片）
  height?: number;
  showTime?: boolean;
  distribute?: 'even' | 'time'; // 章节横向排布：等距（对齐参考片）或按时间比例；开 progress 时强制按时间
  underline?: boolean; // 底边一道细线，亮底素材上用来跟画面分界
  progress?: boolean; // 底边一条随时间推进的填充线（开它就必须按时间排布，否则填充头会和章节名错位）
  progressHeight?: number;
  totalSeconds?: number; // 显式总时长；不给就用合成时长（独立素材时合成时长≠成片时长，必须给）
  theme?: 'light' | 'dark'; // light=白底深字（参考片）；dark=深底浅字，叠深色素材时用
}> = ({
  brand,
  series,
  chapters,
  accent = 'red',
  height = 52,
  showTime = true,
  distribute = 'even',
  underline = false,
  progress = false,
  progressHeight = 3,
  totalSeconds,
  theme = 'light',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: canvasWidth } = useVideoConfig();
  const now = frame / fps;
  const total = totalSeconds ?? durationInFrames / fps;
  // 填充是按时间算的；标签若等距排，填充头就会飘在章节名之间的空白上。
  // 所以开 progress 就把排布强制切成按时间比例，两者共用同一套坐标系。
  const layout = progress ? 'time' : distribute;

  const activeIdx = chapters.findIndex((ch) => now >= ch.start && now < ch.end);
  const activeFor = activeIdx >= 0 ? (now - chapters[activeIdx].start) * fps : 999;
  const pop = interpolate(activeFor, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const c = COLOR[accent];
  const elapsed = Math.min(1, Math.max(0, now / total));

  const P =
    theme === 'light'
      ? {
          bg: '#FFFFFF',
          fg: '#111318',
          sep: '#BFC3C8',
          past: '#9AA0A8',
          future: '#BFC3C8',
          dotPast: '#C4C8CD',
          dotFuture: '#D8DBDF',
          track: 'rgba(17,19,24,0.10)',
          shadow: '0 1px 0 rgba(0,0,0,0.10)',
        }
      : {
          bg: 'rgba(10,12,16,0.86)',
          fg: '#FFFFFF',
          sep: 'rgba(255,255,255,0.34)',
          past: 'rgba(255,255,255,0.52)',
          future: 'rgba(255,255,255,0.34)',
          dotPast: 'rgba(255,255,255,0.30)',
          dotFuture: 'rgba(255,255,255,0.20)',
          track: 'rgba(255,255,255,0.16)',
          shadow: '0 1px 0 rgba(255,255,255,0.10)',
        };

  return (
    <div
      data-qc="chapter-nav"
      data-qc-id="ChapterNav"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 30,
        paddingRight: 30,
        background: P.bg,
        borderBottom: underline ? `3px solid ${c}` : 'none',
        boxShadow: underline ? 'none' : P.shadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexShrink: 0 }}>
        <span
          style={{
            fontFamily: FONT.en,
            fontWeight: 800,
            fontSize: SIZE.t4Lg,
            letterSpacing: '0.05em',
            color: P.fg,
          }}
        >
          {brand}
        </span>
        {series ? (
          <>
            <span style={{ fontFamily: FONT.zh, fontWeight: 500, fontSize: SIZE.t4Lg, color: P.sep }}>/</span>
            <span style={{ fontFamily: FONT.zh, fontWeight: 700, fontSize: SIZE.t4Lg, color: P.fg }}>
              {series}
            </span>
          </>
        ) : null}
      </div>

      <div
        style={{
          position: 'relative',
          flex: 1,
          height: '100%',
          marginLeft: 46,
          marginRight: showTime ? 160 : 8,
        }}
      >
        {progress ? (
          <>
            {/* 轨道铺满整段章节区：有轨道才读得出「一条完整的条在走」，
                只画填充会被看成下划线。填充严格 now/total，不加重映射。 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: progressHeight,
                background: P.track,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                width: `${elapsed * 100}%`,
                height: progressHeight,
                background: c,
              }}
            />
            {/* 走针头：让「走到哪」有个可指的实体，否则细线在手机上看不清 */}
            <div
              style={{
                position: 'absolute',
                left: `${elapsed * 100}%`,
                bottom: -progressHeight,
                width: progressHeight * 3,
                height: progressHeight * 3,
                borderRadius: progressHeight * 1.5,
                marginLeft: -(progressHeight * 1.5),
                background: c,
              }}
            />
          </>
        ) : null}
        {(() => {
          // 章节多、段又短时标签会撞在一起。按近似字宽（中文 1em、西文 0.58em）
          // 在像素空间里推进一个占位游标，放不下就只留圆点、不写字。
          const usablePx = canvasWidth * 0.66; // 扣掉左品牌区和右时间码后的可用宽带
          const measure = (t: string) =>
            [...t].reduce((w, chr) => w + (/[㐀-鿿＀-￯]/.test(chr) ? 1 : 0.58), 0) * SIZE.t4Sm;
          let occupiedUntil = -Infinity;
          return chapters.map((ch, i) => {
          const isActive = i === activeIdx;
          const isPast = now >= ch.end;
          const leftPct =
            layout === 'even'
              ? (i / chapters.length) * 100
              : (ch.start / total) * 100;
          const atPx = (leftPct / 100) * usablePx;
          const showText = i === 0 || atPx >= occupiedUntil;
          if (showText) occupiedUntil = atPx + measure(ch.label) + 16; // 圆点10 + 间隙9，留一点余量
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                whiteSpace: 'nowrap',
              }}
            >
              {isActive ? (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: c,
                    flexShrink: 0,
                    transform: `scale(${0.6 + 0.4 * pop})`,
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 10,
                    fontSize: SIZE.t4Sm,
                    lineHeight: 1,
                    textAlign: 'center',
                    color: isPast ? P.dotPast : P.dotFuture,
                    flexShrink: 0,
                  }}
                >
                  ·
                </span>
              )}
              {showText ? (
                <span
                  style={{
                    fontFamily: FONT.zh,
                    fontWeight: isActive ? 700 : 500,
                    fontSize: SIZE.t4Sm,
                    color: isActive ? P.fg : isPast ? P.past : P.future,
                    transform: `scale(${isActive ? 1.06 : 1})`,
                    transformOrigin: 'left center',
                  }}
                >
                  {ch.label}
                </span>
              ) : null}
            </div>
          );
          });
        })()}
      </div>

      {showTime ? (
        <div
          style={{
            position: 'absolute',
            right: 30,
            display: 'flex',
            alignItems: 'baseline',
            gap: 7,
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ fontFamily: FONT.en, fontWeight: 800, fontSize: SIZE.t4Lg, color: P.fg }}>
            {fmt(now)}
          </span>
          <span style={{ fontFamily: FONT.en, fontWeight: 600, fontSize: SIZE.t4Sm, color: P.dotPast }}>/</span>
          <span style={{ fontFamily: FONT.en, fontWeight: 600, fontSize: SIZE.t4Lg, color: P.past }}>
            {fmt(total)}
          </span>
        </div>
      ) : null}
    </div>
  );
};
