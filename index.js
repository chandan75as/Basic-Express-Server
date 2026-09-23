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


// ========================================================
// 🚀 1. MATCH JOIN RULE (VIP = 40% Bonus, Normal = 10% Bonus)
// ========================================================
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
    let isVIP = userData.isVIP || false;     // VIP Check

    // VIP hai toh 40% bonus use hoga, nahi toh 10%
    let bonusPercentage = isVIP ? 0.40 : 0.10;
    let maxBonusAllowed = entryFee * bonusPercentage; 
    
    let bonusToUse = Math.min(maxBonusAllowed, bonusBal);
    let depositToUse = entryFee - bonusToUse;

    if (depositBal < depositToUse) return res.status(400).json({ error: "Insufficient Deposit Balance!" });

    // Update Balance
    await userRef.update({
      balance: depositBal - depositToUse,
      bonusBal: bonusBal - bonusToUse
    });

    // Transaction Save
    await userRef.collection("transactions").add({
      title: `Joined: ${matchName || 'Tournament'}`,
      amount: `-🪙 ${entryFee}`,
      type: "debit",
      date: new Date().toISOString()
    });

    res.json({ success: true, message: "Match Joined!", deductedFromDeposit: depositToUse, deductedFromBonus: bonusToUse });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});


// ========================================================
// 💸 2. WITHDRAW RULE (VIP = 60% Bonus, Upline Gets 10%)
// ========================================================
app.post("/api/withdraw", async (req, res) => {
  const { uid, withdrawAmount } = req.body;
  if (!uid || !withdrawAmount) return res.status(400).json({ error: "Data missing" });

  try {
    const userRef = db.collection("users").doc(uid);
    
    await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error("User nahi mila");

        let userData = userDoc.data();
        let withdrawalBal = userData.withdrawalBal || 0; 
        let bonusBal = userData.bonusBal || 0;           
        let isVIP = userData.isVIP || false;

        // VIP hai toh 60% Bonus katega, Normal ka 40% Bonus katega
        let bonusRatio = isVIP ? 0.60 : 0.40;
        let winningRatio = isVIP ? 0.40 : 0.60;

        let bonusToDeduct = withdrawAmount * bonusRatio;
        let winningToDeduct = withdrawAmount * winningRatio;

        if (bonusBal < bonusToDeduct || withdrawalBal < winningToDeduct) {
          throw new Error("Insufficient Balance for this ratio!");
        }

        // 1. User ka Paisa Kato
        t.update(userRef, {
          withdrawalBal: withdrawalBal - winningToDeduct,
          bonusBal: bonusBal - bonusToDeduct
        });

        t.set(userRef.collection("transactions").doc(), {
          title: "Funds Withdrawn",
          amount: `-🪙 ${withdrawAmount}`,
          type: "withdraw",
          date: new Date().toISOString()
        });

        // 2. 🚀 SPONSOR KO 10% COMMISSION DO (Agar Sponsor hai toh)
        if (userData.sponsorUid) {
            const sponsorRef = db.collection("users").doc(userData.sponsorUid);
            const sponsorDoc = await t.get(sponsorRef);
            
            if (sponsorDoc.exists) {
                let commission = withdrawAmount * 0.10;
                t.update(sponsorRef, {
                    withdrawalBal: (sponsorDoc.data().withdrawalBal || 0) + commission
                });
                t.set(sponsorRef.collection("transactions").doc(), {
                    title: "Downline Withdrawal Bonus",
                    amount: `+🪙 ${commission}`,
                    type: "credit",
                    date: new Date().toISOString()
                });
            }
        }
    });

    res.json({ success: true, message: "Withdrawal Successful!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ========================================================
// 🔎 3. VERIFY SPONSOR CODE
// ========================================================
app.post("/api/verify-sponsor", async (req, res) => {
    const { sponsorCode } = req.body;
    try {
        const snapshot = await db.collection("users").where("referralCode", "==", sponsorCode).get();
        if (snapshot.empty) return res.status(404).json({ error: "Invalid Referral Code" });

        let sponsorDoc = snapshot.docs[0];
        res.json({ success: true, sponsorName: sponsorDoc.data().name, sponsorUid: sponsorDoc.id });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});


// ========================================================
// 🤝 4. APPLY REFERRAL (Lock Upline & Give 10 Bonus)
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

            if (!userDoc.exists || !sponsorDoc.exists) throw new Error("Account issue");
            
            let userData = userDoc.data();
            if (userData.sponsorUid) throw new Error("Aap pehle se refer ho chuke ho!");

            let sponsorData = sponsorDoc.data();
            let l2SponsorUid = sponsorData.sponsorUid || null; // Sponsor ka bhi koi sponsor hai toh usko L2 banao

            // 1. Lock Sponsor & Give 10 Bonus to User
            t.update(userRef, {
                sponsorUid: sponsorUid,
                l2SponsorUid: l2SponsorUid,
                bonusBal: (userData.bonusBal || 0) + 10
            });

            t.set(userRef.collection("transactions").doc(), {
                title: "Referral Applied",
                amount: "+🪙 10",
                type: "credit",
                date: new Date().toISOString()
            });
        });

        res.json({ success: true, message: "Code Locked! 10 Bonus added." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ========================================================
// 🔥 5. ID ACTIVATION (250 Coins -> 150 L1, 50 L2)
// ========================================================
app.post("/api/activate-vip", async (req, res) => {
    const { uid } = req.body;
    try {
        await db.runTransaction(async (t) => {
            const userRef = db.collection("users").doc(uid);
            const userDoc = await t.get(userRef);
            if (!userDoc.exists) throw new Error("User nahi mila");

            let userData = userDoc.data();
            if (userData.isVIP) throw new Error("Aapki ID pehle se Active hai!");

            let depositBal = userData.balance || 0;
            if (depositBal < 250) throw new Error("Insufficient Balance. 250 coins chahiye.");

            // 1. User se 250 Kato aur VIP banao
            t.update(userRef, {
                balance: depositBal - 250,
                isVIP: true
            });

            t.set(userRef.collection("transactions").doc(), {
                title: "VIP ID Activation",
                amount: "-🪙 250",
                type: "debit",
                date: new Date().toISOString()
            });

            // 2. Level 1 Sponsor ko 150 Winnings do
            if (userData.sponsorUid) {
                const l1Ref = db.collection("users").doc(userData.sponsorUid);
                const l1Doc = await t.get(l1Ref);
                if (l1Doc.exists) {
                    t.update(l1Ref, { withdrawalBal: (l1Doc.data().withdrawalBal || 0) + 150 });
                    t.set(l1Ref.collection("transactions").doc(), {
                        title: "Level 1 VIP Commission",
                        amount: "+🪙 150",
                        type: "credit",
                        date: new Date().toISOString()
                    });
                }
            }

            // 3. Level 2 Sponsor ko 50 Winnings do
            if (userData.l2SponsorUid) {
                const l2Ref = db.collection("users").doc(userData.l2SponsorUid);
                const l2Doc = await t.get(l2Ref);
                if (l2Doc.exists) {
                    t.update(l2Ref, { withdrawalBal: (l2Doc.data().withdrawalBal || 0) + 50 });
                    t.set(l2Ref.collection("transactions").doc(), {
                        title: "Level 2 VIP Commission",
                        amount: "+🪙 50",
                        type: "credit",
                        date: new Date().toISOString()
                    });
                }
            }
        });

        res.json({ success: true, message: "ID Activated successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ========================================================
// 📜 TRANSACTIONS FETCH KARTA HAI
// ========================================================
app.post("/api/get-transactions", async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: "UID missing" });

  try {
    const txSnapshot = await db.collection("users").doc(uid).collection("transactions")
                               .orderBy("date", "desc").limit(15).get();
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
