/**
 * Video Converter Pro - Frontend Application
 */

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

const state = {
  files: [],               // Array of { id, path, name, size, metadata }
  outputFormat: 'mp4',
  qualityPreset: 'balanced',
  deviceProfile: null,
  outputDir: '',
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

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  // Set default output directory
  state.outputDir = await window.api.getDefaultOutputDir();
  updateOutputPath();

  // Initialize UI components
  initTitlebar();
  initDropzone();
  initPreview();
  initTabs();
  initFormats();
  initQualityPresets();
  initDeviceProfiles();
  initAdvancedSettings();
  initButtons();
  initProgressListener();
});

// ═══════════════════════════════════════════════════════════
// TITLE BAR
// ═══════════════════════════════════════════════════════════

function initTitlebar() {
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.close());
}

// ═══════════════════════════════════════════════════════════
// DROP ZONE
// ═══════════════════════════════════════════════════════════

function initDropzone() {
  const dropzone = document.getElementById('dropzone');

  // Prevent default drag behavior on the whole window FIRST
  // Use capture phase so it doesn't interfere with dropzone
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
  });

  // Drag visual feedback on dropzone
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

  // Handle drop on dropzone
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-over');

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const paths = [];
      for (let i = 0; i < droppedFiles.length; i++) {
        // Use Electron's webUtils API (v33+) for reliable path access
        const filePath = window.api.getPathForFile(droppedFiles[i]);
        if (filePath && filePath.length > 0) {
          paths.push(filePath);
        }
      }
      if (paths.length > 0) {
        addFiles(paths);
      } else {
        showToast('Could not read file paths. Try the Browse button.');
      }
    }
  });

  // Click to browse
  dropzone.addEventListener('click', browseFiles);
  document.getElementById('btn-browse').addEventListener('click', (e) => {
    e.stopPropagation();
    browseFiles();
  });
}

function initPreview() {
  document.getElementById('btn-close-preview').addEventListener('click', closePreview);
}

async function browseFiles() {
  const paths = await window.api.openFiles();
  if (paths.length > 0) {
    addFiles(paths);
  }
}

// ═══════════════════════════════════════════════════════════
// FILE MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function addFiles(filePaths) {
  for (const filePath of filePaths) {
    // Guard against undefined/empty paths
    if (!filePath || typeof filePath !== 'string') continue;

    // Check for duplicates
    if (state.files.some(f => f.path === filePath)) continue;

    const id = ++fileIdCounter;
    const name = filePath.split(/[/\\]/).pop();
    const size = await window.api.getFileSize(filePath);

    const file = { id, path: filePath, name, size, metadata: null, status: 'pending' };
    state.files.push(file);

    // Probe video metadata in background
    probeFile(file);
  }

  updateFileQueue();
  updateConvertButton();

  // Auto-show preview for first file added
  if (state.files.length === 1 && !state.previewFileId) {
    showPreview(state.files[0].id);
  }
}

async function probeFile(file) {
  try {
    const metadata = await window.api.probeVideo(file.path);
    if (!metadata.error) {
      file.metadata = metadata;
      updateFileItem(file);
      // Refresh preview if this file is being previewed
      if (state.previewFileId === file.id) {
        showPreview(file.id);
      }
    }
  } catch (err) {
    console.error('Probe error:', err);
  }
}

function removeFile(id) {
  // Close preview if showing this file
  if (state.previewFileId === id) {
    closePreview();
  }
  state.files = state.files.filter(f => f.id !== id);
  updateFileQueue();
  updateConvertButton();
}

function clearAllFiles() {
  closePreview();
  state.files = [];
  updateFileQueue();
  updateConvertButton();
}

// ═══════════════════════════════════════════════════════════
// VIDEO PREVIEW
// ═══════════════════════════════════════════════════════════

