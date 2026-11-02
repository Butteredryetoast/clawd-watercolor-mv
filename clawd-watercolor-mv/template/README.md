# 《歌名》Clawd 水彩 MV

（一句话：歌、歌手、框架来源 = clawd-watercolor-mv 模板；分镜见 `STORYBOARD.md`，老大确认于 YYYY-MM-DD。）

当前阶段：**样片 / 全片**（成片信息见文末“成片”）。

## 章节

| 章 | 时间 (s) | 场景 | 文件 |
|---|---|---|---|
| 0 | 0–10 | 序章 | `src/ch/c00_….js` |

## 这次的要求怎么做到的

- （逐条对应老大的要求。）

## 运行

```bash
npm install                                   # 只需一次
python3 tools/build_data.py                   # 歌词 JSON + STORYBOARD.md → src/lyrics.js、src/shotlist.js
open studio.html                              # 预览（拖动、空格播放、预渲染区间同步播放）
node tools/dryrun.mjs --step=0.25             # 不开浏览器跑全片：0 报错
node render.mjs --sheet=30:45:0.5 --cols=6 --w=400 --out=out/check/ch1.jpg   # 检查拼图
node render.mjs --sample                      # 样片
node render.mjs --frames=0:<时长> --workers=3  # 全片逐帧（可断点续渲）
node render.mjs --encode --out=out/<slug>.mp4 # 合成原曲
node tools/finish.mjs                         # 核对 + 总览图 + 720p + 拷到桌面
```

## 与模板的差异

- （改了哪些通用文件、为什么。）

## 未核对 / 待确认

- 节拍：tools/beat.mjs 估计，未人工核对。
- 歌词：入点 LRC，出点机器估计；需复听的句子见 `LYRIC_STATUS.reviewHigh`。
- 自己补的连续性设定：（逐条列出。）
- 只看了检查拼图与总览图，没有完整带声播放。

## 成片

（渲染完成后补写：文件、尺寸、帧数、音画偏移核对、桌面位置。）
