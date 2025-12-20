import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCcU-oKQm0VA1tSfSsDSom1xZsJyzapjRM",
  authDomain: "prj-mgmt-fabb3.firebaseapp.com",
  projectId: "prj-mgmt-fabb3",
  storageBucket: "prj-mgmt-fabb3.firebasestorage.app",
  messagingSenderId: "449633904000",
  appId: "1:449633904000:web:d868f50c6e3b597b9e0d65"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
