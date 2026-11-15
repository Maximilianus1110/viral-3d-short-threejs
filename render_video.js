const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('./node_modules/puppeteer-core');

const ROOT_DIR = '/home/antigravity/viral-3d-short';
const FRAMES_DIR = path.join(ROOT_DIR, 'frames');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const TIMELINE_PATH = path.join(ROOT_DIR, 'assets', 'timeline.json');
const AUDIO_PATH = path.join(ROOT_DIR, 'assets', 'master_audio.wav');

// Clean and recreate frames directory
fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const timeline = JSON.parse(fs.readFileSync(TIMELINE_PATH, 'utf-8'));
const CAPTURE_FPS = 30;
const OUTPUT_FPS = 60;
const TOTAL_FRAMES = Math.ceil(timeline.totalDuration * CAPTURE_FPS);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wav': 'audio/wav'
};

const server = http.createServer((req, res) => {
  const cleanUrl = req.url.split('?')[0];
  if (cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.ico')) {
    res.writeHead(204);
    return res.end();
  }
  const fp = path.join(ROOT_DIR, cleanUrl === '/' ? 'index.html' : cleanUrl);
  if (!fs.existsSync(fp)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(fp);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  console.log(`Local render server listening on http://127.0.0.1:${port}`);
  console.log(
    `Starting multi-process render: ${TOTAL_FRAMES} frames (${timeline.totalDuration}s) -> 1080x1920 @ ${OUTPUT_FPS}fps MP4...`
  );

  const NUM_WORKERS = 2; // 2 independent Chromium processes (1 per CPU core, no background tab throttling)
  let nextFrame = 0;
  let completedFrames = 0;
  const startTime = Date.now();

  async function runBrowserWorker(workerId) {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      headless: 'new',
      protocolTimeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-proxy-server',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1080,1920'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/index.html?render=1`, {
      waitUntil: 'domcontentloaded'
    });
    await page.waitForFunction('window.VIDEO_READY === true', { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);

    while (true) {
      const fIdx = nextFrame++;
      if (fIdx >= TOTAL_FRAMES) break;

      const t = fIdx / CAPTURE_FPS;
      const frameFile = path.join(FRAMES_DIR, `frame_${String(fIdx).padStart(5, '0')}.jpg`);

      await page.evaluate((timeVal) => window.setVideoTime(timeVal), t);
      await page.screenshot({
        path: frameFile,
        type: 'jpeg',
        quality: 92,
        optimizeForSpeed: true
      });

      completedFrames++;
      if (completedFrames % 100 === 0 || completedFrames === TOTAL_FRAMES) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = completedFrames / elapsed;
        const eta = ((TOTAL_FRAMES - completedFrames) / rate).toFixed(1);
        console.log(
          `[Worker ${workerId}] Progress: ${completedFrames} / ${TOTAL_FRAMES} (${(
            (completedFrames / TOTAL_FRAMES) *
            100
          ).toFixed(1)}%) | ${rate.toFixed(1)} fps | ETA: ${eta}s`
        );
      }
    }

    await browser.close();
  }

  await Promise.all(Array.from({ length: NUM_WORKERS }, (_, idx) => runBrowserWorker(idx)));
  server.close();

  console.log('All frames captured! Encoding final 1080x1920 60fps MP4 with FFmpeg...');
  const outMp4 = path.join(OUTPUT_DIR, 'claude_3d_viral_short_1080x1920_60fps.mp4');
  const ffmpegCmd = [
    'ffmpeg -y -v warning',
    `-framerate ${CAPTURE_FPS}`,
    `-i "${path.join(FRAMES_DIR, 'frame_%05d.jpg')}"`,
    `-i "${AUDIO_PATH}"`,
    `-r ${OUTPUT_FPS}`,
    '-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p',
    '-c:a aac -b:a 192k',
    '-shortest -movflags +faststart',
    `"${outMp4}"`
  ].join(' ');

  execSync(ffmpegCmd, { stdio: 'inherit' });
  console.log(`SUCCESS! Rendered video saved to: ${outMp4}`);
});