function showPreview(fileId) {
  const file = state.files.find(f => f.id === fileId);
  if (!file) return;

  state.previewFileId = fileId;

  const previewPanel = document.getElementById('video-preview');
  const video = document.getElementById('preview-video');
  const previewInfo = document.getElementById('preview-info');

  // Load local file directly
  video.src = 'file:///' + file.path.replace(/\\/g, '/');

  // Build info grid
  const meta = file.metadata;
  if (meta) {
    previewInfo.innerHTML = `
      <div class="preview-stat">
        <div class="preview-stat-value">${meta.video ? `${meta.video.width}x${meta.video.height}` : '---'}</div>
        <div class="preview-stat-label">Resolution</div>
      </div>
      <div class="preview-stat">
        <div class="preview-stat-value">${formatDuration(meta.duration)}</div>
        <div class="preview-stat-label">Duration</div>
      </div>
      <div class="preview-stat">
        <div class="preview-stat-value">${formatFileSize(file.size)}</div>
        <div class="preview-stat-label">Size</div>
      </div>
      <div class="preview-stat">
        <div class="preview-stat-value">${meta.video?.codec?.toUpperCase() || '---'}</div>
        <div class="preview-stat-label">Codec</div>
      </div>
      <div class="preview-stat">
        <div class="preview-stat-value">${meta.video ? Math.round(meta.video.fps) : '---'} fps</div>
        <div class="preview-stat-label">Frame Rate</div>
      </div>
      <div class="preview-stat">
        <div class="preview-stat-value">${meta.bitrate ? Math.round(meta.bitrate / 1000) + 'k' : '---'}</div>
        <div class="preview-stat-label">Bitrate</div>
      </div>
    `;
  } else {
    previewInfo.innerHTML = `
      <div class="preview-stat">
        <div class="preview-stat-value">${formatFileSize(file.size)}</div>
        <div class="preview-stat-label">Size</div>
      </div>
    `;
  }

  previewPanel.classList.remove('hidden');

  // Highlight active file
  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.file-item[data-id="${fileId}"]`)?.classList.add('active');
}

function closePreview() {
  state.previewFileId = null;
  const previewPanel = document.getElementById('video-preview');
  const video = document.getElementById('preview-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  previewPanel.classList.add('hidden');
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

  queueList.innerHTML = state.files.map(file => createFileItemHTML(file)).join('');

  // Bind remove buttons
  queueList.querySelectorAll('.file-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFile(parseInt(btn.dataset.id));
    });
  });

  // Bind click on file items to show preview
  queueList.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      if (state.previewFileId === id) {
        closePreview();
      } else {
        showPreview(id);
      }
    });
  });
}

function createFileItemHTML(file) {
  const ext = file.name.split('.').pop().toUpperCase();
  const sizeStr = formatFileSize(file.size);
  const metaStr = file.metadata
    ? `${file.metadata.video?.width}x${file.metadata.video?.height} &middot; ${formatDuration(file.metadata.duration)}`
    : 'Analyzing...';

  let statusHTML = '';
  if (file.status === 'done') {
    statusHTML = '<div class="file-item-status status-done"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>';
  } else if (file.status === 'error') {
    statusHTML = '<div class="file-item-status status-error"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>';
  }

  return `
    <div class="file-item" data-id="${file.id}">
      <div class="file-item-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
      </div>
      <div class="file-item-info">
        <div class="file-item-name" title="${file.name}">${file.name}</div>
        <div class="file-item-meta">
          <span>${ext}</span>
          <span>${sizeStr}</span>
          <span>${metaStr}</span>
        </div>
      </div>
      ${statusHTML}
      <button class="file-item-remove" data-id="${file.id}" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
}

function updateFileItem(file) {
  const item = document.querySelector(`.file-item[data-id="${file.id}"]`);
  if (!item) return;
  const meta = item.querySelector('.file-item-meta');
  if (meta && file.metadata) {
    const ext = file.name.split('.').pop().toUpperCase();
    meta.innerHTML = `
      <span>${ext}</span>
      <span>${formatFileSize(file.size)}</span>
      <span>${file.metadata.video?.width}x${file.metadata.video?.height} &middot; ${formatDuration(file.metadata.duration)}</span>
    `;
  }
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

      // Reset device profile when switching to format/quality tabs
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
    const card = createFormatCard(fmt, fmt.id === state.outputFormat);
    videoGrid.appendChild(card);
  });

  OUTPUT_FORMATS.audio.forEach(fmt => {
    const card = createFormatCard(fmt, false);
    audioGrid.appendChild(card);
  });
}

