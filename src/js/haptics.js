/**
 * haptics.js
 * Native Android haptic feedback via Capacitor.
 * Silently no-ops on browsers / unsupported devices.
 *
 * Usage:
 *   import { haptic } from './haptics.js';
 *   haptic('light');    // button taps
 *   haptic('medium');   // tool selection
 *   haptic('heavy');    // destructive / confirm actions
 *   haptic('success');  // export complete
 *   haptic('warning');  // error / warning
 *   haptic('error');    // failed action
 */

import { isNative } from './native-picker.js';

let _Haptics = null;
let _ImpactStyle = null;
let _NotificationType = null;

async function _load() {
  if (_Haptics) return true;
  if (!isNative()) return false;
  try {
    const mod = await import('@capacitor/haptics');
    _Haptics        = mod.Haptics;
    _ImpactStyle    = mod.ImpactStyle;
    _NotificationType = mod.NotificationType;
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'|'selection'} type
 */
async function haptic(type = 'light') {
  if (!await _load()) return;
  try {
    switch (type) {
      case 'light':
        await _Haptics.impact({ style: _ImpactStyle.Light }); break;
      case 'medium':
        await _Haptics.impact({ style: _ImpactStyle.Medium }); break;
      case 'heavy':
        await _Haptics.impact({ style: _ImpactStyle.Heavy }); break;
      case 'success':
        await _Haptics.notification({ type: _NotificationType.Success }); break;
      case 'warning':
        await _Haptics.notification({ type: _NotificationType.Warning }); break;
      case 'error':
        await _Haptics.notification({ type: _NotificationType.Error }); break;
      case 'selection':
        await _Haptics.selectionStart();
        await _Haptics.selectionEnd(); break;
      default:
        await _Haptics.impact({ style: _ImpactStyle.Light });
    }
  } catch (_) {}
}

export { haptic };
