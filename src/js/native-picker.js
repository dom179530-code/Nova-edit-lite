/**
 * native-picker.js
 * Provides native Android file/camera picking via Capacitor plugins.
 * Falls back transparently to web <input type="file"> in the browser.
 *
 * Usage:
 *   import { pickPhoto, pickVideo } from './native-picker.js';
 *   pickPhoto(dataUrl => { ... });   // gives back a data URL string
 *   pickVideo(file => { ... });      // gives back a File object or blob URL
 */

const isNative = () =>
  typeof window !== 'undefined' &&
  typeof window.Capacitor !== 'undefined' &&
  window.Capacitor.isNativePlatform?.() === true;

/* ──────────────────────────────────────────────────
   PHOTO PICKER — Camera plugin + ActionSheet
   On Android : native bottom-sheet → Camera or Gallery
   On Browser : delegates to the hidden <input>
────────────────────────────────────────────────── */
async function pickPhoto(onDataUrl) {
  if (!isNative()) {
    // Web fallback — trigger the existing hidden file input
    const input = document.getElementById('photoFileInput');
    if (!input) return;
    const handler = (e) => {
      input.removeEventListener('change', handler);
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onDataUrl(reader.result, file.name);
      reader.readAsDataURL(file);
      input.value = '';
    };
    input.addEventListener('change', handler);
    input.click();
    return;
  }

  try {
    const { ActionSheet } = await import('@capacitor/action-sheet');
    const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');

    const { index } = await ActionSheet.showActions({
      title: 'Import Photo',
      message: 'Choose a source',
      options: [
        { title: '📷  Take Photo' },
        { title: '🖼️  Choose from Gallery' },
        { title: 'Cancel', style: 'CANCEL' },
      ],
    });

    if (index === 2) return; // cancelled

    const source = index === 0 ? CameraSource.Camera : CameraSource.Photos;

    const photo = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source,
      correctOrientation: true,
    });

    if (photo.dataUrl) {
      const name = `photo_${Date.now()}.${photo.format || 'jpeg'}`;
      onDataUrl(photo.dataUrl, name);
    }
  } catch (err) {
    // User cancelled or permission denied — do nothing
    if (err?.message?.toLowerCase().includes('cancel')) return;
    console.warn('[NativePicker] photo error:', err);
    window.utils?.showToast?.('Could not open camera. Please check permissions.', 'error');
  }
}

/* ──────────────────────────────────────────────────
   VIDEO PICKER — ActionSheet → native file inputs
   "Record Video"  : capture="camcorder" input
   "Choose from Gallery" : normal video/* input
   On Browser : falls back to original file input
   @param onFileReady  callback(File)
   @param inputId      id of the <input> element to use (default: 'videoFileInput')
────────────────────────────────────────────────── */
async function pickVideo(onFileReady, inputId = 'videoFileInput') {
  // Attach a one-shot change listener to the real input and return a File
  const attachAndTrigger = (id, captureAttr) => {
    const input = document.getElementById(id);
    if (!input) return;

    // Swap capture attribute if needed, restore after
    const hadCapture = input.hasAttribute('capture');
    const prevCapture = input.getAttribute('capture');
    if (captureAttr) {
      input.setAttribute('capture', captureAttr);
    } else {
      input.removeAttribute('capture');
    }

    const handler = (e) => {
      input.removeEventListener('change', handler);
      if (!captureAttr && !hadCapture) input.removeAttribute('capture');
      else if (hadCapture) input.setAttribute('capture', prevCapture);

      const file = e.target.files?.[0];
      if (file) onFileReady(file);
      input.value = '';
    };
    input.addEventListener('change', handler);
    input.click();
  };

  if (!isNative()) {
    attachAndTrigger(inputId, null);
    return;
  }

  try {
    const { ActionSheet } = await import('@capacitor/action-sheet');

    const { index } = await ActionSheet.showActions({
      title: 'Import Video',
      message: 'Choose a source',
      options: [
        { title: '🎥  Record Video' },
        { title: '📁  Choose from Gallery' },
        { title: 'Cancel', style: 'CANCEL' },
      ],
    });

    if (index === 2) return; // cancelled
    if (index === 0) {
      attachAndTrigger(inputId, 'camcorder'); // opens camera recorder
    } else {
      attachAndTrigger(inputId, null);        // opens gallery/file picker
    }
  } catch (err) {
    if (err?.message?.toLowerCase().includes('cancel')) return;
    console.warn('[NativePicker] video error:', err);
    attachAndTrigger(inputId, null); // fallback
  }
}

/* ──────────────────────────────────────────────────
   Permission pre-request helper — call once on app start
   so Android shows the rationale dialog early.
────────────────────────────────────────────────── */
async function requestMediaPermissions() {
  if (!isNative()) return;
  try {
    const { Camera } = await import('@capacitor/camera');
    await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
  } catch (_) {}
}

export { pickPhoto, pickVideo, requestMediaPermissions, isNative };
