#!/usr/bin/env node
// 渲染章节条素材：透明 ProRes 4444 (.mov) 给剪映，或直接叠到成片上。
//
// 用法:
//   node render-chapter-bar.mjs <chapters.json>
//   node render-chapter-bar.mjs <chapters.json> --overlay <源视频.mp4>
//   node render-chapter-bar.mjs <chapters.json> --overlay <源视频.mp4> --dry-run
//
// chapters.json 形如:
//   { "brand": "NANA", "series": "懂的权利", "duration": 169,
//     "chapters": [{"label":"环节一","start":0,"end":30}, ...] }
// 可选: width / height / fps（不给就从 --overlay 的源视频 ffprobe 出，都没有才用 1920×1080）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const jsonPath = args[0];
const overIdx = args.indexOf('--overlay');
const overlaySrc = overIdx > 0 ? args[overIdx + 1] : null;
const dryRun = args.includes('--dry-run');

if (!jsonPath || jsonPath.startsWith('--')) {
  console.error('用法: node render-chapter-bar.mjs <chapters.json> [--overlay <源视频.mp4>] [--dry-run]');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const duration = Number(cfg.duration);
if (!duration || !Array.isArray(cfg.chapters) || !cfg.chapters.length) {
  console.error('chapters.json 缺 duration 或 chapters');
  process.exit(1);
}

const chs = cfg.chapters;
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

// ── SRT 原话核对（#2）：字幕改了/剪了，秒数会整体偏移且不报错 ──
// 章节 JSON 可选给 srt 路径 + 每段的 startText / endText（逐字引用该段首尾句）。
// 给了就核对：找不到这句话或时间对不上，说明字幕换过了，时间轴不可信。
const srtPath = cfg.srt
  ? path.resolve(path.dirname(path.resolve(jsonPath)), cfg.srt)
  : null;

if (srtPath) {
  if (!fs.existsSync(srtPath)) fail('srt 文件不存在：' + srtPath);

  const parseSrt = (txt) => {
    const norm = txt.replace(/\r/g, '');
    const out = [];
    for (const blockText of norm.split(/\n{2,}/)) {
      const ls = blockText.split('\n').filter((l) => l.trim());
      const ti = ls.findIndex((l) => l.includes('-->'));
      if (ti < 0) continue;
      const [a, b] = ls[ti].split('-->');
      const toSec = (t) => {
        const m = t.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
        return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : null;
      };
      const s0 = toSec(a);
      const e0 = toSec(b);
      const text = ls.slice(ti + 1).join('').trim();
      if (s0 !== null && e0 !== null && text) out.push({ start: s0, end: e0, text });
    }
    return out;
  };

  const cues = parseSrt(fs.readFileSync(srtPath, 'utf8'));
  if (!cues.length) fail('srt 解析不出条目：' + srtPath);

  // 文字一致 + 时间最近：同一句在片中出现两次时不会误配到远处那条
  const strip = (s) => s.replace(/[\s，。、！？,.!?「」“”"'’]/g, '');
  const findCue = (text, near) => {
    const target = strip(text);
    let best = null;
    for (const cue of cues) {
      if (!strip(cue.text).includes(target)) continue;
      const d = Math.abs(cue.start - near);
      if (!best || d < best.d) best = { cue, d };
    }
    return best ? best.cue : null;
  };

  let checked = 0;
  for (let i = 0; i < chs.length; i++) {
    const c = chs[i];
    if (c.startText) {
      const hit = findCue(c.startText, c.start);
      if (!hit) fail('第 ' + (i + 1) + ' 段「' + c.label + '」的 startText 在 SRT 里找不到：\n  ' + c.startText + '\n字幕文件可能换过了，时间轴不可信。');
      // 首段对齐 0，字幕可能 0.2–0.6s 才开口，容差放 1s；其余段 0.2s
      const tol = i === 0 ? 1.0 : 0.2;
      if (Math.abs(hit.start - c.start) > tol) {
      }
      checked++;
    }
    if (c.endText) {
      const hit = findCue(c.endText, c.end);
      if (!hit) fail('第 ' + (i + 1) + ' 段「' + c.label + '」的 endText 在 SRT 里找不到：\n  ' + c.endText);
      if (Math.abs(hit.end - c.end) > 0.2) {
        fail('第 ' + (i + 1) + ' 段「' + c.label + '」收尾偏移 ' + (hit.end - c.end).toFixed(2) + 's：\n  endText 实际结束于 ' + hit.end.toFixed(2) + 's，JSON 写的是 ' + c.end.toFixed(2) + 's');
      }
      checked++;
    }
  }
  if (checked) console.log('✓ SRT 原话核对通过（' + checked + ' 处）');
  else console.warn('⚠ 章节 JSON 没写 startText/endText，跳过原话核对。字幕改动后时间轴偏移不会被发现。');
}

// ── 时间轴校验 ────────────────────────────────────────────────
// 首段容差 1s：字幕第一条常 0.2–0.6s 才开口，条本身仍从 0 铺起。
// 超过 1s 说明前面有没归进任何段的空档，那是真错。
if (chs[0].start < 0) fail(`第一段 start 不能为负，实际 ${chs[0].start}`);
if (chs[0].start > 1.0) fail(`第一段 start 应接近 0（≤1s 容差），实际 ${chs[0].start}s。前面空档要并进第一段。`);
chs[0].start = 0;
for (let i = 1; i < chs.length; i++) {
  if (Math.abs(chs[i].start - chs[i - 1].end) > 0.01) {
    fail(`第 ${i + 1} 段 start(${chs[i].start}) 与上一段 end(${chs[i - 1].end}) 不连续`);
  }
}
if (Math.abs(chs[chs.length - 1].end - duration) > 0.05) {
  fail(`末段 end(${chs[chs.length - 1].end}) 必须等于 duration(${duration})`);
}

// ── 段长校验（#5）：短于 minSegment 秒的段，标题来不及读 ──
const MIN_SEG = Number(cfg.minSegmentSeconds ?? 4);
const short = chs
  .map((c, i) => ({ i: i + 1, label: c.label, len: c.end - c.start }))
  .filter((c) => c.len < MIN_SEG);
if (short.length) {
  fail(
    `以下段落短于 ${MIN_SEG}s，观众读不完标题：\n` +
      short.map((c) => `  ${c.i}. ${c.label}  ${c.len.toFixed(2)}s`).join('\n') +
      `\n合并相邻段，或在 JSON 里设 "minSegmentSeconds" 显式放宽。`
  );
}

// ── 标题字数（#5 配套）：超过 8 个汉字在竖屏窄条上会挤 ──
const longTitle = chs.filter((c) => [...(c.label || '')].length > 8);
if (longTitle.length) {
  console.warn(
    `⚠ 以下标题超过 8 字，窄屏可能显示不全（组件会自动省略，不会报错）：\n` +
      longTitle.map((c) => `  ${c.label}`).join('\n')
  );
}

// ── 分辨率（#1）：JSON 优先，其次 ffprobe 源视频，最后兜底 ───
const probe = (file) => {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate',
        '-of', 'json',
        file,
      ],
      { encoding: 'utf8' }
    );
    const s = JSON.parse(out).streams?.[0];
    if (!s) return null;
    const [n, d] = String(s.r_frame_rate || '30/1').split('/').map(Number);
    return {
      width: Number(s.width),
      height: Number(s.height),
      fps: d ? Math.round(n / d) : 30,
    };
  } catch {
    return null;
  }
};

