const express = require("express");
const path = require("path");
const admin = require("firebase-admin");

// Master Key
const serviceAccount = require("./serviceAccountKey.json");

// Firebase Admin Initialize (God Mode)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const host = "0.0.0.0";
const port = 3000;

app.use(express.json()); 
app.use(express.static(__dirname));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/firebase-config", (_req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
});

// 1. MATCH JOIN RULE
app.post("/api/join-match", async (req, res) => {
  const { uid, entryFee, matchName } = req.body;
  if (!uid || !entryFee) return res.status(400).json({ error: "Data missing" });

  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User nahi mila" });

    let userData = userDoc.data();
    let depositBal = userData.balance || 0;  
    let bonusBal = userData.bonusBal || 0;   

    let maxBonusAllowed = entryFee * 0.10; 
    let bonusToUse = Math.min(maxBonusAllowed, bonusBal);
    let depositToUse = entryFee - bonusToUse;

    if (depositBal < depositToUse) return res.status(400).json({ error: "Insufficient Deposit Balance!" });

    // Update Balance
    await userRef.update({
      balance: depositBal - depositToUse,
      bonusBal: bonusBal - bonusToUse
    });

    // 🔴 [TRANSACTION SAVE KARNA]
    await userRef.collection("transactions").add({
      title: `Joined: ${matchName || 'Tournament'}`,
      amount: `-🪙 ${entryFee}`,
      type: "debit",
      date: new Date().toISOString()
    });

    res.json({ success: true, message: "Match Joined!" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 2. WITHDRAWAL RULE
app.post("/api/withdraw", async (req, res) => {
  const { uid, withdrawAmount } = req.body;
  if (!uid || !withdrawAmount) return res.status(400).json({ error: "Data missing" });

  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "User nahi mila" });

    let userData = userDoc.data();
    let withdrawalBal = userData.withdrawalBal || 0; 
    let bonusBal = userData.bonusBal || 0;           

    let bonusToDeduct = withdrawAmount * 0.40;
    let winningToDeduct = withdrawAmount * 0.60;

    if (bonusBal < bonusToDeduct || withdrawalBal < winningToDeduct) {
      return res.status(400).json({ error: "Insufficient Balance!" });
    }

    // Update Balance
    await userRef.update({
      withdrawalBal: withdrawalBal - winningToDeduct,
      bonusBal: bonusBal - bonusToDeduct
    });

    // 🔴 [TRANSACTION SAVE KARNA]
    await userRef.collection("transactions").add({
      title: "Funds Withdrawn",
      amount: `-🪙 ${withdrawAmount}`,
      type: "withdraw",
      date: new Date().toISOString()
    });

    res.json({ success: true, message: "Withdrawal Successful!" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. 🔴 NAYI API: RECENT TRANSACTIONS BHEJNE KE LIYE
app.post("/api/get-transactions", async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: "UID missing" });

  try {
    // Database se user ke sabse naye 10 transactions uthao
    const txSnapshot = await db.collection("users").doc(uid).collection("transactions")
                               .orderBy("date", "desc").limit(10).get();
    
    let history = [];
    txSnapshot.forEach(doc => { history.push(doc.data()); });

    res.json({ success: true, transactions: history });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
