/**
 * DiagConnect — Interakt WhatsApp Test
 * Run: node test-whatsapp.js
 *
 * Sends a real WhatsApp message via Interakt to verify integration.
 */

const https = require("https");

// ─── CREDENTIALS ──────────────────────────────────────────────────────────────
const API_KEY = "enFxYjlKWVM1RXlxVm5YV09pYjY5X25fZkFDUXpJZVRjeVNXQUpRQy1Nazo=";
const TO      = process.argv[2] || "+919735577182";   // default to your registered number

const { countryCode, phoneNumber } = parsePhone(TO);

function parsePhone(phone) {
  const clean = phone.replace(/[\s\-\(\)]/g, "");
  if (clean.startsWith("+91")) return { countryCode: "+91", phoneNumber: clean.slice(3) };
  if (clean.length === 10)     return { countryCode: "+91", phoneNumber: clean };
  return { countryCode: "+91", phoneNumber: clean.replace(/^\+91/, "") };
}

const payload = {
  countryCode,
  phoneNumber,
  callbackData: "diagconnect_test",
  type: "Text",
  data: {
    message: `✅ *DiagConnect WhatsApp Bot is LIVE!*\n\nInterakt integration verified.\nWABA ID: 770697665918631\nTime: ${new Date().toLocaleString("en-IN")}\n\nSend *Hi* to start the patient booking flow. 🏥`
  }
};

const body    = JSON.stringify(payload);
const options = {
  hostname: "api.interakt.ai",
  path:     "/v1/public/message/",
  method:   "POST",
  headers:  {
    "Authorization":  `Basic ${API_KEY}`,
    "Content-Type":   "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

console.log("\n📱 Sending test message via Interakt...");
console.log(`   To      : ${TO}`);
console.log(`   Country : ${countryCode}`);
console.log(`   Number  : ${phoneNumber}`);
console.log(`   API Key : ${API_KEY.slice(0, 20)}...\n`);

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    try {
      const r = JSON.parse(data);
      if (res.statusCode === 200 || r.result === true) {
        console.log("✅ SUCCESS! Message sent via Interakt.");
        console.log("   Check WhatsApp on +919735577182\n");
        console.log("🎉 Your DiagConnect WhatsApp bot is LIVE!\n");
      } else {
        console.log("❌ FAILED. Interakt response:");
        console.log(JSON.stringify(r, null, 2));
        console.log("\n💡 Fixes:");
        console.log("   - Check API key at app.interakt.ai → Settings → Developer Settings");
        console.log("   - Make sure the number is registered on your Interakt account");
        console.log("   - Ensure your Interakt plan is active\n");
      }
    } catch {
      console.log("Raw response:", data);
    }
  });
});

req.on("error", e => {
  console.error("❌ Network error:", e.message);
  console.log("   Check your internet connection");
});

req.write(body);
req.end();
