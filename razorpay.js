/**
 * DiagConnect — Razorpay Payment Service
 * Key:    rzp_live_SXfsbB2xGFN7Vh
 * Secret: LxRGrebDAoqTUhTu3ChV0rZu
 * Docs:   https://razorpay.com/docs/api
 */

const crypto = require("crypto");
const axios  = require("axios");

const RZP_KEY    = process.env.RAZORPAY_KEY_ID     || "rzp_live_SXfsbB2xGFN7Vh";
const RZP_SECRET = process.env.RAZORPAY_KEY_SECRET  || "LxRGrebDAoqTUhTu3ChV0rZu";
const RZP_WEBOOK = process.env.RAZORPAY_WEBHOOK_SECRET || "diagconnect_rzp_webhook_2026";

const rzpClient = axios.create({
  baseURL: "https://api.razorpay.com/v1",
  auth:    { username: RZP_KEY, password: RZP_SECRET },
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// ─── CREATE ORDER ─────────────────────────────────────────────────────────────
/**
 * Creates a Razorpay order for appointment payment.
 * Amount is in paise (₹450 = 45000 paise).
 */
async function createOrder({ amount, currency = "INR", receipt, notes = {} }) {
  const { data } = await rzpClient.post("/orders", {
    amount:   Math.round(amount * 100),   // convert ₹ to paise
    currency,
    receipt:  receipt || `rcpt_${Date.now()}`,
    notes,
    payment_capture: 1,
  });
  return data;   // { id, amount, currency, receipt, status }
}

// ─── CREATE PAYMENT LINK ──────────────────────────────────────────────────────
/**
 * Creates a Razorpay Payment Link sent to patient via WhatsApp.
 * Patient taps the link → pays on Razorpay hosted page → webhook fires.
 */
async function createPaymentLink({
  amount,
  description,
  customerName,
  customerPhone,
  customerEmail,
  referenceId,
  expiresAt,
  notifyWhatsApp = true,
}) {
  const expiry = expiresAt || Math.floor(Date.now() / 1000) + 86400; // 24h default

  const { data } = await rzpClient.post("/payment_links", {
    amount:       Math.round(amount * 100),
    currency:     "INR",
    description,
    reference_id: referenceId,
    expire_by:    expiry,
    customer: {
      name:    customerName,
      contact: normalisePhone(customerPhone),
      email:   customerEmail || undefined,
    },
    notify: {
      sms:       false,
      email:     false,
      whatsapp:  notifyWhatsApp,
    },
    reminder_enable: true,
    callback_url:    `${process.env.APP_URL}/api/payments/callback`,
    callback_method: "get",
    notes: {
      source:       "diagconnect",
      referenceId,
    },
  });
  return data;   // { id, short_url, status }
}

// ─── FETCH PAYMENT ────────────────────────────────────────────────────────────
async function fetchPayment(paymentId) {
  const { data } = await rzpClient.get(`/payments/${paymentId}`);
  return data;
}

// ─── FETCH ORDER ──────────────────────────────────────────────────────────────
async function fetchOrder(orderId) {
  const { data } = await rzpClient.get(`/orders/${orderId}`);
  return data;
}

// ─── REFUND ───────────────────────────────────────────────────────────────────
async function refund(paymentId, amount, notes = {}) {
  const { data } = await rzpClient.post(`/payments/${paymentId}/refund`, {
    amount: amount ? Math.round(amount * 100) : undefined,
    notes,
  });
  return data;
}

// ─── VERIFY PAYMENT SIGNATURE ─────────────────────────────────────────────────
/**
 * Verify Razorpay payment signature after checkout.
 * Must be verified server-side before marking payment as successful.
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  const body     = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", RZP_SECRET)
    .update(body)
    .digest("hex");
  return expected === signature;
}

// ─── VERIFY WEBHOOK SIGNATURE ─────────────────────────────────────────────────
function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto
    .createHmac("sha256", RZP_WEBOOK)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

// ─── CHECKOUT OPTIONS (for frontend) ─────────────────────────────────────────
/**
 * Returns the config object passed to Razorpay checkout.js on the frontend.
 */
function checkoutOptions({ orderId, amount, name, description, prefillName, prefillPhone }) {
  return {
    key:     RZP_KEY,
    amount:  Math.round(amount * 100),
    currency: "INR",
    name:    "DiagConnect",
    description,
    order_id: orderId,
    prefill: {
      name:    prefillName,
      contact: normalisePhone(prefillPhone),
    },
    theme:   { color: "#0D9488" },
    modal:   { backdropclose: false },
  };
}

// ─── SUBSCRIPTION PLAN (for DiagConnect SaaS billing) ────────────────────────
async function createSubscriptionOrder(plan, clinicName, email) {
  const prices = { BASIC: 7500, PREMIUM: 14000, PRO: 22000 };
  return createOrder({
    amount:  prices[plan] || 7500,
    receipt: `sub_${plan}_${Date.now()}`,
    notes:   { plan, clinicName, email, type: "subscription" },
  });
}

// ─── UTIL ─────────────────────────────────────────────────────────────────────
function normalisePhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

module.exports = {
  createOrder, createPaymentLink, fetchPayment, fetchOrder,
  refund, verifyPaymentSignature, verifyWebhookSignature,
  checkoutOptions, createSubscriptionOrder,
  RZP_KEY,
};
