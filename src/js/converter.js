const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Get FFmpeg/FFprobe paths from installers
let ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
let ffprobePath = require('@ffprobe-installer/ffprobe').path;

// Fix paths for packaged Electron apps:
// Binaries inside app.asar can't be executed, they must be in app.asar.unpacked
if (ffmpegPath.includes('app.asar')) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}
if (ffprobePath.includes('app.asar')) {
  ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
}

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Parse frame rate string like "30000/1001" or "30" into a number
 */
function parseFps(fpsStr) {
  if (!fpsStr) return 0;
  if (fpsStr.includes('/')) {
    const [num, den] = fpsStr.split('/').map(Number);
    return den ? num / den : 0;
  }
  return parseFloat(fpsStr) || 0;
}

// Track active conversions for cancellation
const activeConversions = new Map();

/**
 * Probe a video file to get metadata
 */
function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      const format = metadata.format;

      resolve({
        duration: format.duration || 0,
        size: format.size || 0,
        bitrate: format.bit_rate || 0,
        format: format.format_name,
        video: videoStream ? {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          fps: parseFps(videoStream.r_frame_rate) || 30,
          bitrate: videoStream.bit_rate
        } : null,
        audio: audioStream ? {
          codec: audioStream.codec_name,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels,
          bitrate: audioStream.bit_rate
        } : null
      });
    });
  });
}

/**
 * Build FFmpeg command based on conversion options
 */
