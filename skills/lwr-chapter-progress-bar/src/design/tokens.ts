// 独立版本的最小设计 token —— 从原工程 src/design/tokens.ts 摘出本组件用到的值。
// 颜色只保留四语义 + 基础色，字号只留本组件用到的两档（T4 档）。
// 改这里等于改全片观感，改前想清楚。

export const COLOR = {
  blue: '#4D9EFF',
  green: '#3DDC84',
  yellow: '#FFC53D',
  red: '#FF4D4D',
  white: '#FFFFFF',
  grey: '#B7BDC6',
  greyDim: '#7A8089',
} as const;

export type SemanticColor = 'blue' | 'green' | 'yellow' | 'red';

export const FONT = {
  zh: '"Noto Sans SC"',
  en: '"Inter"',
} as const;

// 字号阶梯（1080p 基准）。本组件只用到 T4 两档：
// t4Lg=25（品牌名 / 时间码），t4Sm=17（章节名 / 分隔符）。
// 不要在这里加阶梯外字号——4K 导出靠整体 scale，不靠改数值。
export const SIZE = {
  t4Lg: 25,
  t4Sm: 17,
} as const;
