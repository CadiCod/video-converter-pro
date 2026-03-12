/**
 * Video Converter Pro (Web) - FFmpeg.wasm Converter
 * Client-side video conversion using WebAssembly
 *
 * All ffmpeg.wasm JS files are self-hosted (same-origin) to avoid
 * cross-origin Worker security errors on GitHub Pages.
 * Only the large .wasm binary (~32 MB) is fetched from CDN.
 */

import { FFmpeg } from './ffmpeg/index.js';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm';

let ffmpeg = null;
let isLoaded = false;
let isMultiThread = false;

/**
 * Load FFmpeg.wasm — single-threaded mode (most compatible)
 *
 * Self-hosted JS files eliminate cross-origin Worker errors.
 * The .wasm binary is fetched from CDN as a blob URL.
 */
export async function loadFFmpeg(onLog) {
  if (isLoaded && ffmpeg) return { ffmpeg, isMultiThread };

  ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  // Single-threaded mode: works everywhere (GitHub Pages, iPhone Safari, etc.)
  // Multi-threaded requires COOP/COEP headers not available on GitHub Pages
  isMultiThread = false;

  try {
    // Self-hosted core JS (same-origin, no cross-origin issues)
    const coreURL = new URL('./ffmpeg/ffmpeg-core.js', import.meta.url).href;

    // Fetch the large WASM binary from CDN as blob URL
    const wasmResponse = await fetch(WASM_CDN);
    if (!wasmResponse.ok) throw new Error(`WASM fetch failed: ${wasmResponse.status}`);
    const wasmBlob = await wasmResponse.blob();
    const wasmURL = URL.createObjectURL(wasmBlob);

    await ffmpeg.load({ coreURL, wasmURL });
    console.log('FFmpeg loaded (single-threaded)');
  } catch (err) {
    console.error('FFmpeg load error:', err);
    throw new Error(`Failed to load video engine: ${err.message}`);
  }

  isLoaded = true;
  return { ffmpeg, isMultiThread };
}

/**
 * Map format ID to FFmpeg format string
 */
function getFFmpegFormat(format) {
  const map = {
    'mp4': 'mp4', 'avi': 'avi', 'mkv': 'matroska', 'mov': 'mov',
    'webm': 'webm', 'flv': 'flv', 'gif': 'gif', 'mp3': 'mp3',
    'aac': 'adts', 'm4a': 'ipod', 'wav': 'wav', 'ogg': 'ogg',
    'ts': 'mpegts', '3gp': '3gp'
  };
  return map[format] || format;
}

/**
 * Build FFmpeg CLI arguments from conversion options
 * Translated from the Electron version's fluent-ffmpeg buildCommand
 */
