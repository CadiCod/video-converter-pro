/**
 * Video Converter Pro (Web) - FFmpeg.wasm Converter
 * Client-side video conversion using WebAssembly
 */

const FFMPEG_CDN_BASE = 'https://cdn.jsdelivr.net/npm';
const FFMPEG_VERSION = '0.12.10';

let ffmpeg = null;
let isLoaded = false;
let isMultiThread = false;

/**
 * Fetch a CDN resource as a blob URL (required for COEP compliance)
 */
async function fetchAsBlob(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Load FFmpeg.wasm - auto-detects multi-thread vs single-thread
 */
export async function loadFFmpeg(onLog) {
  if (isLoaded && ffmpeg) return { ffmpeg, isMultiThread };

  // Import FFmpeg from CDN
  const { FFmpeg } = await import(`${FFMPEG_CDN_BASE}/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`);
  ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  // Detect SharedArrayBuffer support for multi-threading
  isMultiThread = typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated;

  try {
    if (isMultiThread) {
      // Multi-threaded: faster but requires COOP/COEP headers
      const coreURL = await fetchAsBlob(`${FFMPEG_CDN_BASE}/@ffmpeg/core-mt@${FFMPEG_VERSION}/dist/esm/ffmpeg-core.js`);
      const wasmURL = await fetchAsBlob(`${FFMPEG_CDN_BASE}/@ffmpeg/core-mt@${FFMPEG_VERSION}/dist/esm/ffmpeg-core.wasm`);
      const workerURL = await fetchAsBlob(`${FFMPEG_CDN_BASE}/@ffmpeg/core-mt@${FFMPEG_VERSION}/dist/esm/ffmpeg-core.worker.js`);

      await ffmpeg.load({ coreURL, wasmURL, workerURL });
      console.log('FFmpeg loaded (multi-threaded)');
    } else {
      // Single-threaded fallback: works everywhere
      const coreURL = await fetchAsBlob(`${FFMPEG_CDN_BASE}/@ffmpeg/core@${FFMPEG_VERSION}/dist/esm/ffmpeg-core.js`);
      const wasmURL = await fetchAsBlob(`${FFMPEG_CDN_BASE}/@ffmpeg/core@${FFMPEG_VERSION}/dist/esm/ffmpeg-core.wasm`);

      await ffmpeg.load({ coreURL, wasmURL });
      console.log('FFmpeg loaded (single-threaded)');
    }
  } catch (err) {
    // If multi-thread fails, fall back to single-thread
    if (isMultiThread) {
      console.warn('Multi-thread load failed, falling back to single-thread:', err.message);
      isMultiThread = false;
      const coreURL = await fetchAsBlob(`${FFMPEG_CDN_BASE}/@ffmpeg/core@${FFMPEG_VERSION}/dist/esm/ffmpeg-core.js`);
      const wasmURL = await fetchAsBlob(`${FFMPEG_CDN_BASE}/@ffmpeg/core@${FFMPEG_VERSION}/dist/esm/ffmpeg-core.wasm`);
      await ffmpeg.load({ coreURL, wasmURL });
      console.log('FFmpeg loaded (single-threaded fallback)');
    } else {
      throw err;
    }
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
      // Dynamic height: e.g., "720x?" → scale to width 720, keep aspect
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
      // Skip x264-specific options for non-x264 codecs
      if (!isX264 && (opt.startsWith('-preset') || opt.startsWith('-profile:v') || opt.startsWith('-level'))) {
        continue;
      }
      // Split "-preset medium" into ["-preset", "medium"]
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
      args.push('-deadline', 'good', '-cpu-used', '2');
      break;
    case 'gif':
      args.push('-an'); // No audio
      if (!preset.fps) args.push('-r', '15');
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

    // Collect log output
    let logOutput = '';
    const logHandler = ({ message }) => { logOutput += message + '\n'; };
    ffmpeg.on('log', logHandler);

    // Run ffmpeg -i (will "fail" since no output, but we get metadata from logs)
    try {
      await ffmpeg.exec(['-i', inputName]);
    } catch {
      // Expected: ffmpeg returns error when no output specified
    }

    ffmpeg.off('log', logHandler);

    // Parse metadata from log output
    const metadata = parseProbeOutput(logOutput);

    // Cleanup
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

  // Duration: 00:01:30.50
  const durMatch = log.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
  if (durMatch) {
    result.duration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 +
      parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100;
  }

  // Video stream: Stream #0:0... Video: h264 ... 1920x1080 ... 30 fps
  const videoMatch = log.match(/Stream\s+#\d+:\d+.*Video:\s+(\w+).*?,\s*(\d+)x(\d+)/);
  if (videoMatch) {
    result.video = {
      codec: videoMatch[1],
      width: parseInt(videoMatch[2]),
      height: parseInt(videoMatch[3]),
      fps: 30 // Default
    };
    // Try to extract fps
    const fpsMatch = log.match(/(\d+(?:\.\d+)?)\s+fps/);
    if (fpsMatch) result.video.fps = parseFloat(fpsMatch[1]);
  }

  // Audio stream
  const audioMatch = log.match(/Stream\s+#\d+:\d+.*Audio:\s+(\w+)/);
  if (audioMatch) {
    result.audio = { codec: audioMatch[1] };
  }

  // Bitrate
  const bitrateMatch = log.match(/bitrate:\s*(\d+)\s*kb\/s/);
  if (bitrateMatch) {
    result.bitrate = parseInt(bitrateMatch[1]) * 1000;
  }

  return result;
}

/**
 * Convert a video file
 */
export async function convertVideo(file, options, onProgress) {
  if (!ffmpeg || !isLoaded) throw new Error('FFmpeg not loaded');

  const inputExt = file.name.split('.').pop();
  const inputName = `input_${Date.now()}.${inputExt}`;
  const outputName = `output_${Date.now()}.${options.outputFormat}`;

  // Set up progress handler
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
    // Write input file to virtual filesystem
    const fileData = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inputName, fileData);

    // Build and execute conversion
    const args = buildArgs(inputName, outputName, options);
    console.log('FFmpeg args:', args.join(' '));

    await ffmpeg.exec(args);

    // Read output file
    const outputData = await ffmpeg.readFile(outputName);

    // Create download blob
    const mimeTypes = {
      'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska', 'mov': 'video/quicktime', 'flv': 'video/x-flv',
      'ts': 'video/mp2t', '3gp': 'video/3gpp', 'gif': 'image/gif',
      'mp3': 'audio/mpeg', 'aac': 'audio/aac', 'm4a': 'audio/mp4',
      'wav': 'audio/wav', 'ogg': 'audio/ogg'
    };
    const blob = new Blob([outputData.buffer], { type: mimeTypes[options.outputFormat] || 'application/octet-stream' });

    // Cleanup virtual filesystem
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}

    ffmpeg.off('progress', progressHandler);

    // Generate output filename
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const outputFileName = `${baseName}.${options.outputFormat}`;

    return {
      success: true,
      blob,
      outputFileName,
      outputSize: blob.size
    };
  } catch (err) {
    // Cleanup on error
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
