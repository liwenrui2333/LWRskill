import fs from 'node:fs';

// SRT → 带时间轴的口播稿。只做解析和统计，章节划分交给 AI 读文本决定。
// 用法: node scripts/srt-to-transcript.mjs <file.srt> [--json]
const path = process.argv[2];
const asJson = process.argv.includes('--json');
if (!path) {
  console.error('用法: node scripts/srt-to-transcript.mjs <file.srt> [--json]');
  process.exit(1);
}

const toSec = (s) => {
  const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
};

const raw = fs.readFileSync(path, 'utf8').replace(/\r/g, '');
const cues = [];
for (const block of raw.split(/\n{2,}/)) {
  const lines = block.split('\n').filter((l) => l.trim());
  if (!lines.length) continue;
  const idx = lines.findIndex((l) => l.includes('-->'));
  if (idx < 0) continue;
  const [a, b] = lines[idx].split('-->');
  const start = toSec(a);
  const end = toSec(b);
  if (start === null || end === null) continue;
  const text = lines.slice(idx + 1).join(' ').trim();
  if (text) cues.push({ start, end, text });
}

if (!cues.length) {
  console.error(`没解析出字幕条目: ${path}`);
  process.exit(1);
}

const total = cues[cues.length - 1].end;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

if (asJson) {
  console.log(JSON.stringify({ file: path, total, cues }, null, 2));
} else {
  console.log(`# ${path}`);
  console.log(`总时长 ${fmt(total)}（${total.toFixed(1)}s），${cues.length} 条字幕\n`);
  for (const c of cues) {
    console.log(`[${c.start.toFixed(1)}s] ${c.text}`);
  }
  console.log(`\n--- 以上为全文。先通读，理解观众路径，再切段。`);
}
