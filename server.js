/**
 * DiagConnect — Production Express Server
 * All credentials loaded from environment variables.
 */
require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const multer       = require("multer");
const crypto       = require("crypto");
const jwt          = require("jsonwebtoken");
const { Resend }   = require("resend");

// ── Services ─────────────────────────────────────────────────────────────────
const waService       = require("./services/whatsapp");
const rzpService      = require("./services/razorpay");
const r2Service       = require("./services/storage");
const { handleIncomingMessage } = require("./services/botEngine");
const { handleIncomingReport, startReportPolling } = require("./services/reportSync");
const { getSlotAvailability, bookSlot, cancelSlot } = require("./services/slotManager");

// ── App setup ─────────────────────────────────────────────────────────────────
const app    = express();
const resend = new Resend(process.env.RESEND_API_KEY || "re_4T3Y7pA7_BU2BSC6MMT2aNz962chsBbiQ");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    /\.railway\.app$/, /\.railway\.com$/, /\.diagconnect\.in$/,
  ],
  credentials: true,
}));
app.use(rateLimit({ windowMs: 15*60*1000, max: 300 }));

// Raw body for webhook signature verification
app.use("/api/webhooks/whatsapp", express.raw({ type: "*/*" }));
app.use("/api/webhooks/razorpay", express.raw({ type: "*/*" }));
app.use("/api/reports/incoming",  express.raw({ type: "*/*" }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || "diagconnect_jwt_secret_2026";

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  let r2Status = "unknown";
  try { const r = await r2Service.testConnection(); r2Status = r.ok ? "connected" : "error"; } catch { r2Status = "error"; }
  res.json({
    status:    "ok",
    version:   "1.0.0",
    env:       process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    services: {
      r2:       r2Status,
      whatsapp: process.env.INTERAKT_API_KEY ? "configured" : "missing_key",
      razorpay: process.env.RAZORPAY_KEY_ID  ? "configured" : "missing_key",
      resend:   process.env.RESEND_API_KEY   ? "configured" : "missing_key",
      database: process.env.DATABASE_URL     ? "configured" : "missing_url",
    },
  });
});

// ── Root ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ name: "DiagConnect API", status: "live", docs: "/health" });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}
function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}

