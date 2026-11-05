// config.js: every project-wide number lives here. Loaded by studio.html (browser) and render.mjs (node).
// Change the song, length, frame rate or the sample range here; nothing else hard-codes them.
// 新歌：改 title / artist / slug / audio / duration / beat / sample，其余默认值是几部片验证过的。
const CONFIG = {
  title: '歌名', artist: '歌手', slug: 'song',
  audio: 'assets/song.mp3',              // 原曲（复制进 assets/）
  duration: 200.0,                       // 总时长（秒）= 歌词 JSON 的 audio_duration_seconds（比 ffprobe 少几十毫秒的尾部填充）
  fps: 24,
  width: 1920, height: 1080,
  boil: 12,                              // 线条“抖动”重采样频率（次/秒）；0 = 线条和笔触纹理完全固定（清爽版，《遇见》）
  // 节拍：node tools/beat.mjs 估计后填入；未人工核对就保持 verified: false。镜头切点以分镜时间为准。
  // 有渐快渐慢时用 map: [[t0, bpm, 该段某一拍的时间], ...]
  beat: { bpm: 120, offset: 0, verified: false },
  // 轮廓线风格：ink 为墨线粗细倍数，inkCol 把纯黑墨换成柔和色（如 '#5A4638'）；null = 原样
  style: { ink: 1, inkCol: null },
  // 字体：macOS 系统楷体粗体最清楚；需要固定字形时跑 tools/build_font.py 生成子集并把 face 指过去
  fonts: {
    zh: '"Kaiti SC", "STKaiti", "Songti SC", "PingFang SC", "Noto Serif CJK SC", serif',
    ja: '"YuKyokasho Yoko", "YuKyokasho", "Klee", "Hiragino Mincho ProN", "YuMincho", serif',   // 日文：教科书体，和楷体同一路手写感（楷体没有假名，会混字体）
    face: null,                          // 例：{ family: 'Film Serif', url: 'assets/fonts/FilmSerif.woff' }，zh 前面加 '"Film Serif", '
  },
  subtitle: {                            // 整句字幕（不做逐字卡拉OK）
    size: 54, weight: 'bold', y: 1010,   // 字号、字重与第一行中心 y；关键表演保持在 y 960 以上
    // 双语：lines 从上到下列出各行。key 'zh' = 歌词 JSON 的 text_zh（译文），'orig' = text（原文）；font = CONFIG.fonts 的键。
    // 例（《丸之內虐待狂》中文在上、日文在下且小）：lines: [{ key: 'zh', size: 54, font: 'zh' }, { key: 'orig', size: 34, font: 'ja' }], gap: 14, y: 976
    lines: null, gap: 14,                // null = 只有原文一行
    fadeIn: .16, fadeOut: .2,            // 入/出淡变（秒）
    color: '#FFF9EE', outline: '#1E2238', shadow: 'rgba(10,12,30,.55)',
    band: 150,                           // 字幕底带不透明度（0–255，0 = 不要底带）。底带在合成层画（柔边、按句固定形状），不随线条抖动闪烁
    bandCol: null,                       // 底带颜色，null = 用 outline 色
  },
  // 署名：CREDITS 里第一条（片名 - 歌手）默认由开场镜头自己画，其余几条在 at 秒合成一块显示 hold 秒
  credits: { at: 2.2, hold: 5.6, size: 30, x: 70, y: 760, align: 'left', skipFirst: true },
  wipes: [],                             // 老式整屏笔刷擦除的时间点（一般用 timeline.js 的 TRANSITIONS 代替）
  // 样片：选一段含角色表演 + 道具互动 + 转场的 10–15 s
  sample: { start: 10, end: 22, name: 'sample' },
  // 渲染器使用的 Chrome。render.mjs 依次尝试 --chrome 参数、CHROME_PATH 环境变量、下面的平台默认路径。
  chrome: {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
             '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
             '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  },
};
if (typeof module !== 'undefined') module.exports = CONFIG;
