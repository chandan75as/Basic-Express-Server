import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const buttons = [
  document.getElementById("google-login-btn"),
  document.getElementById("main-google-login-btn"),
].filter(Boolean);

const originalLabels = new Map(
  buttons.map((button) => [button, button.textContent.trim()]),
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
    error.className = "text-rose-400 text-sm text-center";
    document.querySelector("main")?.prepend(error);
  }
  error.textContent = message;
}

async function startFirebase() {
  setButtonsDisabled(true, "Loading...");

  const response = await fetch("/api/firebase-config");
  if (!response.ok) {
    throw new Error("Firebase configuration is unavailable.");
  }

  const config = await response.json();
  const app = initializeApp(config);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.replace("/tournament.html");
    } else {
      setButtonsDisabled(false);
    }
  });

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      setButtonsDisabled(true, "Signing in...");
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("Google sign-in failed:", error);
        showError("Google sign-in was not completed. Please try again.");
        setButtonsDisabled(false);
      }
    });
  });
}

startFirebase().catch((error) => {
  console.error("Firebase initialization failed:", error);
  showError("Sign-in is temporarily unavailable. Please try again later.");
  setButtonsDisabled(false);
});