function createFormatCard(fmt, isActive) {
  const card = document.createElement('div');
  card.className = `format-card${isActive ? ' active' : ''}`;
  card.dataset.format = fmt.id;
  card.innerHTML = `
    <div class="format-card-name">${fmt.name}</div>
    <div class="format-card-ext">.${fmt.ext}</div>
  `;
  card.addEventListener('click', () => selectFormat(fmt.id));
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

  const icons = {
    crown: '\u{1F451}',
    star: '\u{2B50}',
    balance: '\u{2696}',
    compress: '\u{1F4E6}',
    minimize: '\u{1F5DC}'
  };

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
    card.addEventListener('click', () => selectQualityPreset(key));
    container.appendChild(card);
  });
}

function selectQualityPreset(key) {
  state.qualityPreset = key;
  document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.preset-card[data-preset="${key}"]`)?.classList.add('active');
}

// ═══════════════════════════════════════════════════════════
// DEVICE PROFILES
// ═══════════════════════════════════════════════════════════

function initDeviceProfiles() {
  const grid = document.getElementById('device-grid');

  const icons = {
    globe: '\u{1F310}',
    apple: '\u{1F34E}',
    android: '\u{1F4F1}',
    web: '\u{1F310}',
    youtube: '\u{25B6}\u{FE0F}',
    instagram: '\u{1F4F7}',
    tiktok: '\u{1F3B5}',
    twitter: '\u{1F426}',
    whatsapp: '\u{1F4AC}',
    tv: '\u{1F4FA}'
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
    // Deselect
    state.deviceProfile = null;
    document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
    return;
  }

  state.deviceProfile = key;
  state.outputFormat = profile.format;

  // Update device cards
  document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.device-card[data-device="${key}"]`)?.classList.add('active');

  // Update format selection
  document.querySelectorAll('.format-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.format-card[data-format="${profile.format}"]`)?.classList.add('active');
}

// ═══════════════════════════════════════════════════════════
// ADVANCED SETTINGS
// ═══════════════════════════════════════════════════════════

function initAdvancedSettings() {
  // Resolution
  const resSelect = document.getElementById('select-resolution');
  RESOLUTIONS.forEach(res => {
    const opt = document.createElement('option');
    opt.value = res.id;
    opt.textContent = `${res.name} ${res.description ? `(${res.description})` : ''}`;
    resSelect.appendChild(opt);
  });
  resSelect.addEventListener('change', (e) => {
    state.advancedSettings.resolution = e.target.value;
  });

  // CRF slider
  const crfRange = document.getElementById('range-crf');
  const crfValue = document.getElementById('crf-value');
  crfRange.addEventListener('input', (e) => {
    crfValue.textContent = e.target.value;
    state.advancedSettings.crf = parseInt(e.target.value);
  });

  // FPS
  document.getElementById('select-fps').addEventListener('change', (e) => {
    state.advancedSettings.fps = e.target.value === 'original' ? null : parseInt(e.target.value);
  });

  // Audio bitrate
  document.getElementById('select-audio-bitrate').addEventListener('change', (e) => {
    state.advancedSettings.audioBitrate = e.target.value || null;
  });
}

// ═══════════════════════════════════════════════════════════
// BUTTONS
// ═══════════════════════════════════════════════════════════

