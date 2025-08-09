import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

console.log("Environment check:", {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
});

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyADwXaCiAs1Bz_gHrSHwnzH4nYu5ogctf0",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "bball-team-generator.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bball-team-generator",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "bball-team-generator.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "698253006350",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:698253006350:web:ddb9e7e799c034b61c8e5f",
};

console.log("Final Firebase config:", firebaseConfig);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);