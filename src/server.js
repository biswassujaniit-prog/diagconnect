/**
 * DiagConnect — Production Express Server
 * Credentials: All wired via environment / services
 */

require("dotenv").config();
const express       = require("express");
const cors          = require("cors");
const helmet        = require("helmet");
const rateLimit     = require("express-rate-limit");
const multer        = require("multer");
const crypto        = require("crypto");
const bcrypt        = require("bcryptjs");
const jwt           = require("jsonwebtoken");
const { Resend }    = require("resend");

const waService     = require("./services/whatsapp");
const { WA_PHONE_ID } = waService;
const rzpService    = require("./services/razorpay");
const r2Service     = require("./services/storage");
const { handleIncomingMessage, sendReminder24h, sendReminder2h, sendNoShowRecovery } = require("./services/botEngine");
const { handleIncomingReport, startReportPolling } = require("./services/reportSync");
const { getSlotAvailability, bookSlot, cancelSlot } = require("./services/slotManager");

const app    = express();
const resend = new Resend(process.env.RESEND_API_KEY || "re_4T3Y7pA7_BU2BSC6MMT2aNz962chsBbiQ");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── SECURITY ─────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    /\.railway\.app$/,
    /\.diagconnect\.in$/,
  ],
  credentials: true,
}));

// ─── RATE LIMITS ──────────────────────────────────────────────────────────────
const limiter     = rateLimit({ windowMs: 15*60*1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 60*60*1000, max: 15  });
app.use(limiter);

