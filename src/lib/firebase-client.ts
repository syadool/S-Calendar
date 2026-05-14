import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { clientEnv } from './env';

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
