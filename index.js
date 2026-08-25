const express = require("express");
const path = require("path");

const app = express();
const host = "0.0.0.0";
const port = 3000;

// Ye line zaroori hai taaki 'auth.js' aur baaki assets properly load ho sakein
app.use(express.static(__dirname));

// Routes for HTML pages
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/lobby.html", (req, res) => {
  res.sendFile(path.join(__dirname, "lobby.html"));
});

app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// API endpoint jo Replit Secrets se Firebase keys fetch karke frontend ko dega
app.get("/api/firebase-config", (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  });
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});