function initButtons() {
  document.getElementById('btn-add-more').addEventListener('click', browseFiles);
  document.getElementById('btn-clear-all').addEventListener('click', clearAllFiles);
  document.getElementById('btn-change-output').addEventListener('click', changeOutputDir);
  document.getElementById('output-path').addEventListener('click', changeOutputDir);
  document.getElementById('btn-convert').addEventListener('click', startConversion);
  document.getElementById('btn-cancel').addEventListener('click', cancelAllConversions);
  document.getElementById('btn-open-folder').addEventListener('click', () => {
    window.api.openInExplorer(state.outputDir);
  });
  document.getElementById('btn-convert-more').addEventListener('click', resetForMore);

  // Mezamii branding links — open in default browser
  document.getElementById('link-mezamii-cta').addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openExternal('https://mezamii.com?utm_source=videoconverter&utm_medium=app&utm_campaign=completion_cta');
  });
  document.getElementById('mezamii-cta').addEventListener('click', (e) => {
    if (e.target.closest('.mezamii-cta-btn')) return; // already handled above
    window.api.openExternal('https://mezamii.com?utm_source=videoconverter&utm_medium=app&utm_campaign=completion_card');
  });
  document.getElementById('link-mezamii-sidebar').addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openExternal('https://mezamii.com?utm_source=videoconverter&utm_medium=app&utm_campaign=sidebar_promo');
  });
}

function updateConvertButton() {
  const btn = document.getElementById('btn-convert');
  btn.disabled = state.files.length === 0;

  const label = btn.querySelector('span');
  if (state.files.length > 1) {
    label.textContent = `Convert ${state.files.length} Files`;
  } else {
    label.textContent = 'Convert';
  }
}

async function changeOutputDir() {
  const dir = await window.api.selectOutputDir();
  if (dir) {
    state.outputDir = dir;
    updateOutputPath();
  }
}

function updateOutputPath() {
  document.getElementById('output-path').textContent = state.outputDir;
  document.getElementById('output-path').title = state.outputDir;
}

// ═══════════════════════════════════════════════════════════
// CONVERSION
// ═══════════════════════════════════════════════════════════

function buildPresetSettings() {
  // Start with quality preset
  let settings = { ...QUALITY_PRESETS[state.qualityPreset]?.settings || {} };

  // Override with device profile if selected
  if (state.deviceProfile && DEVICE_PROFILES[state.deviceProfile]) {
    settings = { ...settings, ...DEVICE_PROFILES[state.deviceProfile].settings };
  }

  // Override with advanced settings
  const adv = state.advancedSettings;
  if (adv.resolution && adv.resolution !== 'original') {
    settings.resolution = adv.resolution;
  }
  if (adv.crf !== null) {
    settings.crf = adv.crf;
  }
  if (adv.fps) {
    settings.fps = adv.fps;
  }
  if (adv.audioBitrate) {
    settings.audioBitrate = adv.audioBitrate;
  }

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

  console.log(`Starting conversion of ${totalFiles} files to ${state.outputFormat}`);
  console.log('Preset settings:', JSON.stringify(preset));

  for (let i = 0; i < totalFiles; i++) {
    if (!state.isConverting) break;

    currentConversionIndex = i;
    const file = pendingFiles[i];

    updateProgressUI(file.name, 0, `${i + 1} / ${totalFiles}`, i / totalFiles * 100);

    try {
      console.log(`Converting: ${file.name} -> ${state.outputFormat}`);
      const result = await window.api.convertVideo({
        id: file.id,
        inputPath: file.path,
        outputDir: state.outputDir,
        outputFormat: state.outputFormat,
        preset: preset,
        audioOnly: isAudioFormat
      });

      if (result.error) {
        console.error(`Error converting ${file.name}:`, result.error);
        file.status = 'error';
        conversionResults.push({ file, error: result.error });
      } else {
        console.log(`Done: ${file.name} -> ${result.outputPath} (${formatFileSize(result.outputSize)})`);
        file.status = 'done';
        conversionResults.push({ file, ...result });
      }
    } catch (err) {
      console.error(`Exception converting ${file.name}:`, err);
      file.status = 'error';
      conversionResults.push({ file, error: err.message });
    }
  }

  state.isConverting = false;
  overlay.classList.add('hidden');
  updateFileQueue();
  showCompletionScreen();
}

