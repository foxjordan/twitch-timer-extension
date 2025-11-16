import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

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

let analyticsInstance = null;

export async function initializeAnalytics() {
  if (typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  } catch {
    return null;
  }
}

export { app };