export function buildArgs(inputName, outputName, options) {
  const args = ['-i', inputName];
  const preset = options.preset || {};
  const format = options.outputFormat || 'mp4';

  // Determine codecs based on format
  let videoCodec = preset.videoCodec || null;
  let audioCodec = preset.audioCodec || null;

  switch (format) {
    case 'mp4': case 'avi': case 'mkv': case 'mov': case 'flv': case 'ts': case '3gp':
      if (!videoCodec) videoCodec = 'libx264';
      if (!audioCodec) audioCodec = 'aac';
      break;
    case 'webm':
      videoCodec = 'libvpx-vp9';
      audioCodec = 'libopus';
      break;
    case 'gif':
      break;
    case 'mp3':
      audioCodec = 'libmp3lame';
      break;
    case 'aac':
      audioCodec = 'aac';
      break;
    case 'm4a':
      audioCodec = 'aac';
      break;
    case 'wav':
      audioCodec = 'pcm_s16le';
      break;
    case 'ogg':
      audioCodec = 'libvorbis';
      break;
  }

  const isX264 = videoCodec && (videoCodec === 'libx264' || videoCodec === 'libx265');
  const isVP9 = videoCodec === 'libvpx-vp9';

  // Video codec
  if (videoCodec) {
    args.push('-c:v', videoCodec);
  }

  // Audio codec
  if (audioCodec) {
    args.push('-c:a', audioCodec);
  }

  // Resolution
  if (preset.resolution && preset.resolution !== 'original') {
    const res = preset.resolution;
    if (res.includes('?')) {
      const width = res.split('x')[0];
      args.push('-vf', `scale=${width}:-2`);
    } else {
      const [w, h] = res.split('x');
      args.push('-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`);
    }
  }

  // Audio bitrate
  if (preset.audioBitrate) {
    args.push('-b:a', preset.audioBitrate);
  }

  // CRF (quality-based encoding)
  if (preset.crf !== undefined) {
    if (isVP9) {
      args.push('-b:v', '0');
      args.push('-crf', String(Math.min(preset.crf + 10, 63)));
    } else if (isX264) {
      args.push('-crf', String(preset.crf));
    }
  }

  // Pixel format
  if (preset.pixelFormat && format !== 'webm' && format !== 'gif') {
    args.push('-pix_fmt', preset.pixelFormat);
  }

  // FPS
  if (preset.fps) {
    args.push('-r', String(preset.fps));
  }

  // Additional output options (from presets)
  if (preset.outputOptions) {
    for (const opt of preset.outputOptions) {
      if (!isX264 && (opt.startsWith('-preset') || opt.startsWith('-profile:v') || opt.startsWith('-level'))) {
        continue;
      }
      const parts = opt.trim().split(/\s+/);
      args.push(...parts);
    }
  }

  // Format-specific post-processing
  switch (format) {
    case 'mp4':
      args.push('-movflags', '+faststart');
      break;
    case 'webm':
      // Use fastest VP9 settings for WASM (realtime + max cpu-used)
      args.push('-deadline', 'realtime', '-cpu-used', '8');
      break;
    case 'gif':
      args.push('-an');
      if (!preset.fps) args.push('-r', '15');
      if (!preset.resolution || preset.resolution === 'original') {
        const hasVf = args.includes('-vf');
        if (!hasVf) {
          args.push('-vf', "scale='min(480,iw)':'-2'");
        }
      }
      break;
  }

  // Audio-only extraction
  if (options.audioOnly) {
    args.push('-vn');
  }

  // Output format
  args.push('-f', getFFmpegFormat(format));

  // Overwrite output
  args.push('-y', outputName);

  return args;
}

/**
 * Probe a video file using ffmpeg -i (parse stderr for metadata)
 */
export async function probeVideo(file) {
  if (!ffmpeg || !isLoaded) throw new Error('FFmpeg not loaded');

  const inputName = `probe_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

    let logOutput = '';
    const logHandler = ({ message }) => { logOutput += message + '\n'; };
    ffmpeg.on('log', logHandler);

    try {
      await ffmpeg.exec(['-i', inputName]);
    } catch {
      // Expected: ffmpeg returns error when no output specified
    }

    ffmpeg.off('log', logHandler);
    const metadata = parseProbeOutput(logOutput);
    try { await ffmpeg.deleteFile(inputName); } catch {}

    return metadata;
  } catch (err) {
    try { await ffmpeg.deleteFile(inputName); } catch {}
    throw err;
  }
}

/**
 * Parse FFmpeg -i output for video metadata
 */
function parseProbeOutput(log) {
  const result = { duration: 0, video: null, audio: null };

  const durMatch = log.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
  if (durMatch) {
    result.duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 +
      parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100;
  }

  const videoMatch = log.match(/Stream\s+#\d+:\d+.*Video:\s+(\w+).*?,\s*(\d+)x(\d+)/);
  if (videoMatch) {
    result.video = {
      codec: videoMatch[1],
      width: parseInt(videoMatch[2]),
      height: parseInt(videoMatch[3]),
      fps: 30
    };
    const fpsMatch = log.match(/(\d+(?:\.\d+)?)\s+fps/);
    if (fpsMatch) result.video.fps = parseFloat(fpsMatch[1]);
  }

  const audioMatch = log.match(/Stream\s+#\d+:\d+.*Audio:\s+(\w+)/);
  if (audioMatch) {
    result.audio = { codec: audioMatch[1] };
  }

  const bitrateMatch = log.match(/bitrate:\s*(\d+)\s*kb\/s/);
  if (bitrateMatch) {
    result.bitrate = parseInt(bitrateMatch[1]) * 1000;
  }

  return result;
}

/**
 * Convert a video file
 * For WebM/VP9: tries at original resolution first, auto-retries at 720p
 * if WASM runs out of memory ("index out of bounds" RuntimeError).
 */
export async function convertVideo(file, options, onProgress) {
  if (!ffmpeg || !isLoaded) throw new Error('FFmpeg not loaded');

  try {
    return await _doConvert(file, options, onProgress);
  } catch (err) {
    const isMemoryError = err.message && (
      err.message.includes('index out of bounds') ||
      err.message.includes('memory access out of bounds') ||
      err.message.includes('out of memory')
    );

    // Auto-retry WebM/GIF at lower resolution on WASM memory crash
    if (isMemoryError && (options.outputFormat === 'webm' || options.outputFormat === 'gif')) {
      console.warn(`WASM memory error at original resolution, retrying at 720p...`);

      // Reload ffmpeg after crash
      ffmpeg.terminate();
      ffmpeg = null;
      isLoaded = false;
      await loadFFmpeg();

      const retryOptions = {
        ...options,
        preset: {
          ...(options.preset || {}),
          resolution: options.outputFormat === 'gif' ? '480x?' : '1280x720'
        }
      };
      if (onProgress) onProgress({ percent: 0, time: 0, retrying: true });
      return await _doConvert(file, retryOptions, onProgress, ' (downscaled to 720p)');
    }

    throw err;
  }
}

/**
 * Internal conversion — separated so convertVideo can retry on failure
 */
async function _doConvert(file, options, onProgress, suffix = '') {
  if (!ffmpeg || !isLoaded) throw new Error('FFmpeg not loaded');

  const inputExt = file.name.split('.').pop();
  const inputName = `input_${Date.now()}.${inputExt}`;
  const outputName = `output_${Date.now()}.${options.outputFormat}`;

  const progressHandler = ({ progress, time }) => {
    if (onProgress) {
      onProgress({
        percent: Math.max(0, Math.min(100, (progress || 0) * 100)),
        time: time || 0
      });
    }
  };
  ffmpeg.on('progress', progressHandler);

  try {
    const fileData = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inputName, fileData);

    const args = buildArgs(inputName, outputName, options);
    console.log('FFmpeg args:', args.join(' '));

    await ffmpeg.exec(args);

    const outputData = await ffmpeg.readFile(outputName);

    const mimeTypes = {
      'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska', 'mov': 'video/quicktime', 'flv': 'video/x-flv',
      'ts': 'video/mp2t', '3gp': 'video/3gpp', 'gif': 'image/gif',
      'mp3': 'audio/mpeg', 'aac': 'audio/aac', 'm4a': 'audio/mp4',
      'wav': 'audio/wav', 'ogg': 'audio/ogg'
    };
    const blob = new Blob([outputData.buffer], { type: mimeTypes[options.outputFormat] || 'application/octet-stream' });

    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
    ffmpeg.off('progress', progressHandler);

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const outputFileName = `${baseName}${suffix}.${options.outputFormat}`;

    return {
      success: true,
      blob,
      outputFileName,
      outputSize: blob.size
    };
  } catch (err) {
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
    ffmpeg.off('progress', progressHandler);
    throw err;
  }
}

/**
 * Cancel active conversion by terminating FFmpeg
 */
export async function cancelConversion() {
  if (ffmpeg) {
    ffmpeg.terminate();
    ffmpeg = null;
    isLoaded = false;
  }
}

/**
 * Check if FFmpeg is loaded
 */
export function getStatus() {
  return { isLoaded, isMultiThread };
}
