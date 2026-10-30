---
name: "clawd-watercolor-mv"
description: "Make a Clawd watercolor (p5.brush) music video from an MP3 plus a lyric timeline: storyboard, shot code, checks, Mac render, MP4. Use for any new song MV in this style."
---

# Clawd 水彩 MV 制作流程（《等待》工程沉淀）

输入：**原曲 MP3** + **歌词时间线**（机器校验版 JSON 最好；LRC / CSV / SRT 也可）。
输出：全片 1080p MP4 + 720p 分享版（带原曲）、检查拼图、运行说明，并拷到用户桌面。

模板工程（用户 Mac）：`/Users/mac/Documents/Codex/2026-10-29/https-github-com-johnheibel-pdoomvideo-https/work/DengDai`（《等待》，已有全部框架、工具、角色、道具、转场、笔触）。源头是 PDoomVideo（同目录 `work/PDoomVideo`）。新歌一律**复制 DengDai 到独立新目录**再改，不要改旧工程。

## 0. 先确认的事（一次问清）
- MP3、歌词时间线、已确认分镜的路径。若还没有分镜：先按第 2 节拟分镜给用户确认，**确认前不写动画代码**。
- 新工程目录名、是否先做 10–15 秒样片（默认是）。
- 请求文件夹访问时一次性申请：工程父目录 + MP3 所在目录 + 桌面。

## 1. 音频与歌词数据
- `ffprobe` 读时长；以歌词 JSON 里的 `audio_duration_seconds` 为 `CONFIG.duration`（MP3 尾部填充会多出几十毫秒）。
- 节拍：用起音强度自相关估 BPM，再以 0.01 s 步长扫相位（粗扫会出半拍歧义）。分段估（0–1/3、1/3–2/3…）以发现渐快渐慢。**不要沿用模板的 BPM**；结果标“未人工核对”。镜头切点以分镜时间为准。
- 歌词入点用原 LRC，出点用机器对齐估计；**保留 review_priority / needs_audio_review 标记**，不要称为人工精确对齐。如果只给了 LRC，就把出点设为下一句入点，并标全部待复听。
- 改好 `assets/<歌名>-歌词时间线…json` 和 `STORYBOARD.md` 后跑 `python3 tools/build_data.py`（生成 `src/lyrics.js`、`src/shotlist.js`，并检查镜头无缝铺满 0–duration），再跑 `python3 tools/build_font.py`（中文字幕字体子集，Noto Serif CJK SC，OFL）。JSON 字段名不同就改 build_data.py 的读取部分。

## 2. 分镜设计（用户已有就严格照做）
格式沿用《等待》桌面 `等待-分镜.md`：构想 → 规则 → 角色与道具（带 clawd.js 参数）→ 统一手法 → 按章的表格 `| 时间 (秒) | 歌词(id+意象标签) | 画面（括号里写运镜） | 表演（eyes/emote/move/lid/take/sq…） | 出 |`。
方法（PDoomVideo STORYBOARD 的规则）：
- 每章只用一个场景；副歌每次回到同一个固定舞台并逐次升级；重复主歌沿用第一次的镜头语法但更暗、表演反转。
- 每个镜头必须发生一件事；每个镜头都有运镜；情绪用 `mood()` 换眼 + take + emote，不硬切表情。
- 少字：只留片名一次、署名、极少音效字；画内不复述歌词。
- 转场由动作驱动（坠落、吸入、旋转、涟漪、门）；每行“出”写清。色彩弧线贯穿全片；首尾同一构图。
- 一个逐次升级的道具（类似 P(doom) 仪表 / 杯塔）把故事串起来。
- 镜头时间：有词镜头从该句入点开始并吸收其后的空隙；无词段切点对到拍点；全片首尾相接无空档。
- 不改 Clawd 基本剪影；角色区分靠配件（draw/armL/armR 钩子）。
（用户的《歌词分镜设计》对话若另有补充规则，以用户确认的分镜为准。）

## 3. 工程结构（模板已有，只替换内容）
- `src/config.js`：音频路径、总时长、fps 24、节拍、字体、字幕样式、样片区间、各平台 Chrome 路径。**所有全局数字只在这里。**
- `src/clawd.js` 原样保留；`src/core.js`（绘制/镜头/关键帧）、`src/timeline.js`（章节调度、整句字幕、署名、复听角标、未绘镜头占位、TRANSITIONS）、`src/texture.js`（p5 笔触）、`studio.html`、`render.mjs` 通用。
- 每部片重写：`src/cast.js`（角色）、`src/props.js`（道具）、`src/world.js`（共用场景 + 故事状态）、`src/ch/cNN_*.js`（每章一个文件，IIFE，`chapter(name, start, end, [[t0, fn|null], …])`，未绘镜头写 null）。新章节要加到 studio.html 的 script 列表。