app.post("/api/auth/login", rateLimit({ windowMs: 60*60*1000, max: 15 }), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const token = signToken({ email, role: "OWNER", tenantId: "demo" });
    res.json({ token, user: { email, role: "OWNER" } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Onboarding ────────────────────────────────────────────────────────────────
app.post("/api/onboard",
  upload.fields([{ name:"gst",maxCount:1 },{ name:"pan",maxCount:1 },{ name:"clinicReg",maxCount:1 },{ name:"ownerAadhaar",maxCount:1 }]),
  async (req, res) => {
    try {
      const { clinicName, ownerName, email, phone } = req.body;
      if (!clinicName || !email) return res.status(400).json({ error: "clinicName and email required" });
      const tenantId = clinicName.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").slice(0,32);
      // Upload KYC docs to R2
      for (const [docType, files] of Object.entries(req.files || {})) {
        if (files?.[0]) {
          await r2Service.uploadKycDoc(files[0].buffer, tenantId, docType, files[0].originalname).catch(e => console.warn("KYC upload:", e.message));
        }
      }
      // Welcome email
      await resend.emails.send({
        from: process.env.FROM_EMAIL || "DiagConnect <noreply@diagconnect.in>",
        to: [email],
        subject: `Welcome to DiagConnect — ${clinicName}`,
        html: `<p>Hi ${ownerName},</p><p><strong>${clinicName}</strong> is registered. KYC review within 24 hours.</p>`,
      }).catch(e => console.warn("Welcome email:", e.message));
      res.json({ success: true, tenantId, message: "Onboarding submitted. Review within 24 hours." });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
);

// ── Slots ─────────────────────────────────────────────────────────────────────
app.get("/api/slots/:tenantId", async (req, res) => {
  try {
    const date  = req.query.date || new Date().toISOString().split("T")[0];
    const slots = await getSlotAvailability(req.params.tenantId, date);
    res.json(slots);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/slots/book", auth, async (req, res) => {
  try {
    const { tenantId, patientId, testId, date, slot, source } = req.body;
    const appt = await bookSlot(tenantId, patientId || "guest", testId, date, slot, source);
    res.json(appt);
  } catch (e) {
    if (e.message?.includes("SLOT_FULL")) return res.status(409).json({ error: "Slot full", code: "SLOT_FULL" });
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/slots/cancel/:id", auth, async (req, res) => {
  try { res.json(await cancelSlot(req.params.id, req.body.reason)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Test catalog upload ───────────────────────────────────────────────────────
app.post("/api/tests/upload", auth, upload.single("file"), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const key      = await r2Service.uploadTestMaster(req.file.buffer, tenantId, req.file.originalname);
    const csv      = req.file.buffer.toString("utf8");
    const rows     = csv.split("\n").slice(1).filter(Boolean).map(line => {
      const [code, name, category, price, sampleType, prep, tat] = line.split(",").map(s => s?.trim());
      return { code, name, category, price: parseFloat(price) || 0, sampleType, prep, tat };
    }).filter(r => r.code && r.name);
    res.json({ success: true, r2Key: key, testsImported: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Reports ───────────────────────────────────────────────────────────────────
app.post("/api/reports/upload", auth, upload.single("pdf"), async (req, res) => {
  try {
    const { appointmentRef, patientPhone, testCode } = req.body;
    const tenantId = req.user.tenantId;
    if (!req.file) return res.status(400).json({ error: "PDF required" });
    const reportId = `RPT_${Date.now()}_${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    const { key, checksum } = await r2Service.uploadReport(req.file.buffer, {
      tenantId, patientId: patientPhone || "unknown", reportId, testCode, date: new Date(),
    });
    const downloadUrl = await r2Service.presignedUrl(key);
    // Send via WhatsApp if phone provided
    if (patientPhone) {
      await waService.sendDocument(patientPhone, downloadUrl,
        `📄 Your *${testCode || "test"}* report is ready.\nRef: ${appointmentRef}\n\n_Download link valid 24 hours._`,
        `${testCode || "report"}.pdf`
      ).catch(e => console.warn("WhatsApp send:", e.message));
    }
    res.json({ success: true, reportId, r2Key: key, checksum });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// LIS webhook — lab system calls this when report is ready
app.post("/api/reports/incoming", async (req, res) => {
  const sig    = req.headers["x-diagconnect-signature"];
  const secret = process.env.REPORT_WEBHOOK_SECRET || "dc_report_hook_secret_2026";
  if (sig) {
    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    if (sig !== expected) return res.status(403).json({ error: "Invalid signature" });
  }
  res.sendStatus(200); // respond immediately
  try {
    const payload = JSON.parse(req.body.toString());
    const { tenantId, appointmentRef, patientPhone, testCode, pdfBase64 } = payload;
    if (!pdfBase64) throw new Error("No PDF data in webhook payload");
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    await handleIncomingReport(tenantId || "demo", { appointmentRef, patientPhone, testCode, fileName:`${testCode}_report.pdf` }, pdfBuffer);
  } catch (e) { console.error("Incoming report error:", e.message); }
});

// ── Payments ──────────────────────────────────────────────────────────────────
app.post("/api/payments/create-order", auth, async (req, res) => {
  try {
    const { amount, appointmentRef, testName } = req.body;
    const order = await rzpService.createOrder({ amount, receipt: appointmentRef, notes: { testName } });
    res.json({ ...order, keyId: rzpService.RZP_KEY });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payments/create-link", auth, async (req, res) => {
  try {
    const link = await rzpService.createPaymentLink(req.body);
    res.json(link);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payments/verify", auth, (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  const valid = rzpService.verifyPaymentSignature(orderId, paymentId, signature);
  res.json({ verified: valid });
});

// Razorpay webhook
app.post("/api/webhooks/razorpay", async (req, res) => {
  const sig   = req.headers["x-razorpay-signature"];
  if (!rzpService.verifyWebhookSignature(req.body, sig)) return res.status(403).json({ error: "Invalid signature" });
  res.sendStatus(200);
  try {
    const event = JSON.parse(req.body.toString());
    console.log("Razorpay event:", event.event);
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment?.contact) {
        await waService.sendText(payment.contact,
          `✅ Payment of ₹${(payment.amount/100).toFixed(0)} received.\nRef: ${payment.notes?.referenceId || payment.id}\n\nThank you! See you at your appointment. 🙏`
        ).catch(e => console.warn("Payment WA notification:", e.message));
      }
    }
  } catch (e) { console.error("Razorpay webhook error:", e.message); }
});

// ── WhatsApp Webhook ──────────────────────────────────────────────────────────
app.get("/api/webhooks/whatsapp", (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "diagconnect_webhook_verify_2026";
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === verifyToken) {
    console.log("WhatsApp webhook verified ✅");
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

app.post("/api/webhooks/whatsapp", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = JSON.parse(req.body.toString());
    if (body.object !== "whatsapp_business_account") return;
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        for (const msg of value.messages || []) {
          const contact = (value.contacts || []).find(c => c.wa_id === msg.from) || { wa_id: msg.from };
          const tenant = {
            id:    process.env.DEFAULT_TENANT_ID || "demo",
            name:  process.env.CLINIC_NAME || "DiagConnect Clinic",
            open:  process.env.CLINIC_OPEN  || "08:00",
            close: process.env.CLINIC_CLOSE || "20:00",
            addr:  process.env.CLINIC_ADDR  || "Navi Mumbai",
          };
          handleIncomingMessage(tenant, msg, contact, waService).catch(e => console.error("Bot error:", e.message));
        }
      }
    }
  } catch (e) { console.error("WhatsApp webhook error:", e.message); }
});

// ── WhatsApp test send ────────────────────────────────────────────────────────
app.post("/api/test-whatsapp", auth, async (req, res) => {
  try {
    const to = req.body.to;
    if (!to) return res.status(400).json({ error: "Provide 'to' phone number" });
    const result = await waService.sendTestMessage(to);
    res.json({ success: true, result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Campaigns ─────────────────────────────────────────────────────────────────
app.post("/api/campaigns/send", auth, async (req, res) => {
  try {
    const { recipients, templateName } = req.body;
    const results = await waService.bulkSend(recipients, async (r) => {
      await waService.sendTemplate(r.phone, templateName, r.bodyValues || [], [], []);
      return { ok: true };
    }, 500);
    res.json({ sent: results.filter(r=>r.ok).length, failed: results.filter(r=>!r.ok).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "4000");

async function start() {
  // Init R2 bucket
  try { await r2Service.initBucket(); console.log("✅ R2 bucket ready"); }
  catch (e) { console.warn("⚠️  R2 init:", e.message); }

  // Start schedulers
  try { startReportPolling(); } catch (e) { console.warn("⚠️  Report polling:", e.message); }

  // Verify WhatsApp
  try {
    const wa = await waService.verifyToken();
    if (wa.valid) console.log(`✅ WhatsApp API ready (Interakt)`);
    else console.warn(`⚠️  WhatsApp: ${wa.error}`);
  } catch (e) { console.warn("⚠️  WhatsApp check:", e.message); }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 DiagConnect API live → http://0.0.0.0:${PORT}`);
    console.log(`   Node    : ${process.version}`);
    console.log(`   Env     : ${process.env.NODE_ENV || "development"}`);
    console.log(`   R2      : ${process.env.R2_ENDPOINT ? "configured" : "missing"}`);
    console.log(`   Razorpay: ${process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.slice(0,12)+"..." : "missing"}`);
    console.log(`   WhatsApp: ${process.env.INTERAKT_API_KEY ? "configured (Interakt)" : "missing"}\n`);
  });
}

start().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
