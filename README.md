# LWRskill

我自己写的 Claude Code / Codex skill 集合。一个 skill 一个目录，放在 `skills/` 下，
每个目录自带 `SKILL.md`，格式遵循 [Claude Code Skills](https://code.claude.com/docs/en/skills)。

## 安装

把想要的目录拷进 `~/.claude/skills/`（或 `~/.codex/skills/`）：

```bash
cp -r skills/liwenrui-chapter-progress-bar ~/.claude/skills/
```

重启 Claude Code 后生效。也可以整个仓库克隆后软链：

```bash
git clone https://github.com/liwenrui2333/LWRskill.git
ln -s "$(pwd)/LWRskill/skills/liwenrui-chapter-progress-bar" ~/.claude/skills/
```

## 目前有的

| skill | 做什么 | 依赖 |
|---|---|---|
| [liwenrui-chapter-progress-bar](skills/liwenrui-chapter-progress-bar/) | 给成片加顶部章节进度条（品牌 + 环节名 + 时间码 + 填充条）。吃 SRT 或章节 JSON，出透明 ProRes 素材给剪映，或直接烧到 mp4 | Node 18+、Remotion、FFmpeg |

## 目录约定

```
skills/<skill-name>/
├── SKILL.md          # 必需：frontmatter(name/description) + 使用说明
├── README.md         # 可选：给人看的完整文档
├── scripts/          # 可选：可直接跑的脚本
├── src/              # 可选：组件源码（Remotion / HTML 等）
└── examples/         # 可选：样例输入
```

`SKILL.md` 的 `description` 决定什么时候会被触发，写清「用户说什么话时该用」比写功能更有用。

## License

各 skill 目录内自带 LICENSE。没有的话按 MIT 处理。
