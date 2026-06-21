/* ============================================
   NOVA EDIT LITE — Photo Editor
   Canvas-based photo editing with full feature set
   ============================================ */

import { pickPhoto } from './native-picker.js';
import { shareDataUrl, canShare } from './native-share.js';
import { haptic } from './haptics.js';

class PhotoEditor {
  constructor() {
    // Canvas elements
    this.canvas = null;
    this.ctx = null;
    this.drawCanvas = null;
    this.drawCtx = null;

    // Image state
    this.originalImage = null;   // Original HTMLImageElement
    this.baseImageData = null;   // ImageData after filters/adjustments
    this.currentTool = 'select';

    // Adjustments
    this.adjustments = {
      brightness: 0, contrast: 0, saturation: 0,
      hue: 0, blur: 0, sharpen: 0, vignette: 0, temperature: 0,
    };

    // Filter
    this.currentFilter = 'none';

    // Rotation & flip
    this.rotation = 0;     // degrees: 0,90,180,270
    this.flipH = false;
    this.flipV = false;

    // Overlay
    this.overlayColor = '#a78bfa';
    this.overlayOpacity = 0;
    this.blendMode = 'normal';

    // Undo/redo stack (stores canvas snapshots as ImageData or DataURL)
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 20;

    // Drawing state
    this.isDrawing = false;
    this.drawColor = '#a78bfa';
    this.drawSize = 8;
    this.drawOpacity = 1;
    this.isEraser = false;
    this.eraserSize = 20;
    this.lastDrawX = 0;
    this.lastDrawY = 0;

    // Text
    this.textInput = '';
    this.textColor = '#ffffff';
    this.textSize = 28;
    this.textFont = 'Inter';
    this.textBold = false;

    // Shapes
    this.selectedShape = 'rect';
    this.shapeColor = '#a78bfa';
    this.shapeSize = 3;
    this.shapeFill = false;
    this.isDrawingShape = false;
    this.shapeStart = null;

    // Sticker
    this.selectedSticker = '😊';
    this.stickerSize = 56;

    // Resize
    this.resizeAspectLock = true;
    this.originalAspect = 1;

    // Crop
    this.cropRatio = 'free';
    this.isCropping = false;
    this.cropRect = { x: 0, y: 0, w: 100, h: 100 };

    // Zoom
    this.zoom = 1;

    // Grid
    this.showGrid = false;

    // Current project metadata
    this.projectId = null;
    this.projectName = 'Untitled Photo';

    // Download format
    this.dlFormat = 'png';
    this.dlQuality = 0.9;

    this.init();
  }

