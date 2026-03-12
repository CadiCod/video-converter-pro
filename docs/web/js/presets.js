/**
 * Video Converter Pro (Web) - Presets Configuration
 * Quality presets, device profiles, and format definitions
 * Adapted from src/js/presets.js for browser ES module usage
 */

// Web/WASM-optimized presets: use faster x264 presets since single-threaded
// WASM is ~5-10x slower than native FFmpeg. Quality difference between
// 'ultrafast' and 'medium' is minimal at same CRF, but speed is dramatic.
export const QUALITY_PRESETS = {
  maximum: {
    name: 'Maximum Quality',
    description: 'Near-lossless quality, larger files',
    icon: 'crown',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 16,
      audioBitrate: '320k',
      pixelFormat: 'yuv420p',
      outputOptions: ['-preset veryfast']
    }
  },
  high: {
    name: 'High Quality',
    description: 'Excellent quality, moderate size',
    icon: 'star',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 20,
      audioBitrate: '192k',
      pixelFormat: 'yuv420p',
      outputOptions: ['-preset ultrafast']
    }
  },
  balanced: {
    name: 'Balanced',
    description: 'Great quality/size ratio',
    icon: 'balance',
    default: true,
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 23,
      audioBitrate: '128k',
      pixelFormat: 'yuv420p',
      outputOptions: ['-preset ultrafast']
    }
  },
  compact: {
    name: 'Compact',
    description: 'Smaller files, good quality',
    icon: 'compress',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 28,
      audioBitrate: '96k',
      pixelFormat: 'yuv420p',
      outputOptions: ['-preset ultrafast']
    }
  },
  minimum: {
    name: 'Minimum Size',
    description: 'Smallest possible, reduced quality',
    icon: 'minimize',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 35,
      audioBitrate: '64k',
      pixelFormat: 'yuv420p',
      resolution: '1280x720',
      outputOptions: ['-preset ultrafast']
    }
  }
};

export const DEVICE_PROFILES = {
  universal: {
    name: 'Universal',
    description: 'Plays on any device',
    icon: 'globe',
    default: true,
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      pixelFormat: 'yuv420p',
      outputOptions: ['-profile:v baseline', '-level 3.1', '-preset ultrafast']
    }
  },
  iphone: {
    name: 'iPhone / iPad',
    description: 'Optimized for Apple devices',
    icon: 'apple',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      pixelFormat: 'yuv420p',
      audioBitrate: '192k',
      outputOptions: ['-profile:v high', '-level 4.2', '-preset ultrafast']
    }
  },
  android: {
    name: 'Android',
    description: 'Optimized for Android devices',
    icon: 'android',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      pixelFormat: 'yuv420p',
      audioBitrate: '128k',
      outputOptions: ['-profile:v main', '-level 4.0', '-preset ultrafast']
    }
  },
  web: {
    name: 'Web / HTML5',
    description: 'For websites and web apps',
    icon: 'web',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 23,
      pixelFormat: 'yuv420p',
      outputOptions: ['-profile:v high', '-preset ultrafast']
    }
  },
  youtube: {
    name: 'YouTube',
    description: 'YouTube recommended settings',
    icon: 'youtube',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 18,
      audioBitrate: '384k',
      pixelFormat: 'yuv420p',
      outputOptions: ['-profile:v high', '-preset veryfast', '-bf 2', '-g 30']
    }
  },
  instagram: {
    name: 'Instagram',
    description: 'Feed, Reels, Stories ready',
    icon: 'instagram',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 20,
      audioBitrate: '128k',
      pixelFormat: 'yuv420p',
      resolution: '1080x1080',
      outputOptions: ['-profile:v high', '-preset ultrafast']
    }
  },
  tiktok: {
    name: 'TikTok',
    description: 'Vertical video optimized',
    icon: 'tiktok',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 20,
      audioBitrate: '128k',
      pixelFormat: 'yuv420p',
      resolution: '1080x1920',
      outputOptions: ['-profile:v high', '-preset ultrafast']
    }
  },
  twitter: {
    name: 'Twitter / X',
    description: 'Twitter video specs',
    icon: 'twitter',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 22,
      audioBitrate: '128k',
      pixelFormat: 'yuv420p',
      outputOptions: ['-profile:v high', '-preset ultrafast']
    }
  },
  whatsapp: {
    name: 'WhatsApp',
    description: 'Small, compatible files',
    icon: 'whatsapp',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 28,
      audioBitrate: '96k',
      pixelFormat: 'yuv420p',
      resolution: '720x?',
      outputOptions: ['-profile:v baseline', '-level 3.0', '-preset ultrafast']
    }
  },
  '4ktv': {
    name: '4K TV',
    description: 'Full 4K UHD quality',
    icon: 'tv',
    format: 'mp4',
    settings: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      crf: 18,
      audioBitrate: '320k',
      pixelFormat: 'yuv420p',
      outputOptions: ['-profile:v high', '-level 5.1', '-preset veryfast']
    }
  }
};

export const OUTPUT_FORMATS = {
  video: [
    { id: 'mp4', name: 'MP4', ext: 'mp4', description: 'Most compatible format', icon: 'film', wasmSupported: true },
    { id: 'webm', name: 'WebM', ext: 'webm', description: 'Web optimized (VP8)', icon: 'globe', wasmSupported: true },
    { id: 'avi', name: 'AVI', ext: 'avi', description: 'Legacy format', icon: 'film', wasmSupported: true },
    { id: 'mkv', name: 'MKV', ext: 'mkv', description: 'Feature-rich container', icon: 'film', wasmSupported: true },
    { id: 'mov', name: 'MOV', ext: 'mov', description: 'Apple QuickTime', icon: 'film', wasmSupported: true },
    { id: 'wmv', name: 'WMV', ext: 'wmv', description: 'Windows Media', icon: 'film', wasmSupported: false },
    { id: 'flv', name: 'FLV', ext: 'flv', description: 'Flash Video', icon: 'film', wasmSupported: true },
    { id: 'ts', name: 'TS', ext: 'ts', description: 'Transport Stream', icon: 'film', wasmSupported: true },
    { id: '3gp', name: '3GP', ext: '3gp', description: 'Mobile format', icon: 'phone', wasmSupported: true },
    { id: 'gif', name: 'GIF', ext: 'gif', description: 'Animated image', icon: 'image', wasmSupported: true }
  ],
  audio: [
    { id: 'mp3', name: 'MP3', ext: 'mp3', description: 'Universal audio', icon: 'music', wasmSupported: true },
    { id: 'aac', name: 'AAC', ext: 'aac', description: 'Advanced audio', icon: 'music', wasmSupported: true },
    { id: 'm4a', name: 'M4A', ext: 'm4a', description: 'Apple audio', icon: 'music', wasmSupported: true },
    { id: 'wav', name: 'WAV', ext: 'wav', description: 'Uncompressed audio', icon: 'music', wasmSupported: true },
    { id: 'ogg', name: 'OGG', ext: 'ogg', description: 'Open source audio', icon: 'music', wasmSupported: true }
  ]
};

export const RESOLUTIONS = [
  { id: 'original', name: 'Original', description: 'Keep original resolution' },
  { id: '3840x2160', name: '4K UHD', description: '3840 x 2160' },
  { id: '2560x1440', name: '2K QHD', description: '2560 x 1440' },
  { id: '1920x1080', name: '1080p Full HD', description: '1920 x 1080' },
  { id: '1280x720', name: '720p HD', description: '1280 x 720' },
  { id: '854x480', name: '480p SD', description: '854 x 480' },
  { id: '640x360', name: '360p', description: '640 x 360' }
];
