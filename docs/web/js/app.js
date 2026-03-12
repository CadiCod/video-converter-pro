/**
 * Video Converter Pro (Web) - Main Application
 * Browser-based video conversion using ffmpeg.wasm
 */

import { QUALITY_PRESETS, DEVICE_PROFILES, OUTPUT_FORMATS, RESOLUTIONS } from './presets.js';
import { loadFFmpeg, convertVideo, probeVideo, cancelConversion, getStatus } from './converter.js';
import { initTheme, toggleTheme, getCurrentTheme } from './theme.js';
import { initAnalytics, trackConversionStart, trackConversionComplete, trackThemeToggle, trackPWAInstall } from './analytics.js';

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

const state = {
  files: [],               // Array of { id, file, name, size, metadata, status, blobUrl }
  outputFormat: 'mp4',
  qualityPreset: 'balanced',
  deviceProfile: null,
  isConverting: false,
  previewFileId: null,
  advancedSettings: {
    resolution: 'original',
    crf: null,
    fps: null,
    audioBitrate: null
  }
};

let conversionResults = [];
let currentConversionIndex = 0;
let fileIdCounter = 0;
let deferredInstallPrompt = null;

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initAnalytics();
  initPWA();
  initThemeToggle();
  initDropzone();
  initPreview();
  initTabs();
  initFormats();
  initQualityPresets();
  initDeviceProfiles();
  initAdvancedSettings();
  initButtons();

  // Load FFmpeg
  await initFFmpeg();
});

async function initFFmpeg() {
  const statusEl = document.getElementById('loading-status');
  try {
    statusEl.textContent = 'Initializing WebAssembly engine...';
    const { isMultiThread } = await loadFFmpeg((msg) => {
      // Show last meaningful log line
      if (msg && !msg.startsWith('  ')) {
        statusEl.textContent = msg.substring(0, 80);
      }
    });

    // Show app
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');

    // Update status badge
    document.getElementById('status-text').textContent =
      isMultiThread ? 'Ready (Multi-threaded)' : 'Ready (Single-threaded)';
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.style.color = 'var(--error)';
    console.error('FFmpeg load error:', err);
  }
}

// ═══════════════════════════════════════════════════════════
// PWA
// ═══════════════════════════════════════════════════════════

function initPWA() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('btn-install').classList.remove('hidden');
  });

  document.getElementById('btn-install').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      trackPWAInstall();
    }
    deferredInstallPrompt = null;
    document.getElementById('btn-install').classList.add('hidden');
  });
}

// ═══════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════

function initThemeToggle() {
  document.getElementById('btn-theme').addEventListener('click', () => {
    const newTheme = toggleTheme();
    trackThemeToggle(newTheme);
  });
}

// ═══════════════════════════════════════════════════════════
// DROP ZONE
// ═══════════════════════════════════════════════════════════

function initDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  // Prevent default drag on window
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  // Drag visual feedback
  dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-over');
  });

  // Handle drop
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Click to browse
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      addFiles(Array.from(fileInput.files));
      fileInput.value = ''; // Reset so same file can be re-added
    }
  });
}

function initPreview() {
  document.getElementById('btn-close-preview').addEventListener('click', closePreview);
}

// ═══════════════════════════════════════════════════════════
// FILE MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function addFiles(fileList) {
  for (const file of fileList) {
    // Check for duplicates by name + size
    if (state.files.some(f => f.name === file.name && f.size === file.size)) continue;

    // Check file size limit (~2GB for browser)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      showToast(`${file.name} is too large (max 2 GB for browser)`);
      continue;
    }

    const id = ++fileIdCounter;
    const entry = { id, file, name: file.name, size: file.size, metadata: null, status: 'pending', blobUrl: null };
    state.files.push(entry);

    // Probe in background
    probeFile(entry);
  }

  updateFileQueue();
  updateConvertButton();

  if (state.files.length === 1 && !state.previewFileId) {
    showPreview(state.files[0].id);
  }
}

async function probeFile(entry) {
  try {
    // Quick metadata from video element
    const blobUrl = URL.createObjectURL(entry.file);
    entry.blobUrl = blobUrl;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = blobUrl;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        entry.metadata = {
          duration: video.duration || 0,
          video: {
            width: video.videoWidth,
            height: video.videoHeight,
            codec: '---',
            fps: 30
          }
        };
        resolve();
      };
      video.onerror = () => {
        // Audio file or unsupported — set basic metadata
        entry.metadata = { duration: 0, video: null };
        resolve();
      };
    });

    updateFileItem(entry);
    if (state.previewFileId === entry.id) showPreview(entry.id);
  } catch (err) {
    console.warn('Probe error:', err);
  }
}