  init() {
    this.canvas = document.getElementById('photoCanvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.drawCanvas = document.getElementById('drawCanvas');
    this.drawCtx = this.drawCanvas.getContext('2d');

    this.bindEvents();
    this.populateStickers();
    this.setupDragDrop();
  }

  /* ---- Bind UI Events ---- */
  bindEvents() {
    // Import — native Camera/Gallery picker on Android, file input on browser
    const importBtn = document.getElementById('photoImportBtn');
    if (importBtn) importBtn.addEventListener('click', () => {
      haptic('light');
      pickPhoto((dataUrl, name) => this.loadFromDataUrl(dataUrl, name));
    });

    // Undo/Redo
    document.getElementById('photoUndoBtn')?.addEventListener('click', () => { haptic('light'); this.undo(); });
    document.getElementById('photoRedoBtn')?.addEventListener('click', () => { haptic('light'); this.redo(); });

    // Save / Download
    document.getElementById('photoSaveBtn')?.addEventListener('click', () => { haptic('medium'); this.saveProject(); });
    document.getElementById('photoDownloadBtn')?.addEventListener('click', () => { haptic('medium'); this.openDownloadModal(); });
    document.getElementById('confirmDl')?.addEventListener('click', () => { haptic('success'); this.download(); });
    document.getElementById('shareDl')?.addEventListener('click', () => { haptic('success'); this.shareImage(); });
    document.getElementById('cancelDl')?.addEventListener('click', () => { haptic('light'); this.closeDownloadModal(); });

    // Panel tabs
    document.querySelectorAll('#photoPanel .ptab').forEach(tab => {
      tab.addEventListener('click', () => {
        haptic('light');
        document.querySelectorAll('#photoPanel .ptab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#photoPanel .ptab-body').forEach(b => b.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`ptab-${tab.dataset.ptab}`)?.classList.add('active');
      });
    });

    // Tool selection
    document.querySelectorAll('.tool-cell').forEach(btn => {
      btn.addEventListener('click', () => { haptic('medium'); this.selectTool(btn.dataset.tool); });
    });

    // Adjustments
    document.querySelectorAll('.adj-sl').forEach(slider => {
      slider.addEventListener('input', () => {
        const key = slider.id.replace('adj-', '');
        this.adjustments[key] = parseFloat(slider.value);
        const display = document.getElementById(`v-${key}`);
        if (display) display.textContent = slider.value;
        this.applyAll();
      });
    });

    // Reset individual adjustment
    document.querySelectorAll('.adj-rst').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.reset;
        this.adjustments[key] = 0;
        const slider = document.getElementById(`adj-${key}`);
        const display = document.getElementById(`v-${key}`);
        if (slider) slider.value = 0;
        if (display) display.textContent = '0';
        this.applyAll();
      });
    });

    // Reset all adjustments
    document.getElementById('resetAllAdjBtn')?.addEventListener('click', () => this.resetAllAdjustments());

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        haptic('selection');
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.applyAll();
      });
    });

    // Draw options
    const drawColor = document.getElementById('drawColor');
    const drawSize = document.getElementById('drawSize');
    const drawOpacity = document.getElementById('drawOpacity');
    if (drawColor) drawColor.addEventListener('input', e => { this.drawColor = e.target.value; });
    if (drawSize) drawSize.addEventListener('input', e => {
      this.drawSize = parseInt(e.target.value);
      document.getElementById('drawSizeVal').textContent = e.target.value;
    });
    if (drawOpacity) drawOpacity.addEventListener('input', e => {
      this.drawOpacity = parseInt(e.target.value) / 100;
      document.getElementById('drawOpacityVal').textContent = e.target.value;
    });

    // Eraser
    const eraserSize = document.getElementById('eraserSize');
    if (eraserSize) eraserSize.addEventListener('input', e => {
      this.eraserSize = parseInt(e.target.value);
      document.getElementById('eraserSizeVal').textContent = e.target.value;
    });

    // Text options
    document.getElementById('textInput')?.addEventListener('input', e => { this.textInput = e.target.value; });
    document.getElementById('textColor')?.addEventListener('input', e => { this.textColor = e.target.value; });
    document.getElementById('textSize')?.addEventListener('input', e => {
      this.textSize = parseInt(e.target.value);
      document.getElementById('textSizeVal').textContent = e.target.value;
    });
    document.getElementById('textFont')?.addEventListener('change', e => { this.textFont = e.target.value; });
    document.getElementById('textBold')?.addEventListener('change', e => { this.textBold = e.target.checked; });
    document.getElementById('addTextBtn')?.addEventListener('click', () => { haptic('medium'); this.addTextAtCenter(); });

    // Shape options
    document.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        haptic('selection');
        document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedShape = btn.dataset.shape;
      });
    });
    document.getElementById('shapeColor')?.addEventListener('input', e => { this.shapeColor = e.target.value; });
    document.getElementById('shapeSize')?.addEventListener('input', e => {
      this.shapeSize = parseInt(e.target.value);
      document.getElementById('shapeSizeVal').textContent = e.target.value;
    });
    document.getElementById('shapeFill')?.addEventListener('change', e => { this.shapeFill = e.target.checked; });

    // Resize
    document.getElementById('resizeWidth')?.addEventListener('input', e => {
      if (this.resizeAspectLock && this.originalAspect) {
        const h = Math.round(parseInt(e.target.value) / this.originalAspect);
        const rhEl = document.getElementById('resizeHeight');
        if (rhEl) rhEl.value = h;
      }
    });
    document.getElementById('resizeLock')?.addEventListener('change', e => { this.resizeAspectLock = e.target.checked; });
    document.getElementById('applyResizeBtn')?.addEventListener('click', () => this.applyResize());

    // Crop
    document.querySelectorAll('.ratio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cropRatio = btn.dataset.ratio;
        this.updateCropBox();
      });
    });
    document.getElementById('applyCropBtn')?.addEventListener('click', () => this.applyCrop());
    document.getElementById('cancelCropBtn')?.addEventListener('click', () => this.cancelCrop());

    // Transform
    document.getElementById('rotateLeftBtn')?.addEventListener('click', () => this.rotate(-90));
    document.getElementById('rotateRightBtn')?.addEventListener('click', () => this.rotate(90));
    document.getElementById('flipHBtn')?.addEventListener('click', () => { this.flipH = !this.flipH; this.applyAll(); this.pushHistory(); });
    document.getElementById('flipVBtn')?.addEventListener('click', () => { this.flipV = !this.flipV; this.applyAll(); this.pushHistory(); });

    // Overlay
    document.getElementById('overlayColor')?.addEventListener('input', e => { this.overlayColor = e.target.value; });
    document.getElementById('overlayOpacity')?.addEventListener('input', e => {
      this.overlayOpacity = parseInt(e.target.value);
      document.getElementById('overlayOpacityVal').textContent = e.target.value;
    });
    document.getElementById('blendMode')?.addEventListener('change', e => { this.blendMode = e.target.value; });
    document.getElementById('applyOverlayBtn')?.addEventListener('click', () => { this.applyAll(); this.pushHistory(); });

    // Zoom
    document.getElementById('photoZoomIn')?.addEventListener('click', () => this.changeZoom(0.2));
    document.getElementById('photoZoomOut')?.addEventListener('click', () => this.changeZoom(-0.2));
    document.getElementById('photoFit')?.addEventListener('click', () => this.fitToScreen());

    // Download format
    document.querySelectorAll('.fmt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.dlFormat = btn.dataset.fmt;
        const qg = document.getElementById('qualityGroup');
        if (qg) qg.style.display = btn.dataset.fmt === 'png' ? 'none' : 'block';
      });
    });
    document.getElementById('qualitySlider')?.addEventListener('input', e => {
      this.dlQuality = parseInt(e.target.value) / 100;
      document.getElementById('qualityVal').textContent = e.target.value;
    });

    // Drawing events on drawCanvas
    this.drawCanvas.addEventListener('mousedown', e => this.onDrawStart(e));
    this.drawCanvas.addEventListener('mousemove', e => this.onDrawMove(e));
    this.drawCanvas.addEventListener('mouseup', e => this.onDrawEnd(e));
    this.drawCanvas.addEventListener('mouseleave', e => this.onDrawEnd(e));

    // Touch events
    this.drawCanvas.addEventListener('touchstart', e => { e.preventDefault(); this.onDrawStart(e); }, { passive: false });
    this.drawCanvas.addEventListener('touchmove', e => { e.preventDefault(); this.onDrawMove(e); }, { passive: false });
    this.drawCanvas.addEventListener('touchend', e => { e.preventDefault(); this.onDrawEnd(e); }, { passive: false });

    // Keyboard shortcuts (delegated from app.js)
    document.addEventListener('keydown', e => this.handleKey(e));

    // Sticker size
    document.getElementById('stickerSize')?.addEventListener('input', e => {
      this.stickerSize = parseInt(e.target.value);
      document.getElementById('stickerSizeVal').textContent = e.target.value;
    });
  }

  /* ---- Tool Selection ---- */
  selectTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-cell').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });

    // Show/hide tool options
    const allOpts = ['draw','eraser','text','shapes','sticker','resize','crop'];
    allOpts.forEach(t => {
      const el = document.getElementById(`toolOptions${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (el) el.classList.toggle('hidden', tool !== t);
    });

    // Set draw canvas cursor/pointer events
    const isDrawingTool = ['draw','eraser','text','shapes','sticker','crop'].includes(tool);
    this.drawCanvas.style.pointerEvents = isDrawingTool ? 'all' : 'none';
    this.drawCanvas.style.cursor = {
      draw: 'crosshair', eraser: 'cell', text: 'text',
      shapes: 'crosshair', sticker: 'pointer', crop: 'crosshair', select: 'default',
    }[tool] || 'default';

    // Show crop overlay
    const cropOverlay = document.getElementById('cropOverlay');
    if (cropOverlay) {
      cropOverlay.classList.toggle('hidden', tool !== 'crop');
      if (tool === 'crop') this.initCropBox();
    }

    // Fill resize dimensions
    if (tool === 'resize' && this.canvas.width) {
      const rw = document.getElementById('resizeWidth');
      const rh = document.getElementById('resizeHeight');
      if (rw) rw.value = this.canvas.width;
      if (rh) rh.value = this.canvas.height;
      this.originalAspect = this.canvas.width / this.canvas.height;
    }
  }

  /* ---- File Loading ---- */
  loadFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      this.originalImage = img;
      this.rotation = 0;
      this.flipH = false;
      this.flipV = false;
      this.resetAllAdjustmentsState();
      this.currentFilter = 'none';
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-filter="none"]')?.classList.add('active');

      this.setupCanvas(img.width, img.height);
      this.applyAll();
      this.pushHistory();

      this.projectId = this.projectId || window.storage.generateId();
      this.projectName = file.name.replace(/\.[^.]+$/, '');

      this.showEditorUI();
      URL.revokeObjectURL(url);
      utils.showToast('Image loaded successfully', 'success');
    };
    img.onerror = () => {
      utils.showToast('Failed to load image', 'error');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  /* ---- Load from DataURL (native Camera result) ---- */
  loadFromDataUrl(dataUrl, name = 'photo') {
    const img = new Image();
    img.onload = () => {
      this.originalImage = img;
      this.rotation = 0;
      this.flipH = false;
      this.flipV = false;
      this.resetAllAdjustmentsState();
      this.currentFilter = 'none';
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-filter="none"]')?.classList.add('active');

      this.setupCanvas(img.width, img.height);
      this.applyAll();
      this.pushHistory();

      this.projectId = this.projectId || window.storage.generateId();
      this.projectName = name.replace(/\.[^.]+$/, '') || 'photo';

      this.showEditorUI();
      utils.showToast('Image loaded successfully', 'success');
    };
    img.onerror = () => utils.showToast('Failed to load image', 'error');
    img.src = dataUrl;
  }

  setupCanvas(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.drawCanvas.width = w;
    this.drawCanvas.height = h;
    this.fitToScreen();
  }

  showEditorUI() {
    document.getElementById('photoDropZone').style.display = 'none';
    document.getElementById('photoCanvasContainer').classList.remove('hidden');
    document.getElementById('photoControls').classList.remove('hidden');
  }

  /* ---- Drag & Drop ---- */
  setupDragDrop() {
    const dz = document.getElementById('photoDropZone');
    const area = document.getElementById('photoCanvasArea');

    ['dragenter', 'dragover'].forEach(ev => {
      area.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(ev => {
      area.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag-over'); });
    });
    area.addEventListener('drop', e => {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this.loadFile(file);
    });
  }

  /* ---- Canvas Rendering ---- */
  applyAll() {
    if (!this.originalImage) return;

    const img = this.originalImage;
    const { brightness, contrast, saturation, hue, blur, sharpen, vignette, temperature } = this.adjustments;

    // Build CSS filter string
    let cssFilter = '';
    if (blur > 0) cssFilter += `blur(${blur * 0.3}px) `;
    if (brightness !== 0) cssFilter += `brightness(${1 + brightness / 100}) `;
    if (contrast !== 0) cssFilter += `contrast(${1 + contrast / 100}) `;
    if (saturation !== 0) cssFilter += `saturate(${1 + saturation / 100}) `;
    if (hue !== 0) cssFilter += `hue-rotate(${hue}deg) `;
    if (temperature !== 0) cssFilter += `hue-rotate(${temperature < 0 ? temperature * 0.3 : 0}deg) `;

    // Add preset filter
    const filterMap = {
      grayscale: 'grayscale(100%)',
      sepia: 'sepia(80%)',
      vintage: 'sepia(40%) contrast(0.9) brightness(0.85) saturate(1.3)',
      vivid: 'saturate(200%) contrast(1.1) brightness(1.05)',
      cool: 'hue-rotate(200deg) saturate(1.3) brightness(1.05)',
      warm: 'hue-rotate(-30deg) saturate(1.5) brightness(1.08)',
      invert: 'invert(100%)',
      chrome: 'saturate(0%) contrast(1.1) brightness(1.05)',
      fade: 'contrast(0.85) saturate(0.7) brightness(1.05)',
    };
    if (filterMap[this.currentFilter]) cssFilter += filterMap[this.currentFilter];

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Rotation & flip
    ctx.translate(w / 2, h / 2);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.scale(this.flipH ? -1 : 1, this.flipV ? -1 : 1);

    // Apply CSS filters via filter property
    if (cssFilter.trim()) ctx.filter = cssFilter.trim();

    // Draw image
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
    ctx.filter = 'none';
    ctx.restore();

    // Cartoon / Sketch filters (pixel-level, applied after draw)
    if (this.currentFilter === 'cartoon') utils.applyCartoon(ctx, w, h);
    if (this.currentFilter === 'sketch') utils.applySketch(ctx, w, h);

    // Sharpen
    if (sharpen > 0) utils.applySharpen(ctx, w, h, sharpen * 0.6);

    // Vignette
    if (vignette > 0) utils.applyVignette(ctx, w, h, vignette);

    // Color overlay
    if (this.overlayOpacity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = this.blendMode;
      ctx.globalAlpha = this.overlayOpacity / 100;
      ctx.fillStyle = this.overlayColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    // Grid overlay
    if (this.showGrid) this.drawGrid(ctx, w, h);

    // Merge draw canvas onto photo canvas (for display purposes, actual merge on save)
    // Drawing is on a separate transparent canvas, displayed on top
  }

  drawGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += w / 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += h / 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.restore();
  }

  /* ---- Transformations ---- */
  rotate(deg) {
    if (!this.originalImage) return;
    this.rotation = ((this.rotation + deg) % 360 + 360) % 360;

    // Swap canvas dimensions for 90/270
    if (Math.abs(deg) === 90) {
      const tmp = this.canvas.width;
      this.canvas.width = this.canvas.height;
      this.canvas.height = tmp;
      this.drawCanvas.width = this.canvas.width;
      this.drawCanvas.height = this.canvas.height;
    }

    this.applyAll();
    this.pushHistory();
    utils.showToast(`Rotated ${deg > 0 ? '→' : '←'} 90°`, 'info');
  }

  /* ---- Drawing Tool ---- */
  onDrawStart(e) {
    if (!this.originalImage) return;
    const pos = this.getCanvasPos(e);
    if (!pos) return;

    if (this.currentTool === 'text') {
      this.addTextAt(pos.x, pos.y);
      return;
    }
    if (this.currentTool === 'sticker') {
      this.addStickerAt(pos.x, pos.y);
      return;
    }
    if (this.currentTool === 'shapes') {
      this.isDrawingShape = true;
      this.shapeStart = pos;
      return;
    }
    if (this.currentTool !== 'draw' && this.currentTool !== 'eraser') return;

    this.isDrawing = true;
    this.lastDrawX = pos.x;
    this.lastDrawY = pos.y;

    this.drawCtx.beginPath();
    this.drawCtx.moveTo(pos.x, pos.y);

    if (this.currentTool === 'eraser') {
      this.drawCtx.globalCompositeOperation = 'destination-out';
    } else {
      this.drawCtx.globalCompositeOperation = 'source-over';
      this.drawCtx.strokeStyle = this.drawColor;
      this.drawCtx.lineWidth = this.drawSize;
      this.drawCtx.lineCap = 'round';
      this.drawCtx.lineJoin = 'round';
      this.drawCtx.globalAlpha = this.drawOpacity;
    }
  }

  onDrawMove(e) {
    if (!this.originalImage) return;
    const pos = this.getCanvasPos(e);
    if (!pos) return;

    if (this.currentTool === 'shapes' && this.isDrawingShape && this.shapeStart) {
      this.previewShape(pos);
      return;
    }
    if (!this.isDrawing) return;

    if (this.currentTool === 'eraser') {
      this.drawCtx.globalCompositeOperation = 'destination-out';
      this.drawCtx.beginPath();
      this.drawCtx.arc(pos.x, pos.y, this.eraserSize / 2, 0, Math.PI * 2);
      this.drawCtx.fill();
    } else {
      this.drawCtx.lineTo(pos.x, pos.y);
      this.drawCtx.stroke();
    }

    this.lastDrawX = pos.x;
    this.lastDrawY = pos.y;
  }

  onDrawEnd(e) {
    if (this.currentTool === 'shapes' && this.isDrawingShape) {
      const pos = this.getCanvasPos(e) || this.lastPos;
      if (pos && this.shapeStart) this.finalizeShape(pos);
      this.isDrawingShape = false;
      this.shapeStart = null;
      this.mergeDraw();
      return;
    }
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.drawCtx.globalAlpha = 1;
    this.drawCtx.globalCompositeOperation = 'source-over';
    this.mergeDraw();
  }

  previewShape(pos) {
    // Redraw base without old preview
    this.applyAll();
    const ctx = this.ctx;
    const { x: sx, y: sy } = this.shapeStart;
    ctx.save();
    ctx.strokeStyle = this.shapeColor;
    ctx.fillStyle = this.shapeColor;
    ctx.lineWidth = this.shapeSize;
    ctx.globalCompositeOperation = 'source-over';
    this.drawShapeOnCtx(ctx, sx, sy, pos.x, pos.y);
    ctx.restore();
  }

  finalizeShape(pos) {
    const ctx = this.ctx;
    const { x: sx, y: sy } = this.shapeStart;
    ctx.save();
    ctx.strokeStyle = this.shapeColor;
    ctx.fillStyle = this.shapeColor;
    ctx.lineWidth = this.shapeSize;
    this.drawShapeOnCtx(ctx, sx, sy, pos.x, pos.y);
    ctx.restore();
    this.pushHistory();
  }

  drawShapeOnCtx(ctx, sx, sy, ex, ey) {
    ctx.beginPath();
    switch (this.selectedShape) {
      case 'rect':
        if (this.shapeFill) ctx.fillRect(sx, sy, ex - sx, ey - sy);
        else ctx.strokeRect(sx, sy, ex - sx, ey - sy);
        break;
      case 'circle': {
        const rx = (ex - sx) / 2, ry = (ey - sy) / 2;
        ctx.ellipse(sx + rx, sy + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        if (this.shapeFill) ctx.fill(); else ctx.stroke();
        break;
      }
      case 'line':
        ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        break;
      case 'arrow': {
        const headlen = 15;
        const angle = Math.atan2(ey - sy, ex - sx);
        ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headlen * Math.cos(angle - 0.4), ey - headlen * Math.sin(angle - 0.4));
        ctx.lineTo(ex - headlen * Math.cos(angle + 0.4), ey - headlen * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'triangle':
        ctx.moveTo(sx + (ex - sx) / 2, sy);
        ctx.lineTo(ex, ey); ctx.lineTo(sx, ey); ctx.closePath();
        if (this.shapeFill) ctx.fill(); else ctx.stroke();
        break;
    }
  }

  /* Merge draw canvas into photo canvas */
  mergeDraw() {
    if (!this.originalImage) return;
    this.ctx.drawImage(this.drawCanvas, 0, 0);
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);

    // Now the drawing is permanent — snap original to current state
    const currentDataURL = this.canvas.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = () => {
      this.originalImage = newImg;
      this.applyAll();
      this.pushHistory();
    };
    newImg.src = currentDataURL;
  }

  /* ---- Text & Sticker ---- */
  addTextAtCenter() {
    if (!this.originalImage) return;
    this.addTextAt(this.canvas.width / 2, this.canvas.height / 2);
  }

  addTextAt(x, y) {
    const text = document.getElementById('textInput')?.value || 'Sample Text';
    if (!text.trim()) { utils.showToast('Enter text first', 'warning'); return; }

    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${this.textBold ? 'bold' : ''} ${this.textSize}px ${this.textFont}`;
    ctx.fillStyle = this.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(text, x, y);
    ctx.restore();

    // Commit to original
    const dataURL = this.canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => { this.originalImage = img; this.applyAll(); this.pushHistory(); };
    img.src = dataURL;
    utils.showToast('Text added', 'success');
  }

  addStickerAt(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${this.stickerSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.selectedSticker, x, y);
    ctx.restore();

    const dataURL = this.canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => { this.originalImage = img; this.applyAll(); this.pushHistory(); };
    img.src = dataURL;
    utils.showToast('Sticker added', 'success');
  }

  /* ---- Resize ---- */
  applyResize() {
    if (!this.originalImage) return;
    const newW = parseInt(document.getElementById('resizeWidth')?.value || this.canvas.width);
    const newH = parseInt(document.getElementById('resizeHeight')?.value || this.canvas.height);
    if (!newW || !newH || newW <= 0 || newH <= 0) { utils.showToast('Invalid dimensions', 'error'); return; }

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = newW; tmpCanvas.height = newH;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(this.canvas, 0, 0, newW, newH);

    const dataURL = tmpCanvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      this.originalImage = img;
      this.setupCanvas(newW, newH);
      this.applyAll();
      this.pushHistory();
      utils.showToast(`Resized to ${newW}×${newH}`, 'success');
    };
    img.src = dataURL;
  }

  /* ---- Crop ---- */
  initCropBox() {
    const overlay = document.getElementById('cropOverlay');
    const box = document.getElementById('cropBox');
    if (!overlay || !box) return;

    // Set initial crop at 20% inset
    const pct = 0.2;
    overlay.style.position = 'absolute';

    const container = document.getElementById('photoCanvasContainer');
    const cw = this.canvas.offsetWidth, ch = this.canvas.offsetHeight;

    this.cropRect = {
      x: cw * pct, y: ch * pct,
      w: cw * (1 - pct * 2), h: ch * (1 - pct * 2),
    };
    this.updateCropBoxDisplay();
    this.setupCropDrag(box, overlay);
  }

  updateCropBoxDisplay() {
    const box = document.getElementById('cropBox');
    if (!box) return;
    box.style.left = `${this.cropRect.x}px`;
    box.style.top = `${this.cropRect.y}px`;
    box.style.width = `${this.cropRect.w}px`;
    box.style.height = `${this.cropRect.h}px`;
  }

  setupCropDrag(box) {
    let dragging = false, startX, startY, startRect;
    box.addEventListener('mousedown', e => {
      dragging = true; startX = e.clientX; startY = e.clientY;
      startRect = { ...this.cropRect };
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      const overlay = document.getElementById('cropOverlay');
      const maxW = overlay ? overlay.offsetWidth : this.canvas.offsetWidth;
      const maxH = overlay ? overlay.offsetHeight : this.canvas.offsetHeight;
      this.cropRect.x = utils.clamp(startRect.x + dx, 0, maxW - this.cropRect.w);
      this.cropRect.y = utils.clamp(startRect.y + dy, 0, maxH - this.cropRect.h);
      this.updateCropBoxDisplay();
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  }

  updateCropBox() {
    if (this.cropRatio === 'free') { this.updateCropBoxDisplay(); return; }
    const [rw, rh] = this.cropRatio.split(':').map(Number);
    const aspect = rw / rh;
    const w = this.cropRect.w;
    this.cropRect.h = w / aspect;
    this.updateCropBoxDisplay();
  }

  applyCrop() {
    if (!this.originalImage) return;
    const scaleX = this.canvas.width / this.canvas.offsetWidth;
    const scaleY = this.canvas.height / this.canvas.offsetHeight;
    const cx = this.cropRect.x * scaleX;
    const cy = this.cropRect.y * scaleY;
    const cw = this.cropRect.w * scaleX;
    const ch = this.cropRect.h * scaleY;

    const tmp = document.createElement('canvas');
    tmp.width = Math.floor(cw); tmp.height = Math.floor(ch);
    const tCtx = tmp.getContext('2d');
    tCtx.drawImage(this.canvas, cx, cy, cw, ch, 0, 0, cw, ch);

    const dataURL = tmp.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      this.originalImage = img;
      this.setupCanvas(tmp.width, tmp.height);
      this.applyAll();
      this.pushHistory();
      this.cancelCrop();
      utils.showToast('Crop applied', 'success');
    };
    img.src = dataURL;
  }

  cancelCrop() {
    document.getElementById('cropOverlay')?.classList.add('hidden');
    this.selectTool('select');
  }

  /* ---- History (Undo/Redo) ---- */
  pushHistory() {
    if (!this.originalImage) return;
    // Remove future history
    this.history = this.history.slice(0, this.historyIndex + 1);
    const snapshot = {
      dataURL: this.canvas.toDataURL('image/jpeg', 0.8),
      rotation: this.rotation, flipH: this.flipH, flipV: this.flipV,
      adjustments: { ...this.adjustments },
      filter: this.currentFilter,
    };
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.updateUndoRedoBtns();
  }

  undo() {
    if (this.historyIndex <= 0) { utils.showToast('Nothing to undo', 'info'); return; }
    this.historyIndex--;
    this.restoreSnapshot(this.history[this.historyIndex]);
    this.updateUndoRedoBtns();
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) { utils.showToast('Nothing to redo', 'info'); return; }
    this.historyIndex++;
    this.restoreSnapshot(this.history[this.historyIndex]);
    this.updateUndoRedoBtns();
  }

  restoreSnapshot(snap) {
    const img = new Image();
    img.onload = () => {
      this.originalImage = img;
      this.rotation = snap.rotation;
      this.flipH = snap.flipH;
      this.flipV = snap.flipV;
      this.adjustments = { ...snap.adjustments };
      this.currentFilter = snap.filter;
      this.syncAdjustmentSliders();
      this.setupCanvas(img.naturalWidth, img.naturalHeight);
      this.applyAll();
    };
    img.src = snap.dataURL;
  }

  syncAdjustmentSliders() {
    Object.entries(this.adjustments).forEach(([key, val]) => {
      const slider = document.getElementById(`adj-${key}`);
      const display = document.getElementById(`v-${key}`);
      if (slider) slider.value = val;
      if (display) display.textContent = val;
    });
  }

  updateUndoRedoBtns() {
    const undo = document.getElementById('photoUndoBtn');
    const redo = document.getElementById('photoRedoBtn');
    if (undo) undo.style.opacity = this.historyIndex <= 0 ? '0.4' : '1';
    if (redo) redo.style.opacity = this.historyIndex >= this.history.length - 1 ? '0.4' : '1';
  }

  /* ---- Reset Adjustments ---- */
  resetAllAdjustments() {
    this.resetAllAdjustmentsState();
    this.syncAdjustmentSliders();
    this.applyAll();
    this.pushHistory();
    utils.showToast('Adjustments reset', 'info');
  }

  resetAllAdjustmentsState() {
    this.adjustments = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0, sharpen: 0, vignette: 0, temperature: 0 };
  }

  /* ---- Zoom ---- */
  changeZoom(delta) {
    this.zoom = utils.clamp(this.zoom + delta, 0.1, 5);
    this.updateCanvasTransform();
    this.updateZoomDisplay();
  }

  fitToScreen() {
    const area = document.getElementById('photoCanvasArea');
    if (!area || !this.canvas.width) return;
    const areaW = area.clientWidth - 40, areaH = area.clientHeight - 60;
    const scaleX = areaW / this.canvas.width, scaleY = areaH / this.canvas.height;
    this.zoom = Math.min(scaleX, scaleY, 1);
    this.updateCanvasTransform();
    this.updateZoomDisplay();
  }

  updateCanvasTransform() {
    const scale = this.zoom;
    const dw = Math.round(this.canvas.width * scale);
    const dh = Math.round(this.canvas.height * scale);
    this.canvas.style.width = `${dw}px`;
    this.canvas.style.height = `${dh}px`;
    this.drawCanvas.style.width = `${dw}px`;
    this.drawCanvas.style.height = `${dh}px`;
  }

  updateZoomDisplay() {
    const el = document.getElementById('photoZoom');
    if (el) el.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  /* ---- Canvas Position Helper ---- */
  getCanvasPos(e) {
    if (!this.drawCanvas) return null;
    const rect = this.drawCanvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    if (!touch) return null;
    const scaleX = this.drawCanvas.width / rect.width;
    const scaleY = this.drawCanvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }

  /* ---- Share button visibility ---- */
  _updateShareButtonVisibility() {
    const btn = document.getElementById('shareDl');
    if (btn) btn.style.display = canShare() ? '' : 'none';
  }

  openDownloadModal() {
    if (!this.originalImage) { utils.showToast('Import an image first', 'warning'); return; }
    this._updateShareButtonVisibility();
    document.getElementById('dlModal')?.classList.remove('hidden');
  }

  closeDownloadModal() {
    document.getElementById('dlModal')?.classList.add('hidden');
  }

  /* ---- Build the merged export canvas (shared by download + share) ---- */
  _buildExportDataUrl() {
    const mimeType = this.dlFormat === 'jpeg' ? 'image/jpeg' : this.dlFormat === 'webp' ? 'image/webp' : 'image/png';
    const quality  = this.dlFormat === 'png' ? 1 : this.dlQuality;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width  = this.canvas.width;
    finalCanvas.height = this.canvas.height;
    const fCtx = finalCanvas.getContext('2d');
    fCtx.drawImage(this.canvas,     0, 0);
    fCtx.drawImage(this.drawCanvas, 0, 0);
    const ext    = this.dlFormat === 'jpeg' ? 'jpg' : this.dlFormat;
    const dataURL = finalCanvas.toDataURL(mimeType, quality);
    return { dataURL, ext };
  }

  download() {
    const { dataURL, ext } = this._buildExportDataUrl();
    utils.downloadFile(dataURL, `${this.projectName || 'nova-edit'}.${ext}`);
    this.closeDownloadModal();
    utils.showToast(`Exported as ${ext.toUpperCase()}`, 'success');
  }

  async shareImage() {
    if (!this.originalImage) return;
    const { dataURL, ext } = this._buildExportDataUrl();
    const filename = `${this.projectName || 'nova-edit'}.${ext}`;
    utils.showToast('Opening share sheet…', 'info');
    const shared = await shareDataUrl(dataURL, filename, `Nova Edit — ${this.projectName || 'photo'}`);
    this.closeDownloadModal();
    if (!shared) {
      // Share not available — fall back to download automatically
      utils.downloadFile(dataURL, filename);
      utils.showToast(`Exported as ${ext.toUpperCase()}`, 'success');
    }
  }

  /* ---- Save Project ---- */
  async saveProject() {
    if (!this.originalImage) { utils.showToast('Nothing to save', 'warning'); return; }
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 200; thumbCanvas.height = 150;
    thumbCanvas.getContext('2d').drawImage(this.canvas, 0, 0, 200, 150);
    const thumb = thumbCanvas.toDataURL('image/jpeg', 0.6);

    const project = {
      id: this.projectId || window.storage.generateId(),
      name: this.projectName,
      type: 'photo',
      thumb,
      dataURL: this.canvas.toDataURL('image/jpeg', 0.8),
      adjustments: { ...this.adjustments },
      filter: this.currentFilter,
      rotation: this.rotation,
      flipH: this.flipH, flipV: this.flipV,
    };
    this.projectId = project.id;
    await window.storage.saveProject(project);
    utils.showToast('Project saved', 'success');
    if (window.app) window.app.refreshProjects();
  }

  /* ---- Sticker Picker ---- */
  populateStickers() {
    const grid = document.getElementById('stickerPicker');
    if (!grid) return;
    utils.STICKERS.forEach(s => {
      const item = document.createElement('button');
      item.className = 'sticker-item';
      item.textContent = s;
      item.addEventListener('click', () => {
        document.querySelectorAll('#stickerPicker .sticker-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedSticker = s;
      });
      grid.appendChild(item);
    });
  }

  /* ---- Keyboard Handler ---- */
  handleKey(e) {
    if (document.getElementById('screen-photo')?.classList.contains('active') === false) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); this.undo(); }
      if (e.key === 'y') { e.preventDefault(); this.redo(); }
      if (e.key === 'o') { e.preventDefault(); document.getElementById('photoFileInput')?.click(); }
      if (e.key === 's') { e.preventDefault(); this.saveProject(); }
      if (e.key === 'd') { e.preventDefault(); this.openDownloadModal(); }
    } else {
      if (e.key === 'c') this.selectTool('crop');
      if (e.key === 'd') this.selectTool('draw');
      if (e.key === 'e') this.selectTool('eraser');
      if (e.key === 't') this.selectTool('text');
    }
  }
}

window.photoEditor = new PhotoEditor();