// ─── RAW BODY for webhook signature verification ──────────────────────────────
app.use("/api/webhooks/whatsapp", express.raw({ type: "*/*" }));
app.use("/api/webhooks/razorpay", express.raw({ type: "*/*" }));
app.use("/api/reports/incoming",  express.raw({ type: "*/*" }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  const r2 = await r2Service.testConnection();
  res.json({
    status:   "ok",
    version:  "1.0.0",
    env:      process.env.NODE_ENV,
    services: {
      r2:        r2.ok ? "connected" : "error",
      whatsapp:  `configured (phoneId: ${WA_PHONE_ID})`,
      razorpay:  "configured",
      resend:    "configured",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "diagconnect_jwt_secret_replace_in_prod";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Stub in-memory store (replace with Prisma in full deployment)
const db = {
  tenants:  new Map(),
  users:    new Map(),
  appts:    new Map(),
  reports:  new Map(),
  tests:    new Map(),
};

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password, clinicSlug } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    // TODO: replace with Prisma lookup
    const token = signToken({ email, role: "OWNER", tenantId: clinicSlug || "demo" });
    res.json({ token, user: { email, role: "OWNER" } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
app.post("/api/onboard", upload.fields([
  { name: "gst", maxCount: 1 }, { name: "pan", maxCount: 1 },
  { name: "clinicReg", maxCount: 1 }, { name: "ownerAadhaar", maxCount: 1 },
]), async (req, res) => {
  try {
    const { clinicName, ownerName, email, phone, whatsapp, address, city, pincode } = req.body;
    const tenantId = clinicName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32);

    // Upload KYC docs to R2
    const kycKeys = {};
    for (const [docType, files] of Object.entries(req.files || {})) {
      if (files?.[0]) {
        kycKeys[docType] = await r2Service.uploadKycDoc(
          files[0].buffer, tenantId, docType, files[0].originalname
        );
      }
    }

    // Send welcome email via Resend
    await resend.emails.send({
      from:    process.env.FROM_EMAIL || "DiagConnect <noreply@diagconnect.in>",
      to:      [email],
      subject: `Welcome to DiagConnect — ${clinicName}`,
      html:    `<p>Hi ${ownerName},</p><p>Your clinic <strong>${clinicName}</strong> is now registered on DiagConnect. KYC documents have been received and will be reviewed within 24 hours.</p><p>Once approved, your WhatsApp bot goes live.</p>`,
    });

    res.json({ success: true, tenantId, message: "Onboarding submitted. KYC review within 24 hours." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SLOTS ────────────────────────────────────────────────────────────────────
app.get("/api/slots/:tenantId", auth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { date } = req.query;
    const slots = await getSlotAvailability(tenantId, date || new Date().toISOString().split("T")[0]);
    res.json(slots);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/slots/book", auth, async (req, res) => {
  try {
    const { tenantId, patientId, testId, date, slot, source } = req.body;
    const appt = await bookSlot(tenantId, patientId, testId, date, slot, source);
    res.json(appt);
  } catch (e) {
    if (e.message.startsWith("SLOT_FULL")) return res.status(409).json({ error: "Slot full", code: "SLOT_FULL" });
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/slots/cancel/:id", auth, async (req, res) => {
  try {
    const appt = await cancelSlot(req.params.id, req.body.reason);
    res.json(appt);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TEST CATALOG ─────────────────────────────────────────────────────────────
app.post("/api/tests/upload", auth, upload.single("file"), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const key = await r2Service.uploadTestMaster(req.file.buffer, tenantId, req.file.originalname);

    // Parse CSV
    const csv = req.file.buffer.toString("utf8");
    const rows = csv.split("\n").slice(1).filter(Boolean).map(line => {
      const [code, name, category, price, sampleType, prep, tat] = line.split(",").map(s => s?.trim());
      return { code, name, category, price: parseFloat(price) || 0, sampleType, prep, tat };
    }).filter(r => r.code && r.name);

    // TODO: upsert into DB with Prisma
    res.json({ success: true, r2Key: key, testsImported: rows.length, tests: rows.slice(0, 5) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tests/:tenantId", async (req, res) => {
  // TODO: fetch from DB; return master catalog
  res.json({ tests: [] });
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
// Manual upload by staff → verify identity → upload to R2 → WhatsApp delivery
app.post("/api/reports/upload", auth, upload.single("pdf"), async (req, res) => {
  try {
    const { appointmentRef, patientPhone, testCode } = req.body;
    const tenantId = req.user.tenantId;

    if (!req.file) return res.status(400).json({ error: "PDF file required" });

    const reportId = `RPT_${Date.now()}_${Math.random().toString(36).slice(2,7).toUpperCase()}`;

    // TODO: look up appointment in DB by ref + phone for 3-factor check
    // For now: upload and queue for delivery
    const { key, checksum } = await r2Service.uploadReport(req.file.buffer, {
      tenantId,
      patientId:  "patient_id_from_db",   // from DB lookup
      reportId,
      testCode,
      date:       new Date(),
    });

    // Deliver via WhatsApp if phoneNumberId is configured
    if (process.env.WHATSAPP_PHONE_NUMBER_ID) {
      const url = await r2Service.presignedUrl(key);
      await waService.sendDocument(
        process.env.WHATSAPP_PHONE_NUMBER_ID,
        patientPhone,
        url,
        `📄 Your *${testCode}* report is ready. Ref: ${appointmentRef}. Download link valid for 24 hours.`,
        `${testCode}_report.pdf`,
      );
    }

    res.json({ success: true, reportId, r2Key: key, checksum });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook from LIS/LIMS — auto-deliver when report is ready in lab system
app.post("/api/reports/incoming", async (req, res) => {
  const sig    = req.headers["x-diagconnect-signature"];
  const secret = process.env.REPORT_WEBHOOK_SECRET || "dc_report_hook_secret_2026";
  const body   = req.body;

  // Verify HMAC
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (sig && sig !== expected) return res.status(403).json({ error: "Invalid signature" });

  res.sendStatus(200);   // respond immediately

  try {
    const payload    = JSON.parse(body.toString());
    const { tenantId, appointmentRef, patientPhone, testCode, pdfBase64, pdfUrl } = payload;

    let pdfBuffer;
    if (pdfBase64) {
      pdfBuffer = Buffer.from(pdfBase64, "base64");
    } else if (pdfUrl) {
      const https   = require("https");
      pdfBuffer = await new Promise((resolve, reject) => {
        https.get(pdfUrl, r => {
          const chunks = [];
          r.on("data", c => chunks.push(c));
          r.on("end",  () => resolve(Buffer.concat(chunks)));
          r.on("error", reject);
        });
      });
    } else {
      throw new Error("No PDF provided in webhook payload");
    }

    await handleIncomingReport(tenantId, { appointmentRef, patientPhone, testCode, fileName: `${testCode}_report.pdf` }, pdfBuffer);
  } catch (e) {
    console.error("Incoming report error:", e.message);
  }
});

// ─── WHATSAPP TEST ENDPOINT ───────────────────────────────────────────────────
// Call: POST /api/test-whatsapp  { "to": "+919876543210" }
app.post("/api/test-whatsapp", auth, async (req, res) => {
  try {
    const to = req.body.to;
    if (!to) return res.status(400).json({ error: "Provide 'to' phone number" });
    const result = await waService.sendTestMessage(to);
    res.json({ success: true, messageId: result?.messages?.[0]?.id, phoneNumberId: WA_PHONE_ID });
  } catch (e) {
    res.status(500).json({ error: e.message, detail: "Check WHATSAPP_ACCESS_TOKEN and Phone Number ID" });
  }
});

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
app.post("/api/payments/create-order", auth, async (req, res) => {
  try {
    const { amount, appointmentRef, testName } = req.body;
    const order = await rzpService.createOrder({
      amount,
      receipt: appointmentRef,
      notes:   { testName, source: "diagconnect" },
    });
    res.json({ ...order, keyId: rzpService.RZP_KEY });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/payments/create-link", auth, async (req, res) => {
  try {
    const { amount, description, customerName, customerPhone, customerEmail, referenceId } = req.body;
    const link = await rzpService.createPaymentLink({
      amount, description, customerName, customerPhone, customerEmail, referenceId,
      notifyWhatsApp: true,
    });
    res.json(link);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/payments/verify", auth, (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  const valid = rzpService.verifyPaymentSignature(orderId, paymentId, signature);
  if (valid) {
    // TODO: update appointment payment status in DB
    res.json({ verified: true });
  } else {
    res.status(400).json({ verified: false, error: "Signature mismatch" });
  }
});

// Razorpay webhook (payment events)
app.post("/api/webhooks/razorpay", async (req, res) => {
  const sig   = req.headers["x-razorpay-signature"];
  const valid = rzpService.verifyWebhookSignature(req.body, sig);
  if (!valid) return res.status(403).json({ error: "Invalid signature" });

  res.sendStatus(200);

  const event = JSON.parse(req.body.toString());
  const { event: eventName, payload } = event;

  console.log("Razorpay event:", eventName);

  if (eventName === "payment.captured") {
    const { payment } = payload;
    // TODO: mark appointment as paid in DB
    // Send confirmation WhatsApp if phoneNumberId set
    if (process.env.WHATSAPP_PHONE_NUMBER_ID && payment.entity?.contact) {
      await waService.sendText(
        process.env.WHATSAPP_PHONE_NUMBER_ID,
        payment.entity.contact,
        `✅ Payment of ₹${(payment.entity.amount/100).toFixed(0)} received for your appointment.\n\nRef: ${payment.entity.notes?.referenceId || payment.entity.id}\n\nThank you! See you at your appointment. 🙏`
      ).catch(console.error);
    }
  }

  if (eventName === "payment.failed") {
    console.warn("Payment failed:", payload.payment?.entity?.id);
  }
});

// ─── WHATSAPP WEBHOOK ─────────────────────────────────────────────────────────
app.get("/api/webhooks/whatsapp", (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "diagconnect_webhook_verify_2026";
  const result = waService.verifyWebhook(
    req.query["hub.mode"],
    req.query["hub.verify_token"],
    req.query["hub.challenge"],
    verifyToken,
  );
  if (result) { console.log("✅ WhatsApp webhook verified"); return res.send(result); }
  res.sendStatus(403);
});

app.post("/api/webhooks/whatsapp", async (req, res) => {
  res.sendStatus(200);   // always respond 200 to Meta within 5s

  const sig    = req.headers["x-hub-signature-256"];
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret && !waService.verifySignature(req.body, sig, secret)) {
    return console.warn("WhatsApp signature verification failed");
  }

  try {
    const body = JSON.parse(req.body.toString());
    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;

        // Handle status updates (delivered, read)
        for (const status of value.statuses || []) {
          if (["delivered","read"].includes(status.status)) {
            // TODO: update report delivery status in DB
            console.log(`Message ${status.id} ${status.status}`);
          }
        }

        // Handle incoming messages
        for (const msg of value.messages || []) {
          const phoneId = value.metadata?.phone_number_id;
          const contact = (value.contacts || []).find(c => c.wa_id === msg.from) || { wa_id: msg.from };

          // TODO: look up tenant by phoneId from DB
          // For now, use a stub tenant
          const tenant = {
            id:          "kharghar",
            name:        "Kharghar Diagnostics",
            plan:        "PRO",
            wabaPhoneId: phoneId,
            open:        "08:00",
            close:       "20:00",
            addr:        "Sector 15, Kharghar, Navi Mumbai",
          };

          handleIncomingMessage(tenant, msg, contact, waService).catch(e =>
            console.error("Bot engine error:", e.message)
          );
        }
      }
    }
  } catch (e) {
    console.error("WhatsApp webhook parse error:", e.message);
  }
});

// ─── CAMPAIGN ─────────────────────────────────────────────────────────────────
app.post("/api/campaigns/send", auth, async (req, res) => {
  try {
    const { recipients, templateName, getComponents } = req.body;
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
      return res.status(400).json({ error: "WhatsApp not configured" });
    }
    // Bulk send with 500ms delay between messages (Meta rate limit)
    const results = await waService.bulkSend(
      process.env.WHATSAPP_PHONE_NUMBER_ID,
      recipients,
      async (r) => {
        await waService.sendTemplate(
          process.env.WHATSAPP_PHONE_NUMBER_ID,
          r.phone,
          templateName,
          "en",
          r.components || [],
        );
        return { ok: true };
      },
      500,
    );
    res.json({ sent: results.filter(r=>r.ok).length, failed: results.filter(r=>!r.ok).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SUBSCRIPTION / PLANS ─────────────────────────────────────────────────────
app.post("/api/billing/upgrade", auth, async (req, res) => {
  try {
    const { plan, clinicName } = req.body;
    const order = await rzpService.createSubscriptionOrder(plan, clinicName, req.user.email);
    res.json({ ...order, keyId: rzpService.RZP_KEY });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", ref: Date.now() });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function start() {
  // Init R2 bucket
  await r2Service.initBucket().catch(e => console.warn("R2 init:", e.message));

  // Start LIS polling (if configured)
  startReportPolling();

  // Verify WhatsApp token
  const wa = await waService.verifyToken();
  if (wa.valid) {
    console.log(`✅ WhatsApp token valid (account: ${wa.name || wa.id})`);
  } else {
    console.warn(`⚠️  WhatsApp token check: ${wa.error}`);
    console.warn("   → Add WHATSAPP_PHONE_NUMBER_ID to .env after registering number in Meta Business Manager");
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 DiagConnect API live → http://localhost:${PORT}`);
    console.log(`   R2   : ${process.env.R2_ENDPOINT?.slice(0,50)}...`);
    console.log(`   Resend: configured`);
    console.log(`   Razorpay: ${rzpService.RZP_KEY.slice(0,12)}...`);
    console.log(`   WhatsApp : Phone ID ${WA_PHONE_ID} ✅\n`);
  });
}

start().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
