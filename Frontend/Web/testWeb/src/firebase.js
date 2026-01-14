import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCJwrieygMEuck-Ags4wGhAYX6SLT-zIhc",
  authDomain: "rescuelink-4ba21.firebaseapp.com",
  projectId: "rescuelink-4ba21",
  storageBucket: "rescuelink-4ba21.firebasestorage.app",
  messagingSenderId: "977194227908",
  appId: "1:977194227908:web:c8c482417c8977c23b5191",
  measurementId: "G-VD7WXWN0EC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
