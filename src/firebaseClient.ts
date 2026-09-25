import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// In production (Render) use environment variables to keep credentials out of git.
// In development / AI Studio, fallback to local firebase-applet-config.json if available.
let localConfig: Record<string, string> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  localConfig = require('../firebase-applet-config.json');
} catch {
  localConfig = {};
}

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId || 'gen-lang-client-0517156539',
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || localConfig.appId || '',
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || localConfig.apiKey || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || localConfig.authDomain || '',
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || 'ai-studio-flightpricetrend-46e45fb1-7c70-4b83-96d5-d1f852bc4638',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || localConfig.storageBucket || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId || '',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Target specific database if specified in config, otherwise default
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export default app;
