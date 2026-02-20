import { initializeApp } from 'firebase/app';
import { initializeAnalytics, logEvent as fbLogEvent, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDhSJgpTCdgDefG76DlieEKXBpWVKtJBuk',
  authDomain: 'twitch-hyper-timer.firebaseapp.com',
  projectId: 'twitch-hyper-timer',
  storageBucket: 'twitch-hyper-timer.firebasestorage.app',
  messagingSenderId: '403335558740',
  appId: '1:403335558740:web:d97c786c33f2d7c5eddfc1',
  measurementId: 'G-KDPR1FNLPJ'
};

const app = initializeApp(firebaseConfig);

let analytics = null;

/**
 * Initialize Firebase Analytics with Twitch-extension-safe cookie settings.
 * Extensions run in a cross-origin iframe, so cookies need
 * secure + SameSite=None to persist.
 */
export async function setupAnalytics() {
  if (analytics) return analytics;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    analytics = initializeAnalytics(app, {
      config: {
        cookie_flags: 'max-age=7200;secure;samesite=none'
      }
    });
    return analytics;
  } catch {
    return null;
  }
}

/** Log an event only if analytics was successfully initialised. */
export function logEvent(eventName, params) {
  if (!analytics) return;
  try {
    fbLogEvent(analytics, eventName, params);
  } catch {}
}

export { app };
