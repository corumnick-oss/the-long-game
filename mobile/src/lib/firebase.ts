import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAd8Me9csnIzKQR2Im902JxR6g7jg1KYEw',
  authDomain: 'the-long-game-prod-bef05.firebaseapp.com',
  projectId: 'the-long-game-prod-bef05',
  storageBucket: 'the-long-game-prod-bef05.firebasestorage.app',
  messagingSenderId: '309276847432',
  appId: '1:309276847432:web:8b5297c3718fc51624177d',
};

function getFirebase() {
  if (getApps().length > 0) {
    return { app: getApp(), auth: getAuth(getApp()) };
  }
  const app = initializeApp(firebaseConfig);
  const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  return { app, auth };
}

const { app, auth } = getFirebase();

export { app, auth };
export default app;
