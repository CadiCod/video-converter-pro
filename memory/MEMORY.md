# Video Converter Pro - Project Memory

## Project Overview
- **Type**: Portable desktop video converter (Electron + FFmpeg) + PWA web version
- **Location**: `E:\Video Converter\`
- **Stack**: Electron 33, Node.js, fluent-ffmpeg, @ffmpeg-installer/ffmpeg
- **Live URL**: https://convert.mezamii.com/ (landing) + https://convert.mezamii.com/web/ (PWA)
- **GitHub**: https://github.com/CadiCod/video-converter-pro

## Architecture
- `main.js` - Electron main process (window, IPC handlers, dialogs)
- `preload.js` - Secure IPC bridge (contextIsolation)
- `src/js/converter.js` - FFmpeg wrapper (probe, convert, cancel)
- `src/js/presets.js` - Quality presets, device profiles, format definitions
- `src/js/app.js` - Frontend app logic (drag-drop, UI state, progress)
- `src/index.html` - Main UI structure
- `src/css/styles.css` - Dark theme styling

## PWA Web Version (`docs/web/`)
- `docs/web/js/converter.js` - FFmpeg WASM wrapper (self-hosted ESM, VP8 codec, auto-retry)
- `docs/web/js/presets.js` - Quality presets (all use `-preset ultrafast`)
- `docs/web/js/app.js` - Frontend logic (completion screen icons, error handling)
- `docs/web/js/ffmpeg/` - Self-hosted @ffmpeg/ffmpeg ESM files (avoids cross-origin errors)
- `docs/web/sw.js` - Service Worker (cache version: vcp-web-v6)
- `docs/web/index.html` - PWA UI
- `docs/web/manifest.json` - PWA manifest (start_url: https://convert.mezamii.com/web/)
- `docs/index.html` - Landing page (SEO optimized)
- `docs/sitemap.xml` - Sitemap for both URLs
- `docs/robots.txt` - Allow all + sitemap reference
- `docs/CNAME` - Custom domain: convert.mezamii.com
- `docs/og-image.png` - OG social share image (1200x630)
- `docs/twitter-card.png` - Twitter card image (1200x600)
- `docs/mezamii-avatar-256.png` - Mezamii logo resized for social profiles
- `docs/87e60e31670e445cae24d4119bcf0097.txt` - IndexNow API key file

## Key Features
- 20+ video formats (MP4, AVI, MKV, MOV, WebM, etc.)
- 5 quality presets (Maximum to Minimum, CRF-based)
- 10 device profiles (Universal, iPhone, Android, YouTube, Instagram, TikTok, etc.)
- Batch conversion with progress tracking
- Audio extraction (MP3, AAC, WAV, OGG, M4A)
- Custom title bar, drag & drop
- PWA installable on any device (iPhone, Android, desktop)

## Build Commands
- `npm start` - Run the app
- `npm run build:win` - Build Windows portable .exe
- `start.bat` / `start.sh` - Quick launchers

## FFmpeg Config (Desktop)
- Bundled via `@ffmpeg-installer/ffmpeg` (win32-x64)
- CRF encoding for quality-based compression
- H.264 + AAC for maximum compatibility
- `-movflags +faststart` for web streaming on MP4

## FFmpeg Config (Web/WASM)
- Self-hosted @ffmpeg/ffmpeg ESM files in `docs/web/js/ffmpeg/`
- WASM binary fetched from CDN as blob URL
- VP8 (libvpx) instead of VP9 for WebM — 4x less memory
- `-preset ultrafast` on all presets for speed
- Auto-retry: on WASM memory crash → reload ffmpeg → retry at 720p
- GIF auto-downscale to max 480px width

## Custom Domain Setup
- DNS CNAME: convert.mezamii.com → cadicod.github.io ✅
- GitHub Pages CNAME file: `docs/CNAME` ✅
- HTTPS enforced on GitHub Pages ✅
- All canonical URLs updated to convert.mezamii.com ✅

## SEO Setup
- Schema.org: SoftwareApplication, WebApplication, FAQPage
- OG/Twitter meta tags with correct images
- Sitemap submitted to Google Search Console ✅
- Sitemap submitted to Bing Webmaster Tools ✅
- URLs submitted via Bing URL Submission ✅
- IndexNow key: `87e60e31670e445cae24d4119bcf0097` (hosted at /87e60e31670e445cae24d4119bcf0097.txt) ✅
- Bing Site Scan running ✅

## Directory Listings
- AlternativeTo.net — submitted ✅ (pending admin approval)
- Product Hunt — submission in progress (complete launch checklist, launch Tue/Wed)
- Reddit — account created (u/Disastrous-Oil-6370, display: "Joel from Mezamii"), building karma

## Reddit Strategy (when karma ~50+)
- r/webdev: technical angle (WebAssembly, WASM memory limits, VP8 workaround)
- r/privacy: no-upload angle (files never leave device)
- r/ffmpeg: FFmpeg WASM GUI angle
- Space posts 1-2 weeks apart

## Service Worker Cache Versions
- vcp-web-v1 through v5: old/deprecated
- vcp-web-v6: current (as of this session)
- Bump version in `docs/web/sw.js` whenever deploying breaking changes

## Known Issues / Resolved
- Cross-origin Worker error → fixed by self-hosting @ffmpeg/ffmpeg ESM files
- VP9 WASM memory crash → fixed by switching to VP8 (libvpx)
- Stale SW cache → bump cache version + user clears site data
- Conversion too slow → changed to `-preset ultrafast`
- Completion screen wrong icon → added SVG icons + logic in app.js
- Fake aggregateRating removed from schema.org
