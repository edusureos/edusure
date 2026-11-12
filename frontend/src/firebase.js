import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCk2tcFpymkWkDWHMMrJunGK0P8aqDIR-E",
  authDomain: "edusure-dev.firebaseapp.com",
  projectId: "edusure-dev",
  storageBucket: "edusure-dev.firebasestorage.app",
  messagingSenderId: "14968797341",
  appId: "1:14968797341:web:16d38519bd44cd11283c74"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { RecaptchaVerifier, signInWithPhoneNumber };