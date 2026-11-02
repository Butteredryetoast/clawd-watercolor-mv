# 引擎 API 速查（template/src）

加载顺序（studio.html）：config → core → clawd → lyrics → shotlist → timeline → texture → kit →（person）→ cast → props → world →（sets / 其他场景文件）→ ch/*。全局脚本，不是模块：**同名 `const` 会报错，同名 `function` 后者覆盖前者**；自定义函数不能和 p5 全局重名（`cone`、`panorama`、`box`、`plane`、`sphere`、`torus`、`text`、`image`、`fill`、`stroke`、`line`、`point`、`circle`、`square`、`arc`、`noise`、`random`、`map`…），否则页面卡死或画错。

## core.js

| 类别 | 名字 |
|---|---|
| 常量 | `W H`（1920×1080）、`BPM BEAT OFF BOIL DUR TAU`、`PAL`（paper ink clay clayDk clayLt night indigo rose ochre sap teal violet cream sky） |
| 数学 | `clamp lerp ease easeOut easeIn backOut elasticOut frac hash(i) seg(t,a,b) wob(t,f,ph) mixCol(a,b,k) shakeXY(t,amt)` |
| 关键帧 | `kf(t, [[t0,v0],[t1,v1]…], easeFn)`：值可以是数或数组 |
| 节拍 | `bpOf(t)` 拍位置、`beatN(t)`、`pulse(t,k)` 拍上为 1 后衰减、`pulse2` 八分音符；渐快用 `CONFIG.beat.map` |
| 随机 | `jit(a)`：随 BOIL 每秒重抽 12 次（手绘抖动）；`steady(key, fn)`：fn 内用固定种子，不抖不闪 |
| 镜头 | `camBegin(cx, cy, zoom, rot)` … `camEnd()`（只能一层）；`toScreen(x,y)`；`CAM`；`SCALE_K`（嵌套缩放） |
| 形状 | `rectPts(x,y,w,h,j)`、`ellPts(cx,cy,rx,ry,n,j,rot)`、`rrPts(x,y,w,h,r,j)`、`starPts`、`heartPts`（clawd.js） |
| 上色 | `paint(pts, o)`；`inkLine(pts, sw, col, br, curv)` |
| 全屏 | `flash(k, col)`、`iris(cx,cy,r,col)`、`irisShape(pts,col)`（挖洞外全涂） |
| 文字 | `letter(txt,x,y,size,col,{screen,align,alpha,stroke,ink,rot,pop,font})`、`sfx(txt,x,y,size,col,age,o)`、`flushLetters()` |
| 渲染 | `window.renderAt(t)`、`window.renderSheet(times, cols, w)` |

`paint` 的选项：`wash`/`washOp` 平涂；`fill`/`fillOp`/`bleed`/`tex`/`border` 水彩填色（很贵；屏幕上小于 `FILL_MIN` 40 px 的会自动降成平涂，`keepFill:true` 可关掉）；`hatch:{d,a,o,b,c,w}` 排线；`ink`（`null` = 不描边）/`sw`/`br` 描边；`curv` 曲线化。
笔刷：`ink` `inkfine` `dry`（core）、`paint` `bristle` `stipple`（texture），以及 p5.brush 自带的 `charcoal` `HB` `2B` `cpencil` `pen` `rotring` `spray` `marker`…

## timeline.js

- `chapter(name, start, end, [[t0, fn | null], …])`；`fn(t, lt, dur)` 画整帧，`lt = t - t0`；`null` 显示分镜占位。
- `shotAt(t)`、`lyricAt(t)`；`window.LOOP = t => …` 让 studio 只画一个循环测试函数。
- `TRANSITIONS`：`{ t, d, type }`，type = `whip {dir, cols, haze}` / `bloom {col}` / `smoke` / `paint {cols}` / `paper {blank}` / `clock {col}` / `splash {col}`。
- 字幕：`CONFIG.subtitle`（size weight y fadeIn fadeOut color outline shadow band bandCol）；底带在合成层画（`drawSubtitleBand`），不进 p5.brush。
- 署名：`CONFIG.credits`（at hold size x y align skipFirst），长行在 `/` 处折行。
- 复听角标：studio 与检查拼图里显示，成片不显示（`render.mjs --review` 才烧进去）。

## texture.js

- `brushStrokes(x,y,w,h,{n,angle,len,curve,br,sw,seed,wave,spread,col|cols})`：一片方向性笔触（墙、地板、天空、木纹）。
- `swirlStrokes(cx,cy,r0,r1,{n,rot,flat,cols,sw,br,seed})`：旋涡。`stipple(x,y,w,h,{n,len,cols,sw,br,seed})`：点染。
- `bodyStrokes(u, dk, lt, seed)`：在 Clawd 的 draw 钩子里给身体加笔触（只在 u > 12 时用）。

## clawd.js

`clawd(x, y, u, o)`：(x, y) 是两脚之间的地面点，身体 10u 宽、8u 高。

- 颜色 `col dk lt`；姿态 `dy sq take sx sy flip rot walk noLegs noShadow swMul seed`。
- 手臂 `aL aR`（角度，+ = 抬起）。手臂长 2.2u，枢轴在 (±4.9u, -4.5u)。`armL / armR(u, sw)` 在手臂尖端画持物。
- `draw(u, sw)`：身体局部坐标（x −5u..5u，y −8u..−2u）。
- 眼 `eyes`：normal look(lookX/lookY) happy closed narrow wink x heart spark swirl dot angry scared red mix shades。另有 `squint lid`。
- 嘴 `mouth`：smile grin flat o O cat wobble。`blush`。
- 帽 `hat`：party top fedora crown halo wizard hard band sweatband hood cat bowtie mask masq。
- 表情符号 `emote`/`emoteK`：zzz ! ? !? !! sweat heart music spark anger swirl。
- `mood(t, [[t0, eyes, emote?]…])`：换表情时自动眯眼和小幅 take；`move(style, t, seed)`：bounce hop roof sway spin wave walk run idle stomp shimmy mix；`dancer(x,y,u,style,t,extra)`。

**手**：Clawd 面朝观众，角色的左手是屏幕右边的 `aR`，右手是 `aL`；背影时反过来。

## kit.js（通用场景库）

`viewRect vis clipRect bg VIEW_OVERRIDE`（剔除与裁剪）· `nest(x,y,k,fn,view)`（嵌套场景，不裁剪）· `glowDot softGlow lightString` · `moon stars roofRow bareTree` · `snowLine snowfall` · `ribbonPts curlPath angLerp sagPath cord` · `hand clawdArmTip armAngleTo armTo` · `speechBubble lensVignette swirlVortex` · `splitHalf paperDivider`。参数见 kit.js 每个函数上方的注释。

## person.js（可选：人物主角）

`person(x, y, u, o)`：Q 版 4.5 头身，u 为头高。

- 手臂：`aL aR eL eR`（角度），或用手的目标点 `hL hR` 做两段 IK（`bendL bendR` 选肘部方向）。
- 持物钩子：`holdL holdR(u, sw, ang)`。
- 脸：`eyes brows mouth turn tilt headbang`。
- 身体：`lean sit feet walk stance`。
- 外观：`o.look`（颜色和钩子），`o.guitar` 把吉他挂上并放好双手，`o.inkCol` 单人轮廓色。
- 其他函数：`personArm`（只画一只手臂）、`personHandAt`（取手的世界坐标）。

用例见 HighwayToHell / WhiskeyJar / YuJian 的 cast.js。

## 工具（template/tools，均在工程根目录运行）

| 命令 | 作用 |
|---|---|
| `node tools/beat.mjs` | BPM + 相位（0.01 s）+ 分段相位；只要 ffmpeg |
| `python3 tools/lrc_to_json.py --lrc=…` | 只有 LRC 时生成歌词 JSON（出点估计，全部待复听） |
| `python3 tools/build_data.py [--json=…]` | JSON + STORYBOARD.md → lyrics.js / shotlist.js，并检查镜头无缝 |
| `node tools/dryrun.mjs --step=0.25` | 不开浏览器跑全片，报错 + 每帧图形数 |
| `node tools/profile.mjs --t=72,74 --stub="fnA;fnB,fnC"` | 把函数换成空函数比耗时，找慢的东西 |
| `node render.mjs --sheet/--stills/--clip/--frames/--encode/--sample/--verify` | 见 render.mjs 文件头 |
| `node tools/finish.mjs` | 成片核对 + 总览 + 720p + 拷桌面 |
| `python3 tools/sync_check.py` | 波形对照图（要 numpy + Pillow，这台 Mac 默认没有） |
| `node tools/render_watch.mjs` | 渲染队列（只在 Cowork VM 里需要） |
| `python3 tools/build_font.py` | 字体子集（可选，要 fontTools） |
