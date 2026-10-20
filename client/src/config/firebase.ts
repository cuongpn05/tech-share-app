import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAI9YZWIn1zSGy1-WndSNDrz_RB003RE6k',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'tech-share-80539.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'tech-share-80539',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'tech-share-80539.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '215197206890',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:215197206890:web:645a4a4fe0136ff6f4bd13',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-WEJH0576JW',
};

// Khởi tạo Firebase App an toàn (Singleton tránh khởi tạo lặp lại)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance: any = null;
try {
  authInstance = getAuth(app);
} catch {
  try {
    authInstance = initializeAuth(app, {
      persistence: inMemoryPersistence,
    });
  } catch {
    authInstance = null;
  }
}

export const auth = authInstance;
export const storage = getStorage(app);
export default app;
