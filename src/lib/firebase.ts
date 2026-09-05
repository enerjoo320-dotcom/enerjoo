import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth,
  initializeAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  indexedDBLocalPersistence, 
  inMemoryPersistence, 
  browserPopupRedirectResolver,
  Auth
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import defaultFirebaseConfig from "../../firebase-applet-config.json";

// Support both static provisioned config and optional VITE_ environment overrides
export const currentFirebaseConfig = {
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || defaultFirebaseConfig.projectId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || defaultFirebaseConfig.appId,
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || defaultFirebaseConfig.apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || defaultFirebaseConfig.authDomain,
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || defaultFirebaseConfig.firestoreDatabaseId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || defaultFirebaseConfig.storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || defaultFirebaseConfig.messagingSenderId,
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || defaultFirebaseConfig.measurementId
};

console.log("[Firebase Init] Configured with Project ID:", currentFirebaseConfig.projectId, "| Auth Domain:", currentFirebaseConfig.authDomain);

const app = getApps().length > 0 ? getApp() : initializeApp(currentFirebaseConfig);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

export const db: Firestore = getFirestore(app, currentFirebaseConfig.firestoreDatabaseId);

export default app;


