import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCOGeIQoPX7kNVIHUipxBlJIAYissB2AqM",
    authDomain: "bball-team-generator.firebaseapp.com",
    projectId: "bball-team-generator",
    storageBucket: "bball-team-generator.firebasestorage.app",
    messagingSenderId: "698253006350",
    appId: "1:698253006350:web:ddb9e7e799c034b61c8e5f",
    measurementId: "G-41WKPGWFMK"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);