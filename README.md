# clawd-watercolor-mv

一个 Claude skill：用 p5.brush 制作 Clawd 水彩风格的音乐 MV。输入原曲 MP3 和歌词时间线，按“分镜 → 镜头代码 → 检查 → 渲染 → MP4”的流程出片，需要时还能出 4:3 / 3:4 封面。流程沉淀自十部 MV（等待、Two Moons、Highway、赤壁、Whiskey、春风吹、遇见、冬天一个游、电动少女、丸之內虐待狂）。

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

## 目录

```
clawd-watercolor-mv/
├── SKILL.md               主说明：流程和规则
├── scripts/new_project.sh  一条命令建新工程
├── reference/
│   ├── api.md             函数速查
│   ├── pitfalls.md        踩坑清单
│   └── past-films.md      旧片里可借的场景与手法
└── template/              能直接跑的模板工程：引擎、渲染、封面、工具、打过补丁的 p5.brush
```

## 说明

- 模板工程已经放在 skill 里。新片用 `scripts/new_project.sh` 从模板建，不再依赖某部旧片的工程。
- `new_project.sh` 会自动 `npm install`；第二个参数给一个已有工程，就改为克隆它的 `node_modules`。
- 渲染用 puppeteer-core 驱动本机 Chrome，按 Mac 本机写的。在云端会话里用时，见 `reference/pitfalls.md` 里的 `render_watch.mjs` 队列。
- `reference/past-films.md` 里的旧片路径是作者本机的，换机器时只作参考。
