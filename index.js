const express = require("express");
const path = require("path");

const app = express();
const host = "0.0.0.0";
const port = 3000;

// Ye line zaroori hai taaki 'auth.js' aur baaki assets properly load ho sakein
app.use(express.static(__dirname));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/firebase-config", (_req, res) => {
  const requiredKeys = [
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_PROJECT_ID",
  ];
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    return res.status(503).json({
      error: "Firebase configuration is incomplete.",
      missing: missingKeys,
    });
  }

  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});