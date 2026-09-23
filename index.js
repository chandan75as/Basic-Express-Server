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
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
});

// ========================================================
// 🚀 1. MATCH JOIN RULE (Global spots update + VIP check)
// ========================================================
app.post("/api/join-match", async (req, res) => {
  const { uid, entryFee, matchName, matchId } = req.body;
  if (!uid || !entryFee || !matchId) return res.status(400).json({ error: "Data missing" });

  try {
    await db.runTransaction(async (t) => {
        const userRef = db.collection("users").doc(uid);
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error("User nahi mila");

        let userData = userDoc.data();
        let depositBal = userData.balance || 0;  
        let bonusBal = userData.bonusBal || 0;   
        let isVIP = userData.isVIP || false;     

        let bonusPercentage = isVIP ? 0.40 : 0.10;
        let maxBonusAllowed = entryFee * bonusPercentage; 
        
        let bonusToUse = Math.min(maxBonusAllowed, bonusBal);
        let depositToUse = entryFee - bonusToUse;

        if (depositBal < depositToUse) throw new Error("Insufficient Deposit Balance!");

        // 1. User Balance & Matches Count Update karo
        t.update(userRef, {
          balance: depositBal - depositToUse,
          bonusBal: bonusBal - bonusToUse,
          totalMatches: (userData.totalMatches || 0) + 1 // (Profile ka 0 matches fix)
        });

        // 2. Transaction Parchi banao
        t.set(userRef.collection("transactions").doc(), {
          title: `Joined: ${matchName}`,
          amount: `-🪙 ${entryFee}`,
          type: "debit",
          date: new Date().toISOString()
        });

        // 3. 🔴 NAYA: Global Tournament Folder mein add karo (Taaki 100/1 ho jaye)
        const matchRef = db.collection("tournaments").doc(matchId).collection("participants").doc(uid);
        t.set(matchRef, {
            name: userData.name || "Trader",
            photo: userData.photo || "",
            joinedAt: new Date().toISOString()
        });
    });

    res.json({ success: true, message: "Match Joined!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ========================================================
// 👥 2. GET REAL PARTICIPANTS (Count & Names)
// ========================================================
app.post("/api/get-match-info", async (req, res) => {
    const { matchId } = req.body;
    try {
        const snapshot = await db.collection("tournaments").doc(matchId).collection("participants").get();
        let participants = [];
        
        snapshot.forEach(doc => {
            participants.push(doc.data());
        });

        res.json({
            success: true,
            count: participants.length,       // Asali Spots (Jaise 1, 2, 5...)
            participants: participants        // Sabke asali naam
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch match info" });
    }
});


// ========================================================
// 💸 3. WITHDRAW RULE
// ========================================================
app.post("/api/withdraw", async (req, res) => {
  const { uid, withdrawAmount } = req.body;
  try {
    const userRef = db.collection("users").doc(uid);
    await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        let userData = userDoc.data();
        let isVIP = userData.isVIP || false;

        let bonusRatio = isVIP ? 0.60 : 0.40;
        let winningRatio = isVIP ? 0.40 : 0.60;

        let bonusToDeduct = withdrawAmount * bonusRatio;
        let winningToDeduct = withdrawAmount * winningRatio;

        if ((userData.bonusBal||0) < bonusToDeduct || (userData.withdrawalBal||0) < winningToDeduct) {
          throw new Error("Insufficient Balance for this ratio!");
        }

        t.update(userRef, {
          withdrawalBal: userData.withdrawalBal - winningToDeduct,
          bonusBal: userData.bonusBal - bonusToDeduct
        });

        if (userData.sponsorUid) {
            const sponsorRef = db.collection("users").doc(userData.sponsorUid);
            const sponsorDoc = await t.get(sponsorRef);
            if (sponsorDoc.exists) {
                let commission = withdrawAmount * 0.10;
                t.update(sponsorRef, { withdrawalBal: (sponsorDoc.data().withdrawalBal || 0) + commission });
            }
        }
    });
    res.json({ success: true, message: "Withdrawal Successful!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 🔎 4. VERIFY SPONSOR
// ========================================================
app.post("/api/verify-sponsor", async (req, res) => {
    const { sponsorCode } = req.body;
    try {
        const snapshot = await db.collection("users").where("referralCode", "==", sponsorCode).get();
        if (snapshot.empty) return res.status(404).json({ error: "Invalid Referral Code" });
        res.json({ success: true, sponsorName: snapshot.docs[0].data().name, sponsorUid: snapshot.docs[0].id });
    } catch (error) { res.status(500).json({ error: "Server error" }); }
});

// ========================================================
// 🤝 5. APPLY REFERRAL
// ========================================================
app.post("/api/apply-referral", async (req, res) => {
    const { uid, sponsorUid } = req.body;
    if (uid === sponsorUid) return res.status(400).json({ error: "Khud ka code use nahi kar sakte!" });

    try {
        const userRef = db.collection("users").doc(uid);
        const sponsorRef = db.collection("users").doc(sponsorUid);

        await db.runTransaction(async (t) => {
            const userDoc = await t.get(userRef);
            const sponsorDoc = await t.get(sponsorRef);
            let userData = userDoc.data();
            let sponsorData = sponsorDoc.data();

            t.update(userRef, {
                sponsorUid: sponsorUid,
                l2SponsorUid: sponsorData.sponsorUid || null,
                bonusBal: (userData.bonusBal || 0) + 10
            });
        });
        res.json({ success: true, message: "Code Locked! 10 Bonus added." });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ========================================================
// 🔥 6. ID ACTIVATION
// ========================================================
app.post("/api/activate-vip", async (req, res) => {
    const { uid } = req.body;
    try {
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const userDoc = await t.get(userRef);
            let userData = userDoc.data();
            
            if (userData.isVIP) throw new Error("Aapki ID pehle se Active hai!");
            if ((userData.balance||0) < 250) throw new Error("Insufficient Balance.");

            t.update(userRef, { balance: userData.balance - 250, isVIP: true });

            if (userData.sponsorUid) {
                const l1Ref = db.collection("users").doc(userData.sponsorUid);
                const l1Doc = await t.get(l1Ref);
                if (l1Doc.exists) t.update(l1Ref, { withdrawalBal: (l1Doc.data().withdrawalBal || 0) + 150 });
            }

            if (userData.l2SponsorUid) {
                const l2Ref = db.collection("users").doc(userData.l2SponsorUid);
                const l2Doc = await t.get(l2Ref);
                if (l2Doc.exists) t.update(l2Ref, { withdrawalBal: (l2Doc.data().withdrawalBal || 0) + 50 });
            }
        });
        res.json({ success: true, message: "ID Activated successfully!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ========================================================
// 📜 7. GET TRANSACTIONS
// ========================================================
app.post("/api/get-transactions", async (req, res) => {
  const { uid } = req.body;
  try {
    const txSnapshot = await db.collection("users").doc(uid).collection("transactions").orderBy("date", "desc").limit(15).get();
    let history = [];
    txSnapshot.forEach(doc => { history.push(doc.data()); });
    res.json({ success: true, transactions: history });
  } catch (error) { res.status(500).json({ error: "Failed to fetch history" }); }
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