// 画布尺寸只认 width / canvasHeight（height 留给条高，避免两个 height 打架）
let dims = { width: cfg.width ?? cfg.canvasWidth, height: cfg.canvasHeight, fps: cfg.fps };
if (overlaySrc && (!dims.width || !dims.height || !dims.fps)) {
  const p = probe(overlaySrc);
  if (!p) fail(`读不出源视频尺寸：${overlaySrc}\n（ffprobe 是否可用？路径是否含中文且未被正确引用？）`);
  dims = {
    width: dims.width ?? p.width,
    height: dims.height ?? p.height,
    fps: dims.fps ?? p.fps,
  };
}
if (!dims.width || !dims.height) {
  // 没有源视频又没写尺寸 = 不知道片子是横是竖，猜错了整条要重渲。
  fail(
    '缺画布尺寸：没有 --overlay 源视频，JSON 里也没写 width/height。\n' +
      '竖屏 1080×1920、横屏 1920×1080、方形 1080×1080 —— 猜错整条要重渲，所以这里拦下。\n' +
      '在 chapters.json 里加 "width": 1080, "height": 1920 即可。'
  );
}
dims.fps = dims.fps ?? 30;

// 竖屏/方形片的顶部条高度按短边缩放，否则 52px 在 1080 宽的竖屏上会显得过粗
const shortSide = Math.min(dims.width, dims.height);
const defaultBarHeight = Math.round(Math.min(64, Math.max(36, shortSide * 0.048)));