function cancelAllConversions() {
  state.isConverting = false;
  state.files.forEach(f => {
    if (f.status !== 'done') {
      window.api.cancelConversion(f.id);
    }
  });
  document.getElementById('progress-overlay').classList.add('hidden');
  showToast('Conversion cancelled');
}

function initProgressListener() {
  window.api.onProgress((data) => {
    if (!state.isConverting) return;

    const totalFiles = state.files.length;
    const overallPercent = ((currentConversionIndex + (data.percent || 0) / 100) / totalFiles) * 100;

    const file = state.files.find(f => f.id === data.id);
    const fileName = file ? file.name : 'Converting...';

    updateProgressUI(
      fileName,
      data.percent || 0,
      `${currentConversionIndex + 1} / ${totalFiles}`,
      overallPercent,
      data.speed,
      data.timemark
    );
  });
}

function updateProgressUI(filename, percent, count, overallPercent, speed, timemark) {
  document.getElementById('progress-filename').textContent = filename;
  document.getElementById('progress-bar').style.width = `${Math.min(percent, 100)}%`;
  document.getElementById('progress-percent').textContent = `${Math.round(percent)}%`;
  document.getElementById('progress-count').textContent = count;
  document.getElementById('overall-bar').style.width = `${Math.min(overallPercent, 100)}%`;

  if (speed) document.getElementById('progress-speed').textContent = speed;
  if (timemark) document.getElementById('progress-time').textContent = timemark;
}

// ═══════════════════════════════════════════════════════════
// COMPLETION
// ═══════════════════════════════════════════════════════════

function showCompletionScreen() {
  const successful = conversionResults.filter(r => r.success);
  const failed = conversionResults.filter(r => r.error);

  const totalInputSize = conversionResults.reduce((acc, r) => acc + (r.file?.size || 0), 0);
  const totalOutputSize = successful.reduce((acc, r) => acc + (r.outputSize || 0), 0);

  // Only show saved percent if there are successful conversions
  let savedDisplay = '---';
  if (successful.length > 0 && totalInputSize > 0) {
    const savedPercent = Math.round((1 - totalOutputSize / totalInputSize) * 100);
    savedDisplay = savedPercent > 0 ? savedPercent + '%' : '~0%';
  }

  let statsHTML = `
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

  document.getElementById('complete-stats').innerHTML = statsHTML;

  // Show error details if any conversions failed
  let errorsContainer = document.getElementById('complete-errors');
  if (!errorsContainer) {
    errorsContainer = document.createElement('div');
    errorsContainer.id = 'complete-errors';
    errorsContainer.className = 'complete-errors';
    const completeStats = document.getElementById('complete-stats');
    completeStats.parentNode.insertBefore(errorsContainer, completeStats.nextSibling);
  }

  if (failed.length > 0) {
    errorsContainer.innerHTML = `
      <h4>${failed.length} file${failed.length > 1 ? 's' : ''} failed</h4>
      ${failed.map(r => `<div class="complete-error-item" title="${r.error}">${r.file?.name}: ${r.error}</div>`).join('')}
    `;
    errorsContainer.style.display = 'block';
  } else {
    errorsContainer.style.display = 'none';
  }

  // Update heading based on results
  const heading = document.querySelector('.complete-panel h3');
  if (successful.length === 0 && failed.length > 0) {
    heading.textContent = 'Conversion Failed';
  } else if (failed.length > 0) {
    heading.textContent = 'Conversion Partially Complete';
  } else {
    heading.textContent = 'Conversion Complete!';
  }

  document.getElementById('complete-overlay').classList.remove('hidden');
}

function resetForMore() {
  document.getElementById('complete-overlay').classList.add('hidden');
  state.files = [];
  conversionResults = [];
  currentConversionIndex = 0;
  updateFileQueue();
  updateConvertButton();

  // Reset advanced settings
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

  // Trigger reflow for animation
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
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
