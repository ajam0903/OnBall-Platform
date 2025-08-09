import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Temporary hardcoded config to bypass environment variable issues
const firebaseConfig = {
    apiKey: "AIzaSyADwXaCiAs1Bz_gHrSHwnzH4nYu5ogctf0",
    authDomain: "bball-team-generator.firebaseapp.com",
    projectId: "bball-team-generator",
    storageBucket: "bball-team-generator.firebasestorage.app",
    messagingSenderId: "698253006350",
    appId: "1:698253006350:web:ddb9e7e799c034b61c8e5f",
};

console.log("Using hardcoded Firebase config with API key:", firebaseConfig.apiKey);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);