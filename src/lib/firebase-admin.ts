import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { serverEnv } from './env-server';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: serverEnv.FIREBASE_PROJECT_ID,
      clientEmail: serverEnv.FIREBASE_CLIENT_EMAIL,
      privateKey: serverEnv.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