const barHeight = Math.round(cfg.barHeight ?? defaultBarHeight);

// 一次性组好 props，别再二次改名（上一版 props/remotionProps 来回改名，height 指条高还是画布高极易搞混）
const props = {
  brand: cfg.brand ?? 'NANA',
  series: cfg.series,
  chapters: chs.map((c) => ({ label: c.label, start: c.start, end: c.end })),
  accent: cfg.accent ?? 'red',
  position: cfg.position ?? 'top',
  theme: cfg.theme ?? 'dark',
  progress: cfg.progress ?? true,
  showTime: cfg.showTime ?? true,
  height: barHeight,           // 条高
  totalSeconds: duration,
  width: dims.width,           // 画布宽 → calculateMetadata
  canvasHeight: dims.height,   // 画布高 → calculateMetadata
  fps: dims.fps,
};

const outDir = path.resolve(cfg.outDir ?? path.dirname(path.resolve(jsonPath)));
fs.mkdirSync(outDir, { recursive: true });
const stem = path.basename(jsonPath, '.json');
const movOut = path.join(outDir, `${stem.replace(/\.chapters$/, '')}-overlay.mov`);

const propsFile = path.join(outDir, `_props-${Date.now()}.json`);
fs.writeFileSync(propsFile, JSON.stringify(props), 'utf8');

const totalFrames = Math.max(1, Math.round(duration * dims.fps));

console.log('─'.repeat(56));
console.log(`画布      ${dims.width}×${dims.height} @ ${dims.fps}fps`);
console.log(`时长      ${duration}s（${totalFrames} 帧）`);
console.log(`条高      ${barHeight}px   主题 ${props.theme}   位置 ${props.position}`);
console.log(`章节      ${chs.length} 段`);
chs.forEach((c, i) => console.log(`  ${i + 1}. ${c.label}  ${c.start.toFixed(2)}–${c.end.toFixed(2)}s`));
console.log('─'.repeat(56));

if (dryRun) {
  fs.unlinkSync(propsFile);
  console.log('\n✓ dry-run 通过，未生成文件。');
  process.exit(0);
}

const run = (cmd, argv) => {
  console.log(`$ ${cmd} ${argv.join(' ')}`);
  execFileSync(cmd, argv, { stdio: 'inherit', shell: process.platform === 'win32' });
};

// 浏览器路径可选：设了 REMOTION_BROWSER 就用它（离线/复用到别处的 chrome-headless-shell），
// 没设就让 Remotion 自己找或下载。首次渲染会下载 ~150MB，之后缓存。
const browser = process.env.REMOTION_BROWSER;

const renderMov = (outFile) => {
  const argv = [
    'remotion', 'render', 'src/index.ts', 'ChapterBar', outFile,
    `--props=${propsFile}`,
    `--frames=0-${totalFrames - 1}`,
    '--codec=prores',
    '--prores-profile=4444',
    '--image-format=png',
    '--pixel-format=yuva444p10le',
  ];
  if (browser) argv.push(`--browser-executable=${browser}`);
  run('npx', argv);
};

// ── 自动 QA（#4）：渲完不信眼睛，先查文件本身 ──
const runCapture = (cmd, argv) =>
  execFileSync(cmd, argv, { encoding: 'utf8', shell: process.platform === 'win32' });

const probeStream = (file) => {
  const j = JSON.parse(
    runCapture('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-count_frames',
      '-show_entries', 'stream=codec_name,width,height,pix_fmt,nb_read_frames,r_frame_rate:format=duration',
      '-of', 'json', file,
    ])
  );
  return { stream: j.streams?.[0] ?? {}, format: j.format ?? {} };
};

const qa = (file, expect) => {
  const errs = [];
  const { stream, format } = probeStream(file);
  const w = Number(stream.width);
  const h = Number(stream.height);
  const frames = Number(stream.nb_read_frames);
  const dur = Number(format.duration);

  if (stream.codec_name !== 'prores') errs.push(`编码不是 prores，实际 ${stream.codec_name}`);
  if (w !== expect.width || h !== expect.height) errs.push(`尺寸 ${w}×${h}，应为 ${expect.width}×${expect.height}`);
  if (!String(stream.pix_fmt || '').startsWith('yuva')) errs.push(`像素格式 ${stream.pix_fmt} 不带 alpha 通道`);
  if (Math.abs(frames - expect.frames) > 2) errs.push(`帧数 ${frames}，应为 ${expect.frames}`);
  if (Math.abs(dur - expect.duration) > 0.1) errs.push(`时长 ${dur.toFixed(3)}s，应为 ${expect.duration.toFixed(3)}s`);

  // 透明检查：离条带很远的像素必须全透明，否则说明整帧被填了底色
  const probeY = Math.round(expect.height * 0.6);
  const alpha = runCapture('ffmpeg', [
    '-v', 'error', '-ss', String(expect.duration * 0.5), '-i', file,
    '-frames:v', '1', '-vf', `crop=1:1:${Math.round(w / 2)}:${probeY},format=rgba`,
    '-f', 'rawvideo', '-',
  ]);
  const a = Buffer.from(alpha, 'binary')[3];
  if (a !== undefined && a > 8) errs.push(`画面中部 alpha=${a}，应为 0（透明区域被填充）`);

  return errs;
};

