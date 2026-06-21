/* ============================================
   NOVA EDIT LITE — Utility Functions
   ============================================ */

/** Format seconds to mm:ss */
function formatTime(secs) {
  if (!isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format date to readable string */
function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

/** Debounce a function */
function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Clamp a value between min and max */
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

/** Generate UUID */
function uuid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

/** Show toast notification */
function showToast(message, type = 'info', duration = 2800) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

/** Apply CSS filter string to a video element */
function getVideoFilterCSS(fx) {
  const filters = {
    none: '',
    grayscale: 'grayscale(100%)',
    sepia: 'sepia(80%)',
    vintage: 'sepia(40%) contrast(0.85) brightness(0.9) saturate(1.2)',
    vivid: 'saturate(180%) contrast(1.1)',
    cool: 'hue-rotate(200deg) saturate(1.2)',
    warm: 'hue-rotate(-30deg) saturate(1.3) brightness(1.05)',
    invert: 'invert(100%)',
  };
  return filters[fx] || '';
}

/** Convert base64 to Blob */
function base64ToBlob(base64, mimeType = 'image/png') {
  const binary = atob(base64.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Download a canvas or URL as file */
function downloadFile(dataURL, filename) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Scale canvas while fitting within max dimensions */
function fitCanvasToContainer(canvas, containerWidth, containerHeight, imageWidth, imageHeight) {
  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY, 1);
  return {
    displayWidth: Math.floor(imageWidth * scale),
    displayHeight: Math.floor(imageHeight * scale),
    scale,
  };
}

/** Deep clone an object */
function deepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch { return { ...obj }; }
}

/** Get mouse/touch position relative to element */
function getRelativePos(e, el) {
  const rect = el.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
}

/** Create a FileReader that resolves with result */
function readFileAs(file, type = 'dataURL') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    if (type === 'dataURL') reader.readAsDataURL(file);
    else if (type === 'text') reader.readAsText(file);
    else if (type === 'arrayBuffer') reader.readAsArrayBuffer(file);
  });
}

/** Smoothly scroll to element */
function scrollTo(el, offset = 0) {
  const top = el.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

/** Sticker list */
const STICKERS = [
  '😊','😂','❤️','🔥','✨','🎉','👍','💯','🎨','⭐',
  '🌈','🎬','📸','🎵','🌟','😎','🤩','💫','🦋','🌸',
  '🍕','🎮','🏆','💎','🚀','🌙','☀️','🌊','🎭','🎪',
];

/** Apply canvas pixel filter (sharpen) */
function applySharpen(ctx, width, height, amount = 1) {
  if (amount <= 0) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const k = amount;
  // Simple unsharp mask kernel
  const kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kidx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += copy[kidx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        data[idx + c] = clamp(sum, 0, 255);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Apply vignette effect */
function applyVignette(ctx, width, height, intensity) {
  if (intensity <= 0) return;
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${intensity / 100})`);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Apply cartoon-like effect */
function applyCartoon(ctx, width, height) {
  // Posterize + edge detection approximation
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const levels = 5;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.round(data[i] / (255 / levels)) * (255 / levels);
    data[i+1] = Math.round(data[i+1] / (255 / levels)) * (255 / levels);
    data[i+2] = Math.round(data[i+2] / (255 / levels)) * (255 / levels);
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Apply sketch effect */
function applySketch(ctx, width, height) {
  // Grayscale + edge
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  // Grayscale
  for (let i = 0; i < data.length; i += 4) {
    const avg = 0.299 * copy[i] + 0.587 * copy[i+1] + 0.114 * copy[i+2];
    data[i] = data[i+1] = data[i+2] = avg;
  }
  ctx.putImageData(imageData, 0, 0);
  // Emboss/edge
  const img2 = ctx.getImageData(0, 0, width, height);
  const d = img2.data;
  const d2 = new Uint8ClampedArray(d);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const left = ((y) * width + (x - 1)) * 4;
      const top  = ((y - 1) * width + x) * 4;
      d[i] = d[i+1] = d[i+2] = clamp(128 + d2[i] - d2[left] - d2[top], 0, 255);
    }
  }
  ctx.putImageData(img2, 0, 0);
}

// Make all utilities globally available
window.utils = {
  formatTime, formatDate, debounce, clamp, uuid, showToast,
  getVideoFilterCSS, base64ToBlob, downloadFile, fitCanvasToContainer,
  deepClone, getRelativePos, readFileAs, scrollTo, STICKERS,
  applySharpen, applyVignette, applyCartoon, applySketch,
};