function buildCommand(inputPath, outputPath, options) {
  let cmd = ffmpeg(inputPath);

  const preset = options.preset || {};
  const format = options.outputFormat || 'mp4';

  // Determine actual codecs based on format, with preset as override
  let videoCodec = preset.videoCodec || null;
  let audioCodec = preset.audioCodec || null;

  // Format-specific codec defaults and adjustments
  switch (format) {
    case 'mp4':
      if (!videoCodec) videoCodec = 'libx264';
      if (!audioCodec) audioCodec = 'aac';
      break;
    case 'webm':
      videoCodec = 'libvpx-vp9';
      audioCodec = 'libopus';
      break;
    case 'avi':
      if (!videoCodec) videoCodec = 'libx264';
      if (!audioCodec) audioCodec = 'aac';
      break;
    case 'mkv':
      if (!videoCodec) videoCodec = 'libx264';
      if (!audioCodec) audioCodec = 'aac';
      break;
    case 'mov':
      if (!videoCodec) videoCodec = 'libx264';
      if (!audioCodec) audioCodec = 'aac';
      break;
    case 'wmv':
      videoCodec = 'msmpeg4v3';
      audioCodec = 'wmav2';
      break;
    case 'flv':
      if (!videoCodec) videoCodec = 'libx264';
      if (!audioCodec) audioCodec = 'aac';
      break;
    case 'ts':
      if (!videoCodec) videoCodec = 'libx264';
      if (!audioCodec) audioCodec = 'aac';
      break;
    case '3gp':
      videoCodec = 'libx264';
      audioCodec = 'aac';
      break;
    case 'gif':
      break;
    // Audio-only formats
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

  // Determine if we're using x264/x265 (for preset compatibility)
  const isX264 = videoCodec && (videoCodec === 'libx264' || videoCodec === 'libx265');
  const isVP9 = videoCodec === 'libvpx-vp9';

  // Apply video codec
  if (videoCodec) {
    cmd = cmd.videoCodec(videoCodec);
  }

  // Apply audio codec
  if (audioCodec) {
    cmd = cmd.audioCodec(audioCodec);
  }

  // Resolution
  if (preset.resolution && preset.resolution !== 'original') {
    cmd = cmd.size(preset.resolution);
  }

  // Video bitrate
  if (preset.videoBitrate) {
    cmd = cmd.videoBitrate(preset.videoBitrate);
  }

  // Audio bitrate
  if (preset.audioBitrate) {
    cmd = cmd.audioBitrate(preset.audioBitrate);
  }

  // CRF (Constant Rate Factor) for quality-based encoding
  if (preset.crf !== undefined) {
    if (isVP9) {
      // VP9 uses -b:v 0 with -crf for constant quality mode
      cmd = cmd.addOutputOption('-b:v 0');
      cmd = cmd.addOutputOption(`-crf ${Math.min(preset.crf + 10, 63)}`);
    } else if (isX264) {
      cmd = cmd.addOutputOption(`-crf ${preset.crf}`);
    }
    // Other codecs (msmpeg4v3, etc.) don't support CRF — use FFmpeg defaults
  }

  // Pixel format for compatibility (not applicable to all formats)
  if (preset.pixelFormat && format !== 'webm' && format !== 'gif') {
    cmd = cmd.addOutputOption(`-pix_fmt ${preset.pixelFormat}`);
  }

  // FPS
  if (preset.fps) {
    cmd = cmd.fps(preset.fps);
  }

  // Additional output options (filter out incompatible ones)
  if (preset.outputOptions) {
    preset.outputOptions.forEach(opt => {
      // Skip x264-specific options for non-x264 codecs
      if (!isX264 && (opt.startsWith('-preset') || opt.startsWith('-profile:v') || opt.startsWith('-level'))) {
        return;
      }
      cmd = cmd.addOutputOption(opt);
    });
  }

  // Format-specific post-processing
  switch (format) {
    case 'mp4':
      cmd = cmd.addOutputOption('-movflags +faststart');
      break;
    case 'webm':
      // VP9 quality/speed setting (0=best quality/slow, 5=fast)
      cmd = cmd.addOutputOption('-deadline good');
      cmd = cmd.addOutputOption('-cpu-used 2');
      break;
    case 'gif':
      cmd = cmd.noAudio();
      if (!preset.fps) cmd = cmd.fps(15);
      break;
  }

  // Audio extraction
  if (options.audioOnly) {
    cmd = cmd.noVideo();
  }

  cmd = cmd.format(getFFmpegFormat(format));
  cmd = cmd.output(outputPath);

  return cmd;
}

/**
 * Map user-friendly format names to FFmpeg format strings
 */
function getFFmpegFormat(format) {
  const formatMap = {
    'mp4': 'mp4',
    'avi': 'avi',
    'mkv': 'matroska',
    'mov': 'mov',
    'webm': 'webm',
    'wmv': 'asf',
    'flv': 'flv',
    'gif': 'gif',
    'mp3': 'mp3',
    'aac': 'adts',
    'm4a': 'ipod',
    'wav': 'wav',
    'ogg': 'ogg',
    'ts': 'mpegts',
    '3gp': '3gp'
  };
  return formatMap[format] || format;
}

/**
 * Convert a video file
 */
function convertVideo(options, onProgress) {
  return new Promise((resolve, reject) => {
    const { inputPath, outputDir, outputFormat, preset, id } = options;

    // Build output filename
    const inputName = path.basename(inputPath, path.extname(inputPath));
    let outputName = `${inputName}.${outputFormat}`;
    let outputPath = path.join(outputDir, outputName);

    // Avoid overwriting: append (1), (2), etc.
    let counter = 1;
    while (fs.existsSync(outputPath)) {
      outputName = `${inputName} (${counter}).${outputFormat}`;
      outputPath = path.join(outputDir, outputName);
      counter++;
    }

    const cmd = buildCommand(inputPath, outputPath, {
      outputFormat,
      preset,
      audioOnly: options.audioOnly
    });

    // Track for cancellation
    activeConversions.set(id, cmd);

    cmd
      .on('start', (commandLine) => {
        onProgress({
          status: 'converting',
          percent: 0,
          speed: '',
          command: commandLine
        });
      })
      .on('progress', (progress) => {
        onProgress({
          status: 'converting',
          percent: progress.percent || 0,
          speed: progress.currentKbps ? `${Math.round(progress.currentKbps)} kbps` : '',
          fps: progress.currentFps || 0,
          frames: progress.frames || 0,
          timemark: progress.timemark || '00:00:00'
        });
      })
      .on('end', () => {
        activeConversions.delete(id);
        const stats = fs.statSync(outputPath);
        resolve({
          success: true,
          outputPath,
          outputSize: stats.size
        });
      })
      .on('error', (err) => {
        activeConversions.delete(id);
        // Clean up partial file
        if (fs.existsSync(outputPath)) {
          try { fs.unlinkSync(outputPath); } catch {}
        }
        reject(err);
      })
      .run();
  });
}

/**
 * Cancel an active conversion
 */
function cancelConversion(id) {
  const cmd = activeConversions.get(id);
  if (cmd) {
    cmd.kill('SIGKILL');
    activeConversions.delete(id);
  }
}

module.exports = { convertVideo, probeVideo, cancelConversion };
