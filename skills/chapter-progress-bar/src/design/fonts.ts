// 字体一律走本地 npm 包（@fontsource，woff2 打进 bundle），禁止运行时从 Google Fonts 拉。
// 国内网络拉不到中文分包时会静默退化成宋体，是这类工程最常见的翻车点。
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
