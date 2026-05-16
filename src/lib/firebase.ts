import { initializeApp } from "firebase/app";
import { initializeAuth, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

// Using initializeAuth with explicit persistence can be more reliable in some iframe environments
export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, indexedDBLocalPersistence]
});

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
