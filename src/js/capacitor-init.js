/**
 * Capacitor Android bridge initialization.
 * Runs only when the app is loaded inside the native Android WebView.
 * Does NOT affect web browser behaviour in any way.
 */

import { requestMediaPermissions, isNative } from './native-picker.js';

const initCapacitor = async () => {
  if (!isNative()) return;

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    const { StatusBar, Style } = await import('@capacitor/status-bar');

    document.addEventListener('deviceready', async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0a0a0f' });
        await StatusBar.show();
      } catch (_) {}
    });

    window.addEventListener('load', async () => {
      try {
        await SplashScreen.hide({ fadeOutDuration: 300 });
        // Request camera + gallery permissions early so the first import flow is smooth
        await requestMediaPermissions();
      } catch (_) {}
    });

    document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');

    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      if (typeof window.app !== 'undefined' && typeof window.app.navigate === 'function') {
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen && currentScreen.id !== 'screen-home') {
          window.app.navigate('home');
        }
      }
    }, false);

  } catch (_) {}
};

initCapacitor();
