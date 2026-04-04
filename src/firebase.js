// firebase.js - Firebase configuration (OPTIONAL)
// Fill in your Firebase config to enable cloud sync.
// Leave as-is to use LocalStorage only (offline mode).

import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// ======================================================
// FIREBASE CONFIG - Fill in your values to enable sync
// ======================================================
const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

let db = null;
let firebaseEnabled = false;

export function isFirebaseEnabled() {
  return firebaseEnabled;
}

export function getDb() {
  return db;
}

export function initFirebase() {
  // Check if config is filled in
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.log('[Firebase] No config found. Using LocalStorage only.');
    firebaseEnabled = false;
    return false;
  }

  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);

    // Enable offline persistence
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Multiple tabs open, persistence limited to one tab.');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Browser does not support persistence.');
      }
    });

    firebaseEnabled = true;
    console.log('[Firebase] Connected! Cloud sync enabled.');
    return true;
  } catch (error) {
    console.error('[Firebase] Init failed:', error);
    firebaseEnabled = false;
    return false;
  }
}
