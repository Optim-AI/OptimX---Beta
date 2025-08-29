// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAfjtdXVBt88gIn1gKvPSGhfLx_hI3_pWE",
  authDomain: "optim-ai.firebaseapp.com",
  projectId: "optim-ai",
  storageBucket: "optim-ai.firebasestorage.app",
  messagingSenderId: "321157384488",
  appId: "1:321157384488:web:cfa8abb531a27bbdf9a81d",
  measurementId: "G-CKG1YEZERB"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