## 4. 写镜头的硬规则
- 镜头函数 `fn(t, lt, dur)` 画整帧，是 t 的纯函数：不存状态、不用 Math.random（用 `hash(i)`）。需要“过去”的效果就从时间反推（如气泡在 te=t0+k·Δ 生成，位置取 path(te)）。
- **跨镜头/跨章节的连续性只放在 world.js**：布局常量（CAFE）与按时间的状态函数（杯塔数、墙钟时间、灯光、道具在哪、她站在哪、卷帘门…）。章节只读不存。道具从一处到另一处必须有镜头内的动作解释，并在 README 的“需确认”里列出自己补的设定。
- 手与道具接触用 `clawdArmTip(x,y,u,pose,side)` 算，或反解姿势让手落在道具上；持物用 armL/armR 钩子（holdCup/holdKey/holdWatch …）。
- 遮挡顺序：身后的角色 → 桌面 → 桌上物 → 前景角色。角色要“离开座位”时切换到桌面之后绘制。
- 座位附近的小角色/道具不要挡住主角的杯子等关键道具（《等待》里方糖曾挡杯子）。
- 字幕带在 y 960 以下，关键表演保持在其上。
- 转场：镜头内用动作衔接（vortex/坠落/flash 浸色）；剩余硬切在 timeline.js `TRANSITIONS` 里加：`whip` 甩镜、`clock` 指针扫、`smoke` 白烟、`paper` 纸片、`bloom` 光晕、`paint` p5 笔刷擦除（自定颜色）。`flash` 前若有 emote 字符要先 `flushLetters()`。
- 笔触（texture.js）：`brushStrokes / swirlStrokes / stipple / bodyStrokes`，笔刷 `paint / bristle / stipple`。颜色取底色的深浅邻近色；**不要在浅底上用纯白笔触**（p5.brush 光谱混色会变灰）；sw 一般 0.8–2。半透明的烟/幽灵类角色加一道灰边线才看得见。
- 丰富场景：窗帘、盆栽、架子、墙画、窗外路人、漂浮粒子、树和飞鸟等放在共用场景函数里，一次加全片生效。

## 5. 环境与渲染（踩过的坑）
- 云端容器无 npm/CDN/GitHub 网络：依赖靠用户 Mac `npm install`（p5 2.3.3、p5.brush 2.2.3、puppeteer-core），云端只拷 `p5.min.js` 与 `p5.brush.js` 两个文件。
- 云端没有 GPU：SwiftShader 极慢，Mesa llvmpipe（`--use-gl=angle --use-angle=gl-egl`）快 4 倍但仍 30–120 s/帧，只用来做少量静帧。**正式渲染都在 Mac**（Chrome + Metal，约 0.4–2 s/帧，3 worker）。
- Mac 上的 device_bash 是 Linux VM（需约 17 GB 空闲磁盘才启动），能改文件、跑 ffmpeg，但用不了 Mac 的 Chrome。让用户在终端运行一次 `node tools/render_watch.mjs`（渲染队列，只接受 render.mjs 参数），然后把 `{"args":[...]}` 写进 `out/jobs/NN_name.job.json`，等 `.done`。不要用脚本自动化终端绕过电脑操控的点击限制。
- 云端→Mac 同步代码：在云端打 zip → `device_commit_files` 到 `out/src_update.zip` → device_bash 里用 python zipfile 解压。
- studio.html 的 `<audio>` 只在非 `?render` 时加载（否则页面等不到 networkidle）；渲染用 `waitUntil: 'load'`。
- 长渲染会崩标签页：render.mjs 已每 300 帧换页、出错重开/重启 Chrome 并重试；`--frames` 可断点续渲。旧帧只能 `mv -n` 改名（连接文件夹默认不能删）。
- device_bash 里的后台进程会被杀：ffmpeg 转码在前台单次 ≤170 s 内完成。

## 6. 验证（每轮都跑）
1. `node tools/dryrun.mjs --step=0.25`：不开浏览器跑全片，0 报错，并看每帧图形数。
2. 每章一张 0.5 s 间隔的检查拼图（`--sheet=a:b:0.5 --cols=6 --w=400`），用 Read 逐张看：构图、遮挡、道具连续、字幕区、转场前中后三帧。
3. `node render.mjs --verify=<几个时间>`：乱序重渲逐像素一致。
4. `python3 tools/sync_check.py --range=a:b --marks=...`：波形/起音/估计拍/切点/字幕/关键动作对照图。
5. 成片：`ffprobe` 帧数与时长；用音轨互相关在开头/中段/结尾核对偏移为 0；全片每 4 s 一帧总览图。

## 7. 交付顺序
1. 样片：选一段含角色表演 + 道具互动 + 转场的 10–15 s，`node render.mjs --sample` → MP4 + 检查图 + README，等用户确认。
2. 全片：逐章写 → dryrun → 每章拼图 → 修 → `--frames=0:<duration> --workers=3` → `--encode --out=out/<name>.mp4` → 总览图。
3. 质感轮（可并入全片）：笔触、场景细节、TRANSITIONS。
4. 在 VM 里 ffmpeg 转 720p（`-preset veryfast -crf 25 -vf scale=1280:-2`）作为聊天内发送版；1080p 与 720p 都 `cp -n` 到桌面。
5. README 写清：章节表、运行命令、与模板的差异、节拍/歌词未人工核对的地方、自己补的连续性设定（待确认）。如实说明哪些只看了拼图、没有完整带声播放。