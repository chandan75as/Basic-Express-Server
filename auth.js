import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global variables initialize kar rahe hain
let auth, db, provider;

// Backend se secure keys laane ka function
async function initFirebase() {
  try {
    // Ye hamare index.js waale route ko call karega
    const response = await fetch('/api/firebase-config');
    const firebaseConfig = await response.json();

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();

    console.log("Firebase initialized securely!");
  } catch (error) {
    console.error("Firebase config load karne mein error:", error);
  }
}

// Page load hote hi Firebase setup karo
initFirebase();

// Login Button ka Logic
const googleBtn = document.getElementById("google-login-btn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    if (!auth) {
      alert("Firebase abhi load ho raha hai, thoda wait karein...");
      return;
    }

    try {
      googleBtn.innerText = "Signing in...";
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check karein agar naya user hai toh database mein add karein
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          walletBalance: 100000, // Tournament practice amount
          createdAt: new Date().toISOString()
        });
      }

      // Login ke baad sidha Lobby mein bhej dein
      window.location.href = "/lobby.html";
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login Error: " + error.message);
      googleBtn.innerHTML = `
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="24" alt="Google Logo">
        Continue with Google
      `;
    }
  });
}