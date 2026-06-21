/**
 * native-share.js
 * Cross-platform share helper.
 *
 *  On Android (Capacitor WebView):
 *    1. Tries navigator.share({ files }) — native Android share sheet with the actual image file
 *    2. Falls back to Capacitor Share plugin for text/URL sharing
 *
 *  On desktop browser:
 *    1. Tries navigator.share if available (Chrome on Mac, etc.)
 *    2. Returns false so the caller can fall back to download
 *
 * Usage:
 *   import { shareDataUrl, shareText, canShare } from './native-share.js';
 *
 *   const shared = await shareDataUrl(dataUrl, 'photo.png', 'My Photo');
 *   if (!shared) { ... fall back to download ... }
 */

import { isNative } from './native-picker.js';

/**
 * Convert a data URL to a File object.
 */
function dataUrlToFile(dataUrl, filename) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

/**
 * Share an image data URL via the native Android share sheet.
 * Returns true if the share was initiated, false if the caller should fall back to download.
 *
 * @param {string} dataUrl   - canvas.toDataURL() result
 * @param {string} filename  - e.g. "nova-edit.png"
 * @param {string} title     - share sheet title / message
 */
async function shareDataUrl(dataUrl, filename, title = 'Nova Edit Lite') {
  // ── Try Web Share API with file (works great in Capacitor WebView on Android) ──
  if (typeof navigator.share === 'function') {
    try {
      const file = dataUrlToFile(dataUrl, filename);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return true;
      }
    } catch (err) {
      if (err.name === 'AbortError') return true; // user cancelled — treat as success
      // canShare returned false or share threw — continue to fallbacks
    }
  }

  // ── Capacitor Share fallback (shares app name + text; no file) ──
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title,
        text: `Created with Nova Edit Lite — ${title}`,
        dialogTitle: 'Share with…',
      });
      return true;
    } catch (err) {
      if (err?.message?.toLowerCase().includes('cancel')) return true;
      console.warn('[NativeShare] Capacitor Share failed:', err);
    }
  }

  return false; // caller should fall back to download
}

/**
 * Share plain text / a URL.
 * Returns true if the share was initiated.
 */
async function shareText(text, title = 'Nova Edit Lite') {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return true;
    }
  }

  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: 'Share with…' });
      return true;
    } catch (_) {}
  }

  return false;
}

/**
 * Returns true if some form of sharing is available on this platform/browser.
 */
function canShare() {
  return isNative() || typeof navigator.share === 'function';
}

export { shareDataUrl, shareText, canShare };
