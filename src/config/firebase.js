import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDjNKDQYfoDs7pggy9BRvff3r7uke-2jGM",
  authDomain: "faros-training-center.firebaseapp.com",
  projectId: "faros-training-center",
  storageBucket: "faros-training-center.firebasestorage.app",
  messagingSenderId: "951817703141",
  appId: "1:951817703141:web:0d714a4c94c862fc10ce0c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
