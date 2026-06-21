/* ============================================
   NOVA EDIT LITE — Video Editor
   Browser-based video editing with timeline
   ============================================ */

import { pickVideo } from './native-picker.js';
import { shareDataUrl, canShare } from './native-share.js';
import { haptic } from './haptics.js';

class VideoEditor {
  constructor() {
    this.video = null;
    this.src = null;
    this.duration = 0;
    this.isPlaying = false;
    this.isMuted = false;
    this.isReversed = false;

    // Trim
    this.trimStart = 0;
    this.trimEnd = 0; // set on load

    // Speed
    this.playbackSpeed = 1;

    // Effects
    this.currentFilter = 'none';
    this.currentTransition = 'none';

    // Overlays (text, stickers rendered on top of video)
    this.overlays = [];

    // Clips list (for multi-clip simulation)
    this.clips = [];
    this.activeClipIdx = 0;

    // Undo/redo
    this.history = [];
    this.historyIndex = -1;

    // Timeline zoom
    this.tlZoom = 1;

    // Project
    this.projectId = null;
    this.projectName = 'Untitled Video';

    this.init();
  }

  init() {
    this.video = document.getElementById('videoPlayer');
    if (!this.video) return;

    this.bindEvents();
    this.populateStickers();
    this.setupDragDrop();
  }

