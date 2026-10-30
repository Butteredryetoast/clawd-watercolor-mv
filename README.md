# clawd-watercolor-mv

一个 Claude skill：用 p5.brush 制作 Clawd 水彩风格的音乐 MV。输入原曲 MP3 和歌词时间线，按“分镜 → 镜头代码 → 检查 → 渲染 → MP4”的流程出片。流程沉淀自《等待》MV 工程。

## 安装

### Claude Code（本机）

```bash
git clone https://github.com/Butteredryetoast/clawd-watercolor-mv.git
mkdir -p ~/.claude/skills
cp -r clawd-watercolor-mv/clawd-watercolor-mv ~/.claude/skills/
```

然后在 Claude Code 里输入 `/clawd-watercolor-mv` 调用。只想在某个工程里用，就复制到该工程的 `.claude/skills/` 下。

### claude.ai

在 claude.ai 的 skills 设置里上传 `clawd-watercolor-mv` 文件夹（打成 zip）。

## 说明

- 这份 skill 依赖一个本地模板工程（《等待》，SKILL.md 里写了路径），换机器使用时要改成你自己的模板路径。
- 第 5 节“环境与渲染”是按云端会话 + 连接 Mac 的方式写的；在 Mac 本机运行 Claude Code 时，可以直接 `npm install` 并用本机 Chrome 运行 `node render.mjs`。
