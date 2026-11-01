import { Config } from '@remotion/cli/config';

// 入口固化，避免 CLI 依赖自动探测
Config.setEntryPoint('./src/index.ts');

// 透明素材必须用 png 中间帧；jpeg 没有 alpha，会直接丢掉透明通道
Config.setVideoImageFormat('png');

// 同名输出直接覆盖，避免自动化流程卡在交互式确认
Config.setOverwriteOutput(true);
