import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const buttons = [
  document.getElementById("google-login-btn"),
  document.getElementById("main-google-login-btn"),
].filter(Boolean);

const originalLabels = new Map(
  buttons.map((button) => [button, button.textContent.trim()])
);

function setButtonsDisabled(disabled, label) {
  buttons.forEach((button) => {
    button.disabled = disabled;
    button.textContent = label || originalLabels.get(button);
    button.classList.toggle("opacity-60", disabled);
    button.classList.toggle("cursor-not-allowed", disabled);
  });
}

function showError(message) {
  let error = document.getElementById("firebase-error");
  if (!error) {
    error = document.createElement("p");
    error.id = "firebase-error";
    error.className = "text-rose-400 text-sm text-center font-bold mt-3";
    document.querySelector("main")?.prepend(error);
  }
  error.textContent = message;
}

async function startFirebase() {
  setButtonsDisabled(true, "Loading...");

  try {
    const response = await fetch("/api/firebase-config");
    if (!response.ok) throw new Error("Firebase config not found.");

    const config = await response.json();
    const app = initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const provider = new GoogleAuthProvider();

    // Jab user login check hota hai
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        setButtonsDisabled(true, "Securing Arena...");
        
        try {
          // FIRESTORE DATABASE ENTRY
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          const userData = {
            name: user.displayName || "Trader",
            email: user.email || "",
            photo: user.photoURL || "",
            lastLogin: new Date().toISOString()
          };

          if (userSnap.exists()) {
            // Agar purana user hai toh sirf data update karo
            await setDoc(userRef, userData, { merge: true });
            localStorage.setItem("ta_balance", userSnap.data().balance || 0);
          } else {
            // Agar bilkul naya user hai toh 500 coins do
            userData.balance = 500;
            userData.createdAt = new Date().toISOString();
            await setDoc(userRef, userData);
            localStorage.setItem("ta_balance", 500);
          }

          // UI display ke liye local storage
          localStorage.setItem("ta_userName", userData.name);
          localStorage.setItem("ta_userEmail", userData.email);
          localStorage.setItem("ta_userPhoto", userData.photo);
          localStorage.setItem("ta_uid", user.uid);

          // Done! Redirect to Tournament page
          window.location.replace("/tournament.html");

        } catch (dbError) {
          console.error("Firestore Error:", dbError);
          showError("Database connection failed. Please refresh.");
          setButtonsDisabled(false);
        }
      } else {
        setButtonsDisabled(false);
      }
    });

    // Login button click event
    buttons.forEach((button) => {
      button.addEventListener("click", async () => {
        setButtonsDisabled(true, "Signing in...");
        try {
          await signInWithPopup(auth, provider);
        } catch (error) {
          console.error("Google Auth Error:", error);
          showError("Sign-in cancelled or failed. Try again.");
          setButtonsDisabled(false);
        }
      });
    });

  } catch (initError) {
    console.error("Initialization Error:", initError);
    showError("Server error. Please try again later.");
    setButtonsDisabled(false);
  }
}

startFirebase();
