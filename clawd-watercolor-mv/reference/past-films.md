# 已做过的片子：去哪里找可复用的场景和手法

工程都在 `/Users/mac/Documents/Codex/2026-10-29/https-github-com-johnheibel-pdoomvideo-https/work/<目录>`，成片在 `~/Desktop/MV制作/<歌手 - 歌名>/`（《等待》《赤壁》在桌面根目录）。每个工程的 README 有章节表、“与模板的差异”和“需确认”。新片要借某个场景或手法时，按下表找到文件，**复制函数进新工程再改**，不要改旧工程。

| 片名（目录） | 主角 | 时长 / 节拍 | 值得借的东西 |
|---|---|---|---|
| 等待（DengDai） | Clawd | 208.84 s / 112 BPM | 咖啡馆固定舞台、杯底世界、烟雾章、**逐次升级的道具**（杯塔）、`clock` / `paper` 转场。这是 PDoomVideo 之后的第一个模板 |
| Two Moons（TwoMoons） | Clawd | 236.35 s / 109.58 | 纸月亮灯 `paperMoon`、卧室按时间变化的状态（每次关门少一样东西）、冻住的城市、冰柳街、俯拍平面图、一排房间的剖面；只有 LRC 的歌词流程；英文字幕（字号 44） |
| Highway to Hell（HighwayToHell） | 人物 | 208.40 s / 114.9（后段渐快，`beat.map`） | **person.js 诞生**；旅行车侧面 / 车头正面固定舞台、透视公路、收费站、吉他上身 `o.guitar`、每章一套天空调色 `SKY` |
| 赤壁（ChiBi） | 人物（历史讲解，无人声） | 216.62 s | 讲解稿做字幕：`tools/tts_narration.py`、`subtitle_timeline.py`；代码合成配乐 `compose_music.py`；对齐 `align_lines.py`；火攻场景 |
| Whiskey in the Jar（WhiskeyJar） | 人物 | 304.89 s / 133.02 | 骑马 `pony()` / `riding()`、玻璃酒罐（升级道具）、牢房粉笔线“正在画”`chalk()`、雨和闪电、`splash` 转场（已并入模板） |
| 春风吹（ChunFengChui） | Clawd | 200.59 s / 67.45 | **p5.brush 越界补丁**（已并入模板）、`SCALE_K` 嵌套缩放、长卷 `scroll1/2`、山坡固定舞台四套颜色、土层剖面、大升镜 `greenPanorama`、开场和尾声同构图 `windowView` |
| 遇见（YuJian） | 人物 | 210.57 s / 92 | **清爽版画风**（`boil: 0` + `style.inkCol`，已并入模板）、车站固定舞台、公交车内和车窗主观镜头、翻牌叫号屏、季节调色 `SEASON`、俯拍人海 |
| 冬天一个游（DongTian） | Clawd | 253.69 s / 79.0 | 楼房剖面 `aptSet` / 居酒屋剖面 `izakayaSet`、窗户推镜无缝切进全景（`inPano` → kit `nest`）、贯穿各场景的红毛线（`yarnPath` → kit `sagPath`）、雪景球旋涡转场（→ kit `swirlVortex`）、双城分屏（→ kit `splitHalf`）、雷门固定舞台三套调色、东京河岸长条场景、`snowLine` / `FILL_MIN` / `profile.mjs`。字幕底带闪烁的教训也来自这部 |
| 丸之內虐待狂（Marunouchi） | Clawd | 235.74 s / 100 | **中日双语字幕**（`subtitle.lines`）；丸之内线红电车 `subwayTrain`（侧面）/ `riverSet` 里的小电车 / 车厢内景 `carInterior`（座位、摆动吊环、门开向站台）/ 俯视 `carPlan`；神田川峡谷首尾同构图 + 灯逐拍熄灭；街道连地下剖面 `streetSection`（人行道 → 泥土 → 地铁隧道 → 嵌套的 Live House，`nestView` 式推进）；Live House 固定舞台 `liveStage` 四套调色 + 音箱逐级 `ampStack` + 布景换场 `backdrop`（寺院 / 卧室 / 披萨店）+ 背影观众 `crowd`/`fanLite`；**Clawd 弹吉他** `airGuitar` + `guitarAlong`（雨伞 / 纸板 / 红色实心琴 `rickGuitar` / 橙色空心琴）；X 光肺 `xray`；银座路口 `ginzaSet`（钟楼、出租车 `taxi`、收据纸带 `paperRibbon`）；后乐园 `korakuenSet`（无轴摩天轮、Catmull-Rom 过山车轨道 `coasterAt`）；月台 `platformSet`（电车停在月台后、开门）；**封面** `cover.js`（4:3 / 3:4，2× 分辨率：峡谷远景 + 桥栏前景 `coverParapet` + 弹雨伞的她 + 标题下的红底白波纹条） |
| 电动少女（DianDongShaoNv） | 人物 | 310.43 s / 122.01 | **八音盒小剧场**：玩具剧院 `toyTheater` 套嵌固定舞台、推进开口无缝切内层（`boxView` → kit `nestView`）；固定舞台三套调色 `STAGE_PAL` + 反打观众席 `auditoriumSet`（几百个瓷娃娃 `porcelain`）；人物原地旋转 `o.spin`（|cos| 压扁 + 自动背面 + 纱裙不压扁）；电量表 / 胸灯做全片计量表；正交投影地球 `earthSpace`（晨昏线、夜面灯火、首尾同构图）；大手 `giantHand`（→ kit `humanHand`）；化妆镜灯泡逐拍亮灭、针滚筒跑步机、拔插头的全黑和星光竖井 |

## 反复用到的结构

- **固定舞台**：每次副歌回到同一个场景，只换调色板，并且逐次升级。实现方式：`stage(t, { pal })` 加 `XX_PAL.a / b / c`。可参考雷门（DongTian `gateStage`）、山坡（ChunFengChui `hillStage`）、车站（YuJian `stationBack`）、酒馆（WhiskeyJar `tavernBack`）。
- **剖面房子**：分楼层的 dollhouse 剖面，相机在各层之间移动，一个场景能讲一章。可参考 DongTian `aptSet` / `izakayaSet`、TwoMoons 的房间剖面。
- **贯穿道具或线索**：把场景串起来，比如杯塔、酒罐、红毛线、号码牌。道具当前的状态在 world.js 里写成 t 的函数。
- **嵌套推镜**：画框、窗户、照片、雪景球里画着另一个场景。用 `nest()` 画进去，相机推到 1/k 倍时切到同一个场景的全屏版本，看不出接缝。