  /* ---- Bind Events ---- */
  bindEvents() {
    // Import — native video picker (ActionSheet) on Android, file input on browser
    const importBtn = document.getElementById('videoImportBtn');
    if (importBtn) importBtn.addEventListener('click', () => {
      haptic('light');
      pickVideo(file => this.loadFile(file));
    });

    // Video player events
    this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.video.addEventListener('ended', () => { haptic('warning'); this.onVideoEnded(); });

    // Playback controls
    document.getElementById('videoPlayBtn')?.addEventListener('click', () => { haptic('light'); this.togglePlay(); });
    document.getElementById('skipBackBtn')?.addEventListener('click', () => { haptic('light'); this.video.currentTime = Math.max(0, this.video.currentTime - 5); });
    document.getElementById('skipFwdBtn')?.addEventListener('click', () => { haptic('light'); this.video.currentTime = Math.min(this.duration, this.video.currentTime + 5); });
    document.getElementById('muteBtn')?.addEventListener('click', () => { haptic('light'); this.toggleMute(); });

    // Seek
    const seekSlider = document.getElementById('videoSeek');
    if (seekSlider) {
      seekSlider.addEventListener('input', e => {
        const t = (parseFloat(e.target.value) / 100) * this.duration;
        this.video.currentTime = t;
        this.updatePlayhead();
      });
    }

    // Volume
    const volSlider = document.getElementById('volumeSlider');
    if (volSlider) {
      volSlider.addEventListener('input', e => {
        this.video.volume = parseFloat(e.target.value);
        this.isMuted = this.video.volume === 0;
        this.updateMuteUI();
      });
    }

    // Speed select (top bar)
    document.getElementById('speedSelect')?.addEventListener('change', e => {
      this.setSpeed(parseFloat(e.target.value));
    });

    // Panel tabs
    document.querySelectorAll('#videoPanel .ptab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#videoPanel .ptab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#videoPanel .vtab-body').forEach(b => b.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`vtab-${tab.dataset.vtab}`)?.classList.add('active');
      });
    });

    // Trim
    const trimStart = document.getElementById('trimStart');
    const trimEnd = document.getElementById('trimEnd');
    if (trimStart) trimStart.addEventListener('input', e => {
      const val = parseFloat(e.target.value) / 100;
      this.trimStart = val * this.duration;
      document.getElementById('trimStartVal').textContent = `${this.trimStart.toFixed(1)}s`;
      if (this.video) this.video.currentTime = this.trimStart;
      this.updateTrimBar();
    });
    if (trimEnd) trimEnd.addEventListener('input', e => {
      const val = parseFloat(e.target.value) / 100;
      this.trimEnd = val * this.duration;
      document.getElementById('trimEndVal').textContent = `${this.trimEnd.toFixed(1)}s`;
      this.updateTrimBar();
    });
    document.getElementById('applyTrimBtn')?.addEventListener('click', () => this.applyTrim());
    document.getElementById('resetTrimBtn')?.addEventListener('click', () => this.resetTrim());

    // Speed chips
    document.querySelectorAll('.speed-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.speed-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.setSpeed(parseFloat(chip.dataset.speed));
        const sel = document.getElementById('speedSelect');
        if (sel) sel.value = chip.dataset.speed;
      });
    });

    // Volume panel
    const volPanel = document.getElementById('volumePanel');
    if (volPanel) volPanel.addEventListener('input', e => {
      const v = parseInt(e.target.value) / 100;
      this.video.volume = v;
      document.getElementById('volumeValDisplay').textContent = e.target.value;
      const volSlider = document.getElementById('volumeSlider');
      if (volSlider) volSlider.value = v;
    });

    // Mute check
    document.getElementById('muteCheck')?.addEventListener('change', e => {
      if (e.target.checked) this.video.volume = 0;
      else this.video.volume = parseInt(document.getElementById('volumePanel')?.value || 100) / 100;
      this.isMuted = e.target.checked;
      this.updateMuteUI();
    });

    // Reverse
    document.getElementById('reverseBtn')?.addEventListener('click', () => { haptic('medium'); this.toggleReverse(); });

    // Capture frame
    document.getElementById('videoCaptureBtn')?.addEventListener('click', () => { haptic('success'); this.captureFrame(); });
    document.getElementById('videoShareFrameBtn')?.addEventListener('click', () => { haptic('success'); this.shareFrame(); });

    // Save
    document.getElementById('videoSaveBtn')?.addEventListener('click', () => { haptic('medium'); this.saveProject(); });

    // Export
    document.getElementById('videoExportBtn')?.addEventListener('click', () => { haptic('medium'); this.exportProject(); });

    // Undo/Redo
    document.getElementById('videoUndoBtn')?.addEventListener('click', () => { haptic('light'); this.undo(); });
    document.getElementById('videoRedoBtn')?.addEventListener('click', () => { haptic('light'); this.redo(); });

    // Video filter
    document.querySelectorAll('.effect-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        haptic('selection');
        document.querySelectorAll('.effect-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.applyVideoFilter(chip.dataset.vfx);
      });
    });

    // Transitions
    document.querySelectorAll('.trans-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.trans-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentTransition = chip.dataset.trans;
        utils.showToast(`Transition: ${chip.dataset.trans}`, 'info');
      });
    });

    // Text overlay
    document.getElementById('addVideoTextBtn')?.addEventListener('click', () => this.addTextOverlay());

    // Add clip — native video picker on Android, file input on browser
    document.getElementById('addClipBtn')?.addEventListener('click', () => {
      pickVideo(file => this.addClip(file), 'addClipInput');
    });

    // Timeline zoom
    document.getElementById('tlZoomIn')?.addEventListener('click', () => {
      this.tlZoom = Math.min(5, this.tlZoom + 0.5);
      document.getElementById('tlZoom').textContent = `${this.tlZoom}x`;
      this.renderTimeline();
    });
    document.getElementById('tlZoomOut')?.addEventListener('click', () => {
      this.tlZoom = Math.max(0.5, this.tlZoom - 0.5);
      document.getElementById('tlZoom').textContent = `${this.tlZoom}x`;
      this.renderTimeline();
    });

    // Keyboard
    document.addEventListener('keydown', e => this.handleKey(e));
  }

  /* ---- File Loading ---- */
  loadFile(file) {
    const url = URL.createObjectURL(file);
    this.src = url;
    this.projectName = file.name.replace(/\.[^.]+$/, '');
    this.video.src = url;
    this.video.load();

    // Add to clips
    this.clips = [{ name: file.name, url, duration: 0 }];
    this.activeClipIdx = 0;

    this.showEditorUI();
    utils.showToast('Video loaded', 'success');
  }

  onVideoLoaded() {
    this.duration = this.video.duration;
    this.trimStart = 0;
    this.trimEnd = this.duration;

    // Update UI
    document.getElementById('vidTotalTime').textContent = utils.formatTime(this.duration);
    document.getElementById('trimStartVal').textContent = '0.0s';
    document.getElementById('trimEndVal').textContent = `${this.duration.toFixed(1)}s`;
    const trimEnd = document.getElementById('trimEnd');
    if (trimEnd) { trimEnd.value = 100; }

    // Update clips
    if (this.clips[0]) this.clips[0].duration = this.duration;
    this.renderClipsList();
    this.renderTimeline();
    this.updateTrimBar();

    // Show timeline
    document.getElementById('timelineWrap')?.classList.remove('hidden');

    this.pushHistory();
  }

  onTimeUpdate() {
    const t = this.video.currentTime;
    document.getElementById('vidCurrentTime').textContent = utils.formatTime(t);

    // Update seek slider
    const seek = document.getElementById('videoSeek');
    if (seek && this.duration > 0) seek.value = (t / this.duration) * 100;

    // Playhead
    this.updatePlayhead();

    // Handle trim end
    if (t >= this.trimEnd && this.isPlaying) {
      this.video.pause();
      this.video.currentTime = this.trimStart;
      this.isPlaying = false;
      this.updatePlayPauseUI();
    }

    // Reverse simulation: play backwards
    if (this.isReversed && this.isPlaying) {
      this.video.currentTime = Math.max(this.trimStart, this.video.currentTime - 0.1);
      if (this.video.currentTime <= this.trimStart) {
        this.video.currentTime = this.trimEnd;
      }
    }
  }

  onVideoEnded() {
    this.video.currentTime = this.trimStart;
    this.isPlaying = false;
    this.updatePlayPauseUI();
  }

  showEditorUI() {
    document.getElementById('videoDropZone').style.display = 'none';
    document.getElementById('videoWrap').classList.remove('hidden');
    this.projectId = this.projectId || window.storage.generateId();
    this._updateShareFrameBtn();
  }

  /* ---- Playback ---- */
  togglePlay() {
    if (!this.src) return;
    if (this.isReversed) {
      // Manual reverse simulation
      this.isPlaying = !this.isPlaying;
      if (this.isPlaying) this.startReversePlayback();
      this.updatePlayPauseUI();
      return;
    }
    if (this.video.paused) {
      if (this.video.currentTime >= this.trimEnd) this.video.currentTime = this.trimStart;
      this.video.play().catch(() => {});
      this.isPlaying = true;
    } else {
      this.video.pause();
      this.isPlaying = false;
    }
    this.updatePlayPauseUI();
  }

  startReversePlayback() {
    // Reverse is handled in onTimeUpdate
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.video.muted = this.isMuted;
    this.updateMuteUI();
  }

  updateMuteUI() {
    document.getElementById('volIcon')?.classList.toggle('hidden', this.isMuted);
    document.getElementById('muteIcon')?.classList.toggle('hidden', !this.isMuted);
    const mc = document.getElementById('muteCheck');
    if (mc) mc.checked = this.isMuted;
  }

  updatePlayPauseUI() {
    document.getElementById('playIcon')?.classList.toggle('hidden', this.isPlaying);
    document.getElementById('pauseIcon')?.classList.toggle('hidden', !this.isPlaying);
  }

  setSpeed(speed) {
    this.playbackSpeed = speed;
    this.video.playbackRate = speed;
    const sel = document.getElementById('speedSelect');
    if (sel) sel.value = String(speed);
  }

  /* ---- Trim ---- */
  applyTrim() {
    if (!this.src) return;
    this.video.currentTime = this.trimStart;
    this.pushHistory();
    utils.showToast(`Trim applied: ${this.trimStart.toFixed(1)}s → ${this.trimEnd.toFixed(1)}s`, 'success');
    this.renderTimeline();
  }

  resetTrim() {
    this.trimStart = 0;
    this.trimEnd = this.duration;
    const ts = document.getElementById('trimStart');
    const te = document.getElementById('trimEnd');
    if (ts) ts.value = 0;
    if (te) te.value = 100;
    document.getElementById('trimStartVal').textContent = '0.0s';
    document.getElementById('trimEndVal').textContent = `${this.duration.toFixed(1)}s`;
    this.updateTrimBar();
    utils.showToast('Trim reset', 'info');
  }

  updateTrimBar() {
    const fill = document.getElementById('trimBarFill');
    if (!fill || !this.duration) return;
    const startPct = (this.trimStart / this.duration) * 100;
    const endPct = (this.trimEnd / this.duration) * 100;
    fill.style.marginLeft = `${startPct}%`;
    fill.style.width = `${endPct - startPct}%`;
  }

  /* ---- Reverse ---- */
  toggleReverse() {
    this.isReversed = !this.isReversed;
    if (this.isReversed) {
      this.video.currentTime = this.trimEnd;
    }
    utils.showToast(this.isReversed ? 'Reverse mode on' : 'Reverse mode off', 'info');
  }

  /* ---- Video Filter ---- */
  applyVideoFilter(fx) {
    this.currentFilter = fx;
    const filterCSS = utils.getVideoFilterCSS(fx);
    this.video.style.filter = filterCSS;
    utils.showToast(`Filter: ${fx === 'none' ? 'None' : fx}`, 'info');
  }

  /* ---- Text Overlay ---- */
  addTextOverlay() {
    const text = document.getElementById('videoTextInput')?.value || '';
    if (!text.trim()) { utils.showToast('Enter text first', 'warning'); return; }
    const color = document.getElementById('videoTextColor')?.value || '#ffffff';
    const size = parseInt(document.getElementById('videoTextSize')?.value || 28);
    const hasBg = document.getElementById('videoTextBg')?.checked || false;

    const overlay = { id: utils.uuid(), type: 'text', text, color, size, hasBg, x: 50, y: 80 };
    this.overlays.push(overlay);
    this.renderOverlay(overlay);
    this.renderOverlaysList();
    this.pushHistory();
    utils.showToast('Text overlay added', 'success');
    document.getElementById('videoTextInput').value = '';
  }

  renderOverlay(overlay) {
    const container = document.getElementById('videoOverlaysContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'video-overlay-item';
    el.id = `overlay-${overlay.id}`;
    el.style.cssText = `
      left: ${overlay.x}%; top: ${overlay.y}%;
      transform: translate(-50%, -50%);
      font-size: ${overlay.size}px;
      color: ${overlay.color};
      font-weight: 700;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      font-family: Inter, sans-serif;
      ${overlay.hasBg ? `background: rgba(0,0,0,0.55); padding: 4px 10px; border-radius: 6px;` : ''}
      cursor: move; user-select: none;
    `;
    el.textContent = overlay.type === 'sticker' ? overlay.emoji : overlay.text;

    // Make draggable
    this.makeDraggable(el, overlay, container);
    container.appendChild(el);
  }

  makeDraggable(el, overlay, container) {
    let startX, startY, startLeft, startTop;
    const onStart = e => {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX; startY = t.clientY;
      startLeft = parseFloat(el.style.left) || 50;
      startTop = parseFloat(el.style.top) || 50;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
    };
    const onMove = e => {
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      const rect = container.getBoundingClientRect();
      const dx = ((t.clientX - startX) / rect.width) * 100;
      const dy = ((t.clientY - startY) / rect.height) * 100;
      overlay.x = utils.clamp(startLeft + dx, 0, 100);
      overlay.y = utils.clamp(startTop + dy, 0, 100);
      el.style.left = `${overlay.x}%`;
      el.style.top = `${overlay.y}%`;
    };
    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    el.addEventListener('mousedown', onStart);
    el.addEventListener('touchstart', onStart, { passive: true });
  }

  renderOverlaysList() {
    const list = document.getElementById('activeOverlaysList');
    if (!list) return;
    if (this.overlays.length === 0) {
      list.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">None added</p>';
      return;
    }
    list.innerHTML = this.overlays.map(ov => `
      <div class="overlay-item">
        <span class="overlay-item-name">${ov.type === 'sticker' ? ov.emoji : ov.text}</span>
        <button class="overlay-remove" data-id="${ov.id}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.overlay-remove').forEach(btn => {
      btn.addEventListener('click', () => this.removeOverlay(btn.dataset.id));
    });
  }

  removeOverlay(id) {
    this.overlays = this.overlays.filter(ov => ov.id !== id);
    document.getElementById(`overlay-${id}`)?.remove();
    this.renderOverlaysList();
    this.pushHistory();
  }

  /* ---- Capture Frame ---- */
  captureFrame() {
    if (!this.src) { utils.showToast('No video loaded', 'warning'); return; }
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = this.video.videoWidth;
    tmpCanvas.height = this.video.videoHeight;
    tmpCanvas.getContext('2d').drawImage(this.video, 0, 0);
    const dataURL = tmpCanvas.toDataURL('image/png');
    utils.downloadFile(dataURL, `frame_${utils.formatTime(this.video.currentTime).replace(':', '_')}.png`);
    utils.showToast('Frame captured', 'success');
  }

  /* ---- Share Frame (native share sheet on Android, download fallback on web) ---- */
  async shareFrame() {
    if (!this.src) { utils.showToast('No video loaded', 'warning'); return; }
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = this.video.videoWidth;
    tmpCanvas.height = this.video.videoHeight;
    tmpCanvas.getContext('2d').drawImage(this.video, 0, 0);
    const dataURL  = tmpCanvas.toDataURL('image/png');
    const ts       = utils.formatTime(this.video.currentTime).replace(':', '_');
    const filename = `frame_${ts}.png`;
    utils.showToast('Opening share sheet…', 'info');
    const shared = await shareDataUrl(dataURL, filename, `Nova Edit — ${this.projectName || 'frame'}`);
    if (!shared) {
      utils.downloadFile(dataURL, filename);
      utils.showToast('Frame saved', 'success');
    }
  }

  /* ---- Show/hide Share Frame button based on platform capability ---- */
  _updateShareFrameBtn() {
    const btn = document.getElementById('videoShareFrameBtn');
    if (btn) btn.style.display = canShare() ? '' : 'none';
  }

  /* ---- Multi-Clip ---- */
  addClip(file) {
    const url = URL.createObjectURL(file);
    this.clips.push({ name: file.name, url, duration: 0 });
    this.renderClipsList();
    utils.showToast(`Clip added: ${file.name}`, 'success');
  }

  renderClipsList() {
    const list = document.getElementById('clipsList');
    if (!list) return;
    if (this.clips.length === 0) {
      list.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Import a video to see clips</p>';
      return;
    }
    list.innerHTML = this.clips.map((clip, i) => `
      <div class="overlay-item ${i === this.activeClipIdx ? 'active' : ''}" style="cursor:pointer" data-clip="${i}">
        <span class="overlay-item-name">${clip.name}</span>
        <button class="overlay-remove" data-del="${i}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-clip]').forEach(el => {
      el.addEventListener('click', () => this.switchClip(parseInt(el.dataset.clip)));
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.deleteClip(parseInt(btn.dataset.del)); });
    });
  }

  switchClip(idx) {
    if (idx < 0 || idx >= this.clips.length) return;
    this.activeClipIdx = idx;
    const clip = this.clips[idx];
    this.video.src = clip.url;
    this.video.load();
    this.renderClipsList();
  }

  deleteClip(idx) {
    this.clips.splice(idx, 1);
    if (this.activeClipIdx >= this.clips.length) this.activeClipIdx = Math.max(0, this.clips.length - 1);
    if (this.clips.length > 0) this.switchClip(this.activeClipIdx);
    this.renderClipsList();
  }

  /* ---- Timeline ---- */
  renderTimeline() {
    const ruler = document.getElementById('tlRuler');
    const videoTrack = document.getElementById('videoTrack');
    if (!ruler || !videoTrack || !this.duration) return;

    const totalWidth = 500 * this.tlZoom;
    const secondWidth = totalWidth / this.duration;

    // Ruler ticks
    ruler.innerHTML = '';
    ruler.style.width = `${totalWidth}px`;
    const step = Math.max(1, Math.round(this.duration / (10 * this.tlZoom)));
    for (let t = 0; t <= this.duration; t += step) {
      const tick = document.createElement('span');
      tick.style.cssText = `position:absolute; left:${(t / this.duration) * totalWidth}px; font-size:9px; color:var(--text-muted);`;
      tick.textContent = utils.formatTime(t);
      ruler.appendChild(tick);
    }

    // Video clip block
    videoTrack.style.width = `${totalWidth}px`;
    const startLeft = (this.trimStart / this.duration) * totalWidth;
    const clipW = ((this.trimEnd - this.trimStart) / this.duration) * totalWidth;
    videoTrack.innerHTML = `
      <div class="tl-clip" style="left:${startLeft}px; width:${clipW}px">
        ${this.projectName}
      </div>
    `;
  }

  updatePlayhead() {
    const ph = document.getElementById('tlPlayhead');
    if (!ph || !this.duration) return;
    const totalWidth = 500 * this.tlZoom;
    ph.style.left = `${(this.video.currentTime / this.duration) * totalWidth + 40}px`;
  }

  /* ---- Sticker Overlay ---- */
  populateStickers() {
    const grid = document.getElementById('videoStickerPicker');
    if (!grid) return;
    utils.STICKERS.forEach(s => {
      const item = document.createElement('button');
      item.className = 'sticker-item';
      item.textContent = s;
      item.addEventListener('click', () => {
        const overlay = { id: utils.uuid(), type: 'sticker', emoji: s, x: 50, y: 50 };
        this.overlays.push(overlay);
        this.renderOverlay(overlay);
        this.renderOverlaysList();
        utils.showToast('Sticker added', 'success');
      });
      grid.appendChild(item);
    });
  }

  /* ---- Drag & Drop ---- */
  setupDragDrop() {
    const dz = document.getElementById('videoDropZone');
    const area = document.querySelector('.video-preview-wrap');
    if (!area || !dz) return;

    ['dragenter', 'dragover'].forEach(ev => area.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(ev => area.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag-over'); }));
    area.addEventListener('drop', e => {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) this.loadFile(file);
    });
  }

  /* ---- History ---- */
  pushHistory() {
    const snap = {
      trimStart: this.trimStart, trimEnd: this.trimEnd,
      playbackSpeed: this.playbackSpeed, currentFilter: this.currentFilter,
      overlays: JSON.parse(JSON.stringify(this.overlays)),
    };
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap);
    if (this.history.length > 20) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.updateUndoRedoBtns();
  }

  undo() {
    if (this.historyIndex <= 0) { utils.showToast('Nothing to undo', 'info'); return; }
    this.historyIndex--;
    this.restoreSnapshot(this.history[this.historyIndex]);
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) { utils.showToast('Nothing to redo', 'info'); return; }
    this.historyIndex++;
    this.restoreSnapshot(this.history[this.historyIndex]);
  }

  restoreSnapshot(snap) {
    this.trimStart = snap.trimStart;
    this.trimEnd = snap.trimEnd;
    this.playbackSpeed = snap.playbackSpeed;
    this.video.playbackRate = snap.playbackSpeed;
    this.applyVideoFilter(snap.currentFilter);

    // Restore overlays
    const container = document.getElementById('videoOverlaysContainer');
    if (container) container.innerHTML = '';
    this.overlays = snap.overlays;
    this.overlays.forEach(ov => this.renderOverlay(ov));
    this.renderOverlaysList();

    document.getElementById('trimStart').value = (this.trimStart / this.duration) * 100;
    document.getElementById('trimEnd').value = (this.trimEnd / this.duration) * 100;
    document.getElementById('trimStartVal').textContent = `${this.trimStart.toFixed(1)}s`;
    document.getElementById('trimEndVal').textContent = `${this.trimEnd.toFixed(1)}s`;
    this.updateTrimBar();
    this.updateUndoRedoBtns();
  }

  updateUndoRedoBtns() {
    const undo = document.getElementById('videoUndoBtn');
    const redo = document.getElementById('videoRedoBtn');
    if (undo) undo.style.opacity = this.historyIndex <= 0 ? '0.4' : '1';
    if (redo) redo.style.opacity = this.historyIndex >= this.history.length - 1 ? '0.4' : '1';
  }

  /* ---- Save / Export ---- */
  async saveProject() {
    if (!this.src) { utils.showToast('Nothing to save', 'warning'); return; }

    // Capture a frame for thumbnail
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = 200; tmpCanvas.height = 120;
    tmpCanvas.getContext('2d').drawImage(this.video, 0, 0, 200, 120);
    const thumb = tmpCanvas.toDataURL('image/jpeg', 0.6);

    const project = {
      id: this.projectId || window.storage.generateId(),
      name: this.projectName,
      type: 'video',
      thumb,
      settings: {
        trimStart: this.trimStart, trimEnd: this.trimEnd,
        playbackSpeed: this.playbackSpeed, filter: this.currentFilter,
        overlays: this.overlays,
      },
    };
    this.projectId = project.id;
    await window.storage.saveProject(project);
    utils.showToast('Project saved', 'success');
    if (window.app) window.app.refreshProjects();
  }

  exportProject() {
    if (!this.src) { utils.showToast('No video to export', 'warning'); return; }
    // For browser-only export, download the project JSON + instructions
    const data = {
      name: this.projectName,
      settings: {
        trimStart: this.trimStart, trimEnd: this.trimEnd,
        speed: this.playbackSpeed, filter: this.currentFilter,
        overlays: this.overlays,
        transition: this.currentTransition,
      },
      note: 'Nova Edit Lite project data. Apply these settings in your preferred video editor for final export.',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    utils.downloadFile(url, `${this.projectName}-nova-edit.json`);
    URL.revokeObjectURL(url);
    utils.showToast('Project data exported as JSON', 'success');
  }

  /* ---- Keyboard ---- */
  handleKey(e) {
    if (!document.getElementById('screen-video')?.classList.contains('active')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); this.togglePlay(); }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); this.undo(); }
      if (e.key === 'y') { e.preventDefault(); this.redo(); }
      if (e.key === 's') { e.preventDefault(); this.saveProject(); }
    }
  }
}

window.videoEditor = new VideoEditor();