function removeFile(id) {
  const entry = state.files.find(f => f.id === id);
  if (entry?.blobUrl) URL.revokeObjectURL(entry.blobUrl);
  if (state.previewFileId === id) closePreview();
  state.files = state.files.filter(f => f.id !== id);
  updateFileQueue();
  updateConvertButton();
}

function clearAllFiles() {
  state.files.forEach(f => { if (f.blobUrl) URL.revokeObjectURL(f.blobUrl); });
  closePreview();
  state.files = [];
  updateFileQueue();
  updateConvertButton();
}

// ═══════════════════════════════════════════════════════════
// VIDEO PREVIEW
// ═══════════════════════════════════════════════════════════

function showPreview(fileId) {
  const entry = state.files.find(f => f.id === fileId);
  if (!entry) return;

  state.previewFileId = fileId;

  const previewPanel = document.getElementById('video-preview');
  const video = document.getElementById('preview-video');
  const previewInfo = document.getElementById('preview-info');

  // Use blob URL for preview
  if (!entry.blobUrl) {
    entry.blobUrl = URL.createObjectURL(entry.file);
  }
  video.src = entry.blobUrl;

  // Build info grid
  const meta = entry.metadata;
  if (meta && meta.video) {
    previewInfo.innerHTML = `
      <div class="preview-stat">
        <div class="preview-stat-value">${meta.video.width}x${meta.video.height}</div>
        <div class="preview-stat-label">Resolution</div>
      </div>
      <div class="preview-stat">
        <div class="preview-stat-value">${formatDuration(meta.duration)}</div>
        <div class="preview-stat-label">Duration</div>
      </div>
      <div class="preview-stat">
        <div class="preview-stat-value">${formatFileSize(entry.size)}</div>
        <div class="preview-stat-label">Size</div>
      </div>
    `;
  } else {
    previewInfo.innerHTML = `
      <div class="preview-stat">
        <div class="preview-stat-value">${formatFileSize(entry.size)}</div>
        <div class="preview-stat-label">Size</div>
      </div>
    `;
  }

  previewPanel.classList.remove('hidden');
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.file-item[data-id="${fileId}"]`)?.classList.add('active');
}

function closePreview() {
  state.previewFileId = null;
  const video = document.getElementById('preview-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  document.getElementById('video-preview').classList.add('hidden');
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
}

// ═══════════════════════════════════════════════════════════
// FILE QUEUE UI
// ═══════════════════════════════════════════════════════════

function updateFileQueue() {
  const queueList = document.getElementById('queue-list');
  const fileCount = document.getElementById('file-count');
  const dropzone = document.getElementById('dropzone');
  const fileQueue = document.getElementById('file-queue');

  fileCount.textContent = state.files.length;

  if (state.files.length === 0) {
    dropzone.classList.remove('has-files');
    fileQueue.classList.add('hidden');
    queueList.innerHTML = '';
    return;
  }

  dropzone.classList.add('has-files');
  fileQueue.classList.remove('hidden');

  queueList.innerHTML = state.files.map(f => createFileItemHTML(f)).join('');

  // Bind events
  queueList.querySelectorAll('.file-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFile(parseInt(btn.dataset.id));
    });
  });

  queueList.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      if (state.previewFileId === id) closePreview();
      else showPreview(id);
    });
  });
}

function createFileItemHTML(entry) {
  const ext = entry.name.split('.').pop().toUpperCase();
  const sizeStr = formatFileSize(entry.size);
  const metaStr = entry.metadata?.video
    ? `${entry.metadata.video.width}x${entry.metadata.video.height} \u00b7 ${formatDuration(entry.metadata.duration)}`
    : entry.metadata ? formatDuration(entry.metadata.duration) || 'Audio' : 'Analyzing...';

  let statusHTML = '';
  if (entry.status === 'done') {
    statusHTML = '<div class="file-item-status status-done"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>';
  } else if (entry.status === 'error') {
    statusHTML = '<div class="file-item-status status-error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>';
  }

  return `
    <div class="file-item" data-id="${entry.id}">
      <div class="file-item-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
      </div>
      <div class="file-item-info">
        <div class="file-item-name" title="${entry.name}">${entry.name}</div>
        <div class="file-item-meta">
          <span>${ext}</span>
          <span>${sizeStr}</span>
          <span>${metaStr}</span>
        </div>
      </div>
      ${statusHTML}
      <button class="file-item-remove" data-id="${entry.id}" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
}

