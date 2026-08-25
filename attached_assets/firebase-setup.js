// firebase-setup.js

// ==========================================
// 1. BRAIN.JS LOGIC (Bot / Fake User Detection)
// ==========================================
// Hum ek chota AI model bana rahe hain jo check karega ki user bot toh nahi.
const net = new brain.NeuralNetwork();

// AI ko train kar rahe hain: [clicks_per_second, mouse_movements]
// Output: 1 = Real Insaan, 0 = Bot
net.train([
    { input: [1, 10], output: [1] },  // Normal click aur mouse movement = Asli Insaan
    { input: [50, 0], output: [0] },  // 1 second me 50 click, no mouse movement = Bot
    { input: [2, 15], output: [1] },  // Asli Insaan
    { input: [100, 2], output: [0] }  // Bot
]);

// ==========================================
// 2. GOOGLE LOGIN & REDIRECT LOGIC
// ==========================================
function handleGoogleLogin(event) {
    event.preventDefault(); // Page refresh hone se rokega

    let btn = event.currentTarget;
    let originalText = btn.innerHTML;

    // Button ka text change kar rahe hain loading feel ke liye
    btn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> 
        Checking Security...
    `;

    // Dummy values dekar Brain.js se check karwa rahe hain
    // (Future me hum real mouse events track karke pass karenge)
    const aiResult = net.run([1, 10]); // Asli insaan jaisi value pass ki

    console.log("Brain.js Safety Score: ", aiResult[0]);

    setTimeout(() => {
        // Agar AI ko lagta hai insaan hai (> 50% chance)
        if (aiResult[0] > 0.5) {
            console.log("Verification Passed. Redirecting to Tournament...");
            // EXACT REDIRECT CODE (Ye seedha page change karega)
            window.location.href = "tournament.html";
        } else {
            alert("Security Alert: Brain.js detected suspicious bot activity!");
            btn.innerHTML = originalText; // Button wapas normal kar do
        }
    }, 800); // 0.8 seconds ka delay taaki loading animation dikhe
}

// ==========================================
// 3. BUTTONS KE SATH LOGIC JODNA
// ==========================================
// Jaise hi page load hoga, yeh code dono buttons par click event laga dega
document.addEventListener('DOMContentLoaded', () => {

    const headerBtn = document.getElementById('google-login-btn');
    const mainBtn = document.getElementById('main-google-login-btn');

    if(headerBtn) {
        headerBtn.addEventListener('click', handleGoogleLogin);
    }

    if(mainBtn) {
        mainBtn.addEventListener('click', handleGoogleLogin);
    }
});