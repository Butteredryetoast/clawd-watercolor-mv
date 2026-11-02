---
name: "clawd-watercolor-mv"
description: "Use when making or fixing a hand-painted watercolor (p5.brush) animated music video — Clawd or Q-style human cast — from a song MP3 plus an LRC or lyric-timeline JSON: storyboard, sample clip, shot code, full-film render to MP4, or problems in such a project (flickering subtitles, slow frames, vanishing strokes, broken transitions, audio sync). 水彩 MV、歌词分镜、样片、全片渲染。"
---

# Clawd 水彩 MV

输入：**原曲 MP3** 和**歌词时间线**。时间线最好是机器校验版 JSON；只有 LRC 也行。
输出：全片 1080p MP4 和 720p 分享版（都带原曲）、检查拼图、总览图、README，最后拷到老大桌面。

可复用的东西都在这个 skill 目录里（下文的 `SK`）：
- `template/`：一个能直接跑的工程，含引擎、渲染器、打过补丁的 p5.brush、通用场景库 kit.js、可选的人物骨架 person.js，以及全部工具。
- `reference/api.md`：函数速查。
- `reference/pitfalls.md`：踩坑清单，写代码前先扫一遍。
- `reference/past-films.md`：八部旧片里有哪些场景和手法可以借。
- `scripts/new_project.sh`：建新工程。

**不要再去复制某部旧片的工程当模板**。旧片只用来借具体的场景函数。

## 0. 先确认（一次问清）
- MP3、LRC 或 JSON 的路径；分镜是否已经确认。**分镜确认之前不写镜头代码**。
- 新工程目录：放在 `…/work/<英文名>`。是否先做 10–15 s 样片：默认先做。
- 老大这次的特别要求（比如笔触、场景、衔接、字幕），逐条记下，README 里逐条交代怎么做到的。

## 1. 建工程
```bash
bash SK/scripts/new_project.sh <work>/<Name> <work>/DongTian   # 第二个参数：从已有工程克隆 node_modules（APFS，秒完不占空间）
```
然后把 MP3 / LRC / JSON 复制进 `assets/`，在 `src/config.js` 里填 title、artist、slug、audio、duration、sample。

## 2. 音频与歌词
- 时长：取 JSON 的 `audio_duration_seconds`。没有 JSON 就用 ffprobe 读。
- 节拍：`node tools/beat.mjs` 输出 BPM、0.01 s 相位和分段相位，结果填进 `CONFIG.beat`。
  - 分段相位不一致，说明有渐快或渐慢，改用 `beat.map`。
  - 半速和倍速两个候选都要看。
  - 一律标“未人工核对”。
- 只有 LRC 时：
  - 先 `python3 tools/lrc_to_json.py --lrc=assets/x.lrc`：署名行会自动分到 credits，出点按长度估计，全部标待复听。
  - 需要机器估计出点时，再用 `tools/align_lyrics.py`：要用 mlx-whisper 的 Python 环境，首次会下载约 480 MB 模型，先问老大。这个脚本还没实测过。
- 写好 `STORYBOARD.md` 后跑 `python3 tools/build_data.py`，生成 lyrics.js 和 shotlist.js，并检查镜头首尾相接、无空档。

## 3. 分镜（老大已有就严格照做）
- 格式见 `template/STORYBOARD.md`：构想 → 规则 → 角色与道具（写明 clawd/person 参数）→ 每章一张表。
- 表头：`| 时间 (秒) | 歌词 | 画面（括号写运镜） | 表演 | 出 |`。build_data 认 `## N · 章名` 的标题和 `| a–b |` 开头的行。
- 每章只用一个场景。
- 副歌每次回到同一个固定舞台，逐次升级，只换调色。
- 重复的主歌沿用第一次的镜头语法，但更暗，表演反转。
- 每个镜头必须发生一件事，并且有运镜。
- 情绪用 `mood()` 换眼睛，再加 take 和 emote，不要硬切表情。
- 少用字：片名只出现一次，加一块署名；画内不复述歌词，不写招牌字。
- 转场由动作驱动，每行的“出”写清楚怎么转。
- 用一个逐次升级的道具或一根线索串起全片。
- 色彩弧线贯穿全片；首尾用同一构图。
- 有词的镜头从该句入点开始，吸收其后的空隙；无词段的切点对到拍点。
- 不改 Clawd 的基本剪影，角色区分只靠颜色和配件。

## 4. 写代码的硬规则
- **该写在哪**：
  - 每部片要重写的：`cast.js`（角色）、`props.js`（道具）、`world.js`（布局常量 + 按时间的故事状态）、`ch/cNN_*.js`（每章一个 IIFE，`chapter(name, start, end, [[t0, fn|null]…])`）。
  - 大场景单独成文件，放在 world.js 后面。新文件要加进 studio.html 的列表，dryrun 也读这个列表。
  - 通用的东西先到 `kit.js` 里找。
- **纯函数**：镜头函数 `fn(t, lt, dur)` 画整帧，是 t 的纯函数。
  - 不存状态，不用 `Math.random`，用 `hash(i)`。
  - 需要“过去”的效果，就从时间反推。
