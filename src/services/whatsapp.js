/**
 * DiagConnect — WhatsApp Service via Interakt BSP
 *
 * Provider  : Interakt (app.interakt.ai)
 * API Docs  : https://docs.interakt.ai/reference
 * Base URL  : https://api.interakt.ai/v1/public/message/
 *
 * Credentials:
 *   API Key (base64)      : enFxYjlKWVM1RXlxVm5YV09pYjY5X25fZkFDUXpJZVRjeVNXQUpRQy1Nazo=
 *   WABA ID               : 770697665918631
 *   Registered Phone      : +919735577182
 *   Phone Number ID       : +1 5559164731
 */

const https = require("https");

// ─── CREDENTIALS ──────────────────────────────────────────────────────────────
const INTERAKT_API_KEY   = process.env.INTERAKT_API_KEY
  || "enFxYjlKWVM1RXlxVm5YV09pYjY5X25fZkFDUXpJZVRjeVNXQUpRQy1Nazo=";

const WABA_ID            = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "770697665918631";
const REGISTERED_PHONE   = process.env.WHATSAPP_REGISTERED_PHONE    || "+919735577182";
const PHONE_NUMBER_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID      || "+1 5559164731";

const INTERAKT_BASE      = "api.interakt.ai";
const INTERAKT_PATH      = "/v1/public/message/";