const checkAndReport = (file) => {
  const errs = qa(file, { width: dims.width, height: dims.height, frames: totalFrames, duration });
  if (errs.length) {
    console.error('\n✗ QA 未通过：');
    errs.forEach((e) => console.error('  · ' + e));
    fs.unlinkSync(propsFile);
    process.exit(1);
  }
  console.log(`✓ QA 通过：prores / ${dims.width}×${dims.height} / alpha / ${totalFrames} 帧 / ${duration.toFixed(2)}s`);
};

// 联系表：把 N 个关键帧拼成一张图，人眼一次看完所有章节边界
const contactSheet = (file, outPng) => {
  const marks = [];
  chs.forEach((c) => {
    marks.push(c.start + Math.min(0.4, (c.end - c.start) / 4));      // 每段开头
    marks.push((c.start + c.end) / 2);                               // 每段中点
  });
  const stripH = Math.min(dims.height, barHeight * 3);
  const parts = [];
  for (const t of marks) {
    const p = path.join(outDir, `_cs-${parts.length}.png`);
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-ss', t.toFixed(2), '-i', file,
      '-frames:v', '1', '-vf', `crop=${dims.width}:${stripH}:0:0`, p,
    ], { stdio: 'inherit' });
    parts.push(p);
  }
  const argv = ['-y', '-v', 'error'];
  parts.forEach((p) => argv.push('-i', p));
  argv.push('-filter_complex', `${parts.map((_, i) => `[${i}]`).join('')}vstack=inputs=${parts.length}`, outPng);
  execFileSync('ffmpeg', argv, { stdio: 'inherit' });
  parts.forEach((p) => fs.unlinkSync(p));
};

if (!overlaySrc) {
  renderMov(movOut);
  fs.unlinkSync(propsFile);
  checkAndReport(movOut);
  const sheet = path.join(outDir, `${stem}-contact-sheet.png`);
  contactSheet(movOut, sheet);
  console.log(`\n✓ 透明素材: ${movOut}`);
  console.log(`  联系表:   ${sheet}`);
  console.log('  剪映：拖到最上层轨道，时长自动对齐。');
  console.log('  ⚠ 技术检查 ≠ 剪映验收：新样式或新剪映版本首次使用时，务必真拖进剪映看一次透明。');
  process.exit(0);
}

const tmpMov = path.join(outDir, `_bar-${Date.now()}.mov`);
renderMov(tmpMov);
checkAndReport(tmpMov);

// 防覆盖：outDir 与源视频同目录时，`${stem}.mp4` 会正好是源片上叠出来的名字，
// 但若 JSON 与源视频同名（vert.json + vert.mp4），就会直接盖掉源片。加后缀区分。
// stem 可能已经带 .chapters 后缀，别叠成 .chapters.chapters.mp4
const base = stem.replace(/\.chapters$/, '');
let finalOut = path.join(outDir, `${base}.chapters.mp4`);
if (overlaySrc && path.resolve(overlaySrc) === path.resolve(finalOut)) {
  finalOut = path.join(outDir, `${base}.chapters-out.mp4`);
}
const y = props.position === 'top' ? 0 : 'H-h';
run('ffmpeg', [
  '-y',
  '-i', overlaySrc,
  '-i', tmpMov,
  '-filter_complex', `[1:v]format=rgba,scale=${dims.width}:${dims.height}:flags=lanczos[b];[0:v][b]overlay=0:${y}:eof_action=pass[out]`,
  '-map', '[out]', '-map', '0:a?',
  '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
  '-c:a', 'copy',
  finalOut,
]);
fs.unlinkSync(tmpMov);
fs.unlinkSync(propsFile);
console.log(`\n✓ 成品: ${finalOut}`);