- **连续性**：跨镜头、跨章节的连续性只放在 world.js。
  - 道具换位置要有镜头内的动作解释。
  - 自己补的设定写进 README 的“待确认”。
- **手**：用 `clawdArmTip` / `armAngleTo` 落到道具上。面朝观众时，左手是 `aR`。
- **遮挡顺序**：身后的角色 → 桌面 → 桌上物 → 前景角色。
- **字幕区**：在 y 960 以下，关键表演放在它上面。
- **字幕底带和标题卡**：
  - 字幕底带由模板在合成层画，**不要用 `paint()` 画字幕底带或任何 UI 底板**，p5.brush 填色会随抖动每秒闪 12 次。
  - 大块深色的固定元素用 `steady(key, fn)` 包起来。
- **光与雪**：
  - 光晕用 `softGlow` / `glowDot`。
  - 积雪用 `snowLine`。
  - 浅底上不用纯白笔触。
  - 半透明角色加一道灰色轮廓线。
- **嵌套场景**：`nest()` 不裁剪，先画嵌套的场景，再在四周画墙盖住溢出部分。
- **性能**：
  - 大背景用 `bg()`。
  - 物件先 `vis()` 再画。
  - 帧慢时用 `tools/profile.mjs` 找原因，别猜。
- **转场**：
  - 先在镜头内用动作衔接（旋涡、坠落、浸色、推进窗户）。
  - 剩下的硬切在 `TRANSITIONS` 里加：whip / bloom / smoke / paint / paper / clock / splash。
  - 转场前若有 emote 字符，先 `flushLetters()`。
- **命名**：函数名不能和 p5 全局重名，例如 `cone`、`panorama`。

## 5. 渲染（这台 Mac：Chrome + Metal）
- 在 Claude Code 桌面版里直接用后台 Bash 跑渲染。用 Cowork VM 时，改用 `tools/render_watch.mjs` 队列，见 pitfalls。
- 开渲前先 `df -h /`：每帧约 530 KB，4 分钟的片约 3.2 GB。
- 样片：`node render.mjs --sample`。
- 全片：
  - `node render.mjs --frames=0:<duration> --workers=3 > out/render_full.log`，用 `run_in_background`。
  - 有效速度约 0.3–1.2 s/帧。
  - 可以断点续渲；每 300 帧自动换页。
- 合成：`node render.mjs --encode --out=out/<slug>.mp4`。

## 6. 验证（每轮都跑）
1. `node tools/dryrun.mjs --step=0.25`：0 报错，并看最重的帧。
2. 每章一张 0.5 s 间隔的拼图：`--sheet=a:b:0.5 --cols=6 --w=400`。用 Read 逐张看构图、遮挡、道具连续、字幕区、转场前中后三帧。
3. `node render.mjs --verify=<几个时间>`：乱序重渲要逐像素一致。
4. 成片：`node tools/finish.mjs`。它会：
   - 核对帧数和时长；
   - 在 10%、50%、90% 三处做音轨互相关，偏移必须是 0 ms；
   - 出每 4 s 一格的总览图和放大的两半，用 Read 看；
   - 转 720p；
   - 拷到 `~/Desktop/MV制作/<歌手 - 歌名>/`。会先找已有的同名文件夹，永不覆盖。
5. 闪烁一类的问题，要连续渲 4 个相隔 1/12 s 的时刻，裁出同一区域比较。

## 7. 交付
1. **样片**：MP4、检查图和 README，等老大确认。
2. **全片**：逐章写 → dryrun → 每章拼图 → 修 → 渲染 → encode → finish.mjs。
3. 用 SendUserFile 发 720p 和总览图。
4. README 按 `template/README.md` 写，必须包括：
   - 章节表；
   - 怎么满足老大这次的要求；
   - 运行命令；
   - 与模板的差异；
   - 未核对的节拍、歌词和自己补的设定；
   - 成片信息。
5. 如实说明哪些只看了拼图、没有完整带声播放。
6. 不删老大的文件。帧文件删不删让老大决定；旧帧只用 `mv -n` 改名。

## 常见错误（全表见 reference/pitfalls.md）

| 症状 | 做法 |
|---|---|
| 字幕底框或大块深色在闪 | 合成层底带（模板已做）/ `steady()` / `boil: 0` |
| 线条消失、变点 | 用模板的 `vendor/p5.brush.js`，不要换回 npm 版 |
| 一帧 2 秒以上 | `profile.mjs` 定位；只画亮窗；`FILL_MIN`；光晕用 wash；`vis()` |
| 积雪或粗笔推镜后变成灰胶囊 | `snowLine` |
| 嵌套窗景溢出窗框 | 先画嵌套场景，再分 4 块画墙 |
| 页面卡死不加载 | 函数和 p5 全局重名 |
| `Cannot access … before initialization` / `X is not defined` | 定义顺序；timeline.js 比 cast.js 先加载 |
| 拷桌面失败 | 老大挪过文件夹，finish.mjs 会去找 |