function updateFileItem(entry) {
  const item = document.querySelector(`.file-item[data-id="${entry.id}"]`);
  if (!item) return;
  const meta = item.querySelector('.file-item-meta');
  if (meta && entry.metadata) {
    const ext = entry.name.split('.').pop().toUpperCase();
    const metaStr = entry.metadata.video
      ? `${entry.metadata.video.width}x${entry.metadata.video.height} \u00b7 ${formatDuration(entry.metadata.duration)}`
      : formatDuration(entry.metadata.duration) || 'Audio';
    meta.innerHTML = `<span>${ext}</span><span>${formatFileSize(entry.size)}</span><span>${metaStr}</span>`;
  }
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

      if (tab.dataset.tab === 'format' || tab.dataset.tab === 'quality') {
        state.deviceProfile = null;
        document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// FORMAT SELECTION
// ═══════════════════════════════════════════════════════════

function initFormats() {
  const videoGrid = document.getElementById('format-grid-video');
  const audioGrid = document.getElementById('format-grid-audio');

  OUTPUT_FORMATS.video.forEach(fmt => {
    videoGrid.appendChild(createFormatCard(fmt, fmt.id === state.outputFormat));
  });

  OUTPUT_FORMATS.audio.forEach(fmt => {
    audioGrid.appendChild(createFormatCard(fmt, false));
  });
}

function createFormatCard(fmt, isActive) {
  const card = document.createElement('div');
  const unsupported = fmt.wasmSupported === false;
  card.className = `format-card${isActive ? ' active' : ''}${unsupported ? ' unsupported' : ''}`;
  card.dataset.format = fmt.id;
  if (unsupported) card.title = 'Not available in web version';
  card.innerHTML = `
    <div class="format-card-name">${fmt.name}</div>
    <div class="format-card-ext">.${fmt.ext}</div>
  `;
  if (!unsupported) {
    card.addEventListener('click', () => selectFormat(fmt.id));
  }
  return card;
}

function selectFormat(formatId) {
  state.outputFormat = formatId;
  state.deviceProfile = null;
  document.querySelectorAll('.format-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.format-card[data-format="${formatId}"]`)?.classList.add('active');
  document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
}

// ═══════════════════════════════════════════════════════════
// QUALITY PRESETS
// ═══════════════════════════════════════════════════════════

function initQualityPresets() {
  const container = document.getElementById('quality-presets');
  const icons = { crown: '\u{1F451}', star: '\u{2B50}', balance: '\u{2696}', compress: '\u{1F4E6}', minimize: '\u{1F5DC}' };

  Object.entries(QUALITY_PRESETS).forEach(([key, preset]) => {
    const card = document.createElement('div');
    card.className = `preset-card${key === state.qualityPreset ? ' active' : ''}`;
    card.dataset.preset = key;
    card.innerHTML = `
      <div class="preset-icon">${icons[preset.icon] || '\u{1F3AC}'}</div>
      <div class="preset-info">
        <div class="preset-name">${preset.name}</div>
        <div class="preset-desc">${preset.description}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      state.qualityPreset = key;
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
    container.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════
// DEVICE PROFILES
// ═══════════════════════════════════════════════════════════

function initDeviceProfiles() {
  const grid = document.getElementById('device-grid');
  const icons = {
    globe: '\u{1F310}', apple: '\u{1F34E}', android: '\u{1F4F1}', web: '\u{1F310}',
    youtube: '\u{25B6}\u{FE0F}', instagram: '\u{1F4F7}', tiktok: '\u{1F3B5}',
    twitter: '\u{1F426}', whatsapp: '\u{1F4AC}', tv: '\u{1F4FA}'
  };

  Object.entries(DEVICE_PROFILES).forEach(([key, profile]) => {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.dataset.device = key;
    card.innerHTML = `
      <div class="device-icon">${icons[profile.icon] || '\u{1F4F1}'}</div>
      <div>
        <div class="device-name">${profile.name}</div>
        <div class="device-desc">${profile.description}</div>
      </div>
    `;
    card.addEventListener('click', () => selectDeviceProfile(key));
    grid.appendChild(card);
  });
}

function selectDeviceProfile(key) {
  const profile = DEVICE_PROFILES[key];

  if (state.deviceProfile === key) {
    state.deviceProfile = null;
    document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
    return;
  }

  state.deviceProfile = key;
  state.outputFormat = profile.format;

  document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.device-card[data-device="${key}"]`)?.classList.add('active');

  document.querySelectorAll('.format-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.format-card[data-format="${profile.format}"]`)?.classList.add('active');
}

// ═══════════════════════════════════════════════════════════
// ADVANCED SETTINGS
// ═══════════════════════════════════════════════════════════

function initAdvancedSettings() {
  const resSelect = document.getElementById('select-resolution');
  RESOLUTIONS.forEach(res => {
    const opt = document.createElement('option');
    opt.value = res.id;
    opt.textContent = `${res.name}${res.description ? ` (${res.description})` : ''}`;
    resSelect.appendChild(opt);
  });
  resSelect.addEventListener('change', (e) => { state.advancedSettings.resolution = e.target.value; });

  const crfRange = document.getElementById('range-crf');
  const crfValue = document.getElementById('crf-value');
  crfRange.addEventListener('input', (e) => {
    crfValue.textContent = e.target.value;
    state.advancedSettings.crf = parseInt(e.target.value);
  });

  document.getElementById('select-fps').addEventListener('change', (e) => {
    state.advancedSettings.fps = e.target.value === 'original' ? null : parseInt(e.target.value);
  });

  document.getElementById('select-audio-bitrate').addEventListener('change', (e) => {
    state.advancedSettings.audioBitrate = e.target.value || null;
  });
}

// ═══════════════════════════════════════════════════════════
// BUTTONS
// ═══════════════════════════════════════════════════════════

function initButtons() {
  document.getElementById('btn-add-more').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('btn-clear-all').addEventListener('click', clearAllFiles);
  document.getElementById('btn-convert').addEventListener('click', startConversion);
  document.getElementById('btn-cancel').addEventListener('click', cancelAllConversions);
  document.getElementById('btn-convert-more').addEventListener('click', resetForMore);
}

function updateConvertButton() {
  const btn = document.getElementById('btn-convert');
  btn.disabled = state.files.length === 0;
  const label = btn.querySelector('span');
  label.textContent = state.files.length > 1 ? `Convert ${state.files.length} Files` : 'Convert';
}

// ═══════════════════════════════════════════════════════════
// CONVERSION
// ═══════════════════════════════════════════════════════════

function buildPresetSettings() {
  let settings = { ...QUALITY_PRESETS[state.qualityPreset]?.settings || {} };

  if (state.deviceProfile && DEVICE_PROFILES[state.deviceProfile]) {
    settings = { ...settings, ...DEVICE_PROFILES[state.deviceProfile].settings };
  }

  const adv = state.advancedSettings;
  if (adv.resolution && adv.resolution !== 'original') settings.resolution = adv.resolution;
  if (adv.crf !== null) settings.crf = adv.crf;
  if (adv.fps) settings.fps = adv.fps;
  if (adv.audioBitrate) settings.audioBitrate = adv.audioBitrate;

  return settings;
}

async function startConversion() {
  const pendingFiles = state.files.filter(f => f.status === 'pending');
  if (pendingFiles.length === 0 || state.isConverting) {
    showToast('No files to convert. Add videos first.');
    return;
  }

  state.isConverting = true;
  conversionResults = [];
  currentConversionIndex = 0;

  const overlay = document.getElementById('progress-overlay');
  overlay.classList.remove('hidden');

  const totalFiles = pendingFiles.length;
  const preset = buildPresetSettings();
  const isAudioFormat = OUTPUT_FORMATS.audio.some(f => f.id === state.outputFormat);
  const conversionStart = Date.now();

  trackConversionStart(state.outputFormat, state.qualityPreset, totalFiles);

  for (let i = 0; i < totalFiles; i++) {
    if (!state.isConverting) break;

    currentConversionIndex = i;
    const entry = pendingFiles[i];

    updateProgressUI(entry.name, 0, `${i + 1} / ${totalFiles}`, (i / totalFiles) * 100);

    try {
      const result = await convertVideo(entry.file, {
        outputFormat: state.outputFormat,
        preset,
        audioOnly: isAudioFormat
      }, (progress) => {
        const overallPercent = ((i + (progress.percent / 100)) / totalFiles) * 100;
        updateProgressUI(entry.name, progress.percent, `${i + 1} / ${totalFiles}`, overallPercent);
      });

      entry.status = 'done';
      conversionResults.push({ entry, ...result });

      // Trigger download
      downloadBlob(result.blob, result.outputFileName);
    } catch (err) {
      console.error(`Conversion error (${entry.name}):`, err);
      entry.status = 'error';
      conversionResults.push({ entry, error: err.message });
    }

    // Reload FFmpeg if it was terminated (after cancel or error sometimes)
    const status = getStatus();
    if (!status.isLoaded && state.isConverting) {
      try {
        await loadFFmpeg();
      } catch {
        break;
      }
    }
  }

  const duration = Date.now() - conversionStart;
  trackConversionComplete(state.outputFormat, totalFiles, duration);

  state.isConverting = false;
  overlay.classList.add('hidden');
  updateFileQueue();
  showCompletionScreen();
}

async function cancelAllConversions() {
  state.isConverting = false;
  await cancelConversion();
  document.getElementById('progress-overlay').classList.add('hidden');

  // Reload FFmpeg for future use
  try { await loadFFmpeg(); } catch {}

  showToast('Conversion cancelled');
}

function updateProgressUI(filename, percent, count, overallPercent) {
  document.getElementById('progress-filename').textContent = filename;
  document.getElementById('progress-bar').style.width = `${Math.min(percent, 100)}%`;
  document.getElementById('progress-percent').textContent = `${Math.round(percent)}%`;
  document.getElementById('progress-count').textContent = count;
  document.getElementById('overall-bar').style.width = `${Math.min(overallPercent, 100)}%`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ═══════════════════════════════════════════════════════════
// COMPLETION
// ═══════════════════════════════════════════════════════════

function showCompletionScreen() {
  const successful = conversionResults.filter(r => r.success);
  const failed = conversionResults.filter(r => r.error);

  const totalInputSize = conversionResults.reduce((acc, r) => acc + (r.entry?.size || 0), 0);
  const totalOutputSize = successful.reduce((acc, r) => acc + (r.outputSize || 0), 0);

  let savedDisplay = '---';
  if (successful.length > 0 && totalInputSize > 0) {
    const savedPercent = Math.round((1 - totalOutputSize / totalInputSize) * 100);
    savedDisplay = savedPercent > 0 ? savedPercent + '%' : '~0%';
  }

  document.getElementById('complete-stats').innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${successful.length}</div>
      <div class="stat-label">Converted</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${formatFileSize(totalOutputSize)}</div>
      <div class="stat-label">Total Size</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${savedDisplay}</div>
      <div class="stat-label">Size Saved</div>
    </div>
  `;

  const errorsEl = document.getElementById('complete-errors');
  if (failed.length > 0) {
    errorsEl.innerHTML = `
      <h4>${failed.length} file${failed.length > 1 ? 's' : ''} failed</h4>
      ${failed.map(r => `<div class="complete-error-item" title="${r.error}">${r.entry?.name}: ${r.error}</div>`).join('')}
    `;
    errorsEl.style.display = 'block';
  } else {
    errorsEl.style.display = 'none';
  }

  const heading = document.getElementById('complete-heading');
  if (successful.length === 0 && failed.length > 0) heading.textContent = 'Conversion Failed';
  else if (failed.length > 0) heading.textContent = 'Conversion Partially Complete';
  else heading.textContent = 'Conversion Complete!';

  document.getElementById('complete-overlay').classList.remove('hidden');
}

function resetForMore() {
  document.getElementById('complete-overlay').classList.add('hidden');
  state.files.forEach(f => { if (f.blobUrl) URL.revokeObjectURL(f.blobUrl); });
  state.files = [];
  conversionResults = [];
  currentConversionIndex = 0;
  updateFileQueue();
  updateConvertButton();

  state.advancedSettings = { resolution: 'original', crf: null, fps: null, audioBitrate: null };
  document.getElementById('range-crf').value = 23;
  document.getElementById('crf-value').textContent = '23';
  document.getElementById('select-resolution').value = 'original';
  document.getElementById('select-fps').value = 'original';
  document.getElementById('select-audio-bitrate').value = '';
}

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  toastMsg.textContent = message;
  toast.classList.remove('hidden');
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, duration);
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function formatDuration(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