// ─── CORE HTTP CALLER ─────────────────────────────────────────────────────────
function callInterakt(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: INTERAKT_BASE,
      path:     INTERAKT_PATH,
      method:   "POST",
      headers:  {
        "Authorization": `Basic ${INTERAKT_API_KEY}`,
        "Content-Type":  "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Interakt ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch {
          reject(new Error(`Interakt parse error: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── PARSE PHONE NUMBER ───────────────────────────────────────────────────────
// Interakt needs countryCode and phoneNumber split
function parsePhone(phone) {
  const clean = phone.replace(/[\s\-\(\)]/g, "");
  if (clean.startsWith("+91")) {
    return { countryCode: "+91", phoneNumber: clean.slice(3) };
  }
  if (clean.startsWith("91") && clean.length === 12) {
    return { countryCode: "+91", phoneNumber: clean.slice(2) };
  }
  if (clean.length === 10) {
    return { countryCode: "+91", phoneNumber: clean };
  }
  // Generic: first 2–3 digits as country code
  const match = clean.match(/^\+?(\d{1,3})(\d{7,12})$/);
  if (match) return { countryCode: `+${match[1]}`, phoneNumber: match[2] };
  return { countryCode: "+91", phoneNumber: clean.replace(/^\+91/, "") };
}

// ─── SEND PLAIN TEXT ──────────────────────────────────────────────────────────
async function sendText(to, text) {
  const { countryCode, phoneNumber } = parsePhone(to);
  return callInterakt({
    countryCode,
    phoneNumber,
    callbackData: "diagconnect_text",
    type:         "Text",
    data: {
      message: text,
    },
  });
}

// ─── SEND TEMPLATE ────────────────────────────────────────────────────────────
/**
 * @param {string}   to             - recipient phone e.g. "+919876543210"
 * @param {string}   templateName   - exact template name approved in Interakt
 * @param {string[]} bodyValues     - values for {{1}}, {{2}} etc in template body
 * @param {string[]} headerValues   - values for header variables (if any)
 * @param {Object[]} buttons        - button values (if template has buttons)
 */
async function sendTemplate(to, templateName, bodyValues = [], headerValues = [], buttons = []) {
  const { countryCode, phoneNumber } = parsePhone(to);
  return callInterakt({
    countryCode,
    phoneNumber,
    callbackData: "diagconnect_template",
    type:         "Template",
    template: {
      name:         templateName,
      languageCode: "en",
      headerValues,
      bodyValues,
      buttonValues: buttons,
    },
  });
}

// ─── SEND INTERACTIVE (simulated via text for Interakt) ───────────────────────
/**
 * Interakt handles interactive messages via templates.
 * For free-form bot conversations we send structured text with numbered options.
 */
async function sendInteractive(to, body, buttons) {
  const { countryCode, phoneNumber } = parsePhone(to);
  const btns = buttons.slice(0, 3);

  // Format as readable numbered list since Interakt free-form doesn't support
  // native interactive buttons outside templates
  const formatted = body + "\n\n"
    + btns.map((b, i) => `${i + 1}️⃣  ${b.title || b}`).join("\n");

  return callInterakt({
    countryCode,
    phoneNumber,
    callbackData: "diagconnect_interactive",
    type:         "Text",
    data: {
      message: formatted,
    },
  });
}

// ─── SEND DOCUMENT (PDF Report) ───────────────────────────────────────────────
async function sendDocument(to, docUrl, caption, filename) {
  const { countryCode, phoneNumber } = parsePhone(to);
  return callInterakt({
    countryCode,
    phoneNumber,
    callbackData: "diagconnect_report",
    type:         "Document",
    data: {
      mediaUrl: docUrl,
      caption:  caption  || "",
      filename: filename || "report.pdf",
    },
  });
}

// ─── SEND IMAGE ───────────────────────────────────────────────────────────────
async function sendImage(to, imageUrl, caption) {
  const { countryCode, phoneNumber } = parsePhone(to);
  return callInterakt({
    countryCode,
    phoneNumber,
    callbackData: "diagconnect_image",
    type:         "Image",
    data: {
      mediaUrl: imageUrl,
      caption:  caption || "",
    },
  });
}

// ─── BULK SEND (Campaigns) ────────────────────────────────────────────────────
async function bulkSend(recipients, buildMessage, delayMs = 1000) {
  const results = [];
  for (const r of recipients) {
    try {
      const payload = await buildMessage(r);
      const res     = await callInterakt(payload);
      results.push({ phone: r.phone, ok: true, res });
    } catch (e) {
      results.push({ phone: r.phone, ok: false, error: e.message });
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return results;
}

// ─── MARK AS READ (not supported by Interakt — no-op) ────────────────────────
async function markRead() {
  // Interakt handles read receipts automatically
}

// ─── WEBHOOK VERIFICATION ─────────────────────────────────────────────────────
function verifyWebhook(mode, token, challenge, verifyToken) {
  if (mode === "subscribe" && token === verifyToken) return challenge;
  return null;
}

function verifySignature() {
  return true;   // Interakt uses API key auth, not HMAC signatures
}

// ─── VERIFY API KEY ───────────────────────────────────────────────────────────
async function verifyToken() {
  // Send a test to ourselves (registered number) to verify the key works
  try {
    const { countryCode, phoneNumber } = parsePhone(REGISTERED_PHONE);
    await callInterakt({
      countryCode,
      phoneNumber,
      callbackData: "token_verify",
      type:         "Text",
      data: { message: "DiagConnect API key verified ✅" },
    });
    return { valid: true, provider: "Interakt", wabaId: WABA_ID };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ─── GREETING ─────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning! ☀️" : h < 17 ? "Good afternoon! 🌤" : "Good evening! 🌙";
}

// ─── SEND TEST MESSAGE ────────────────────────────────────────────────────────
async function sendTestMessage(toPhone) {
  return sendText(
    toPhone,
    `✅ *DiagConnect is LIVE!*\n\nInterakt WhatsApp bot connected successfully.\n\nWABA ID: ${WABA_ID}\nTimestamp: ${new Date().toLocaleString("en-IN")}\n\nSend *Hi* to start the patient booking flow. 🏥`
  );
}

// ─── DEFAULT SEND OBJECT ──────────────────────────────────────────────────────
const send = {
  text:        sendText,
  interactive: sendInteractive,
  document:    sendDocument,
  template:    sendTemplate,
  image:       sendImage,
  read:        markRead,
};

// ─── TEMPLATES (Interakt approved template names) ─────────────────────────────
const TEMPLATES = {
  appointmentConfirmed: (name, test, date, slot, ref) =>
    ({ name: "appointment_confirmed", bodyValues: [name, test, date, slot, ref] }),

  reminder24h: (name, test, slot, prep) =>
    ({ name: "appointment_reminder_24h", bodyValues: [name, test, slot, prep] }),

  reminder2h: (name, test, slot, address) =>
    ({ name: "appointment_reminder_2h", bodyValues: [name, test, slot, address] }),

  reportReady: (name, test) =>
    ({ name: "report_ready", bodyValues: [name, test] }),

  reviewRequest: (name, clinic) =>
    ({ name: "review_request", bodyValues: [name, clinic] }),

  noShowRecovery: (name, test) =>
    ({ name: "no_show_recovery", bodyValues: [name, test] }),

  paymentLink: (name, amount, link) =>
    ({ name: "payment_link", bodyValues: [name, `₹${amount}`, link] }),
};

module.exports = {
  sendText, sendInteractive, sendDocument, sendTemplate,
  sendImage, bulkSend, markRead,
  verifyWebhook, verifySignature,
  verifyToken, sendTestMessage,
  greeting, parsePhone, send,
  TEMPLATES,
  INTERAKT_API_KEY, WABA_ID, REGISTERED_PHONE, PHONE_NUMBER_ID,
  WA_PHONE_ID: PHONE_NUMBER_ID,  // backward compat alias
};
