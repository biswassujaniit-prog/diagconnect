/**
 * Email Notification Service — Resend
 * API Key: re_4T3Y7pA7_BU2BSC6MMT2aNz962chsBbiQ
 * Docs: https://resend.com/docs
 */

const { Resend } = require("resend");
const logger = { info: (m, d) => console.log(JSON.stringify({level:"info",msg:m,...d,ts:new Date().toISOString()})), error: (m, d) => console.error(JSON.stringify({level:"error",msg:m,...d,ts:new Date().toISOString()})) };

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "DiagConnect <noreply@diagconnect.in>";

// ─── ONBOARDING WELCOME ───────────────────────────────────────────────────────
async function sendOnboardingWelcome(ownerEmail, ownerName, clinicName, loginUrl) {
  return send({
    to: ownerEmail,
    subject: `Welcome to DiagConnect — ${clinicName} is now set up!`,
    html: `
<div style="font-family:Outfit,sans-serif;max-width:580px;margin:0 auto;padding:32px">
  <div style="background:linear-gradient(135deg,#0D9488,#0891B2);padding:24px;border-radius:16px;text-align:center;margin-bottom:24px">
    <h1 style="color:#fff;margin:0;font-size:22px">Welcome to DiagConnect 🎉</h1>
  </div>
  <p>Hi ${ownerName},</p>
  <p>Your clinic <strong>${clinicName}</strong> has been successfully onboarded on DiagConnect.</p>
  <p>Your WhatsApp bot will be activated within 24 hours once our team reviews your KYC documents.</p>
  <a href="${loginUrl}" style="display:inline-block;background:#0D9488;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin:16px 0">Access Your Dashboard →</a>
  <p>Questions? Reply to this email or WhatsApp us at +91 98765 00000</p>
</div>`,
  });
}

// ─── NEW APPOINTMENT CONFIRMATION ─────────────────────────────────────────────
async function sendAppointmentConfirmation(staffEmail, clinicName, appointment) {
  return send({
    to: staffEmail,
    subject: `New Booking: ${appointment.patientName} — ${appointment.testName}`,
    html: `
<div style="font-family:Outfit,sans-serif;max-width:580px;margin:0 auto;padding:24px">
  <h2>New Appointment Booked 📅</h2>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    ${[["Patient", appointment.patientName],["Test", appointment.testName],["Date", appointment.date],["Slot", appointment.slot],["Ref", appointment.ref],["Booked Via", appointment.source]].map(([k,v])=>`<tr><td style="padding:8px;color:#64748B;width:120px">${k}</td><td style="padding:8px;font-weight:600">${v}</td></tr>`).join("")}
  </table>
  <p style="color:#64748B;font-size:13px">This is an automated notification from DiagConnect.</p>
</div>`,
  });
}

// ─── REPORT DELIVERED NOTIFICATION ───────────────────────────────────────────
async function sendReportDeliveredNotification(staffEmail, clinicName, report) {
  return send({
    to: staffEmail,
    subject: `Report Delivered: ${report.patientName} — ${report.testName}`,
    html: `
<div style="font-family:Outfit,sans-serif;max-width:580px;margin:0 auto;padding:24px">
  <h2>✅ Report Delivered via WhatsApp</h2>
  <p>Report for <strong>${report.patientName}</strong> (${report.testName}) was successfully delivered.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    ${[["Patient", report.patientName],["Phone", `+91 ****${report.phone?.slice(-4)}`],["Test", report.testName],["Ref", report.ref],["Delivered At", new Date().toLocaleString("en-IN")]].map(([k,v])=>`<tr><td style="padding:8px;color:#64748B;width:120px">${k}</td><td style="padding:8px;font-weight:600">${v}</td></tr>`).join("")}
  </table>
  <p style="color:#94A3B8;font-size:12px">Verify delivery status in your DiagConnect dashboard.</p>
</div>`,
  });
}

// ─── KYC STATUS UPDATE ────────────────────────────────────────────────────────
async function sendKycStatusUpdate(ownerEmail, ownerName, clinicName, status, notes) {
  const isApproved = status === "approved";
  return send({
    to: ownerEmail,
    subject: `KYC ${isApproved ? "Approved ✅" : "Needs Attention ⚠️"} — ${clinicName}`,
    html: `
<div style="font-family:Outfit,sans-serif;max-width:580px;margin:0 auto;padding:32px">
  <div style="background:${isApproved?"#ECFDF5":"#FFFBEB"};border:1px solid ${isApproved?"#A7F3D0":"#FDE68A"};padding:20px;border-radius:12px;margin-bottom:20px">
    <h2 style="color:${isApproved?"#065F46":"#92400E"};margin:0">KYC ${isApproved?"Approved ✅":"Needs Attention ⚠️"}</h2>
  </div>
  <p>Hi ${ownerName},</p>
  <p>${isApproved ? `Your KYC verification for <strong>${clinicName}</strong> has been approved. Your WhatsApp bot is now live!` : `Your KYC documents for <strong>${clinicName}</strong> need some attention.`}</p>
  ${notes ? `<div style="background:#F8FAFC;padding:14px;border-radius:8px;border-left:4px solid #0D9488"><strong>Notes from our team:</strong><br>${notes}</div>` : ""}
  <p style="margin-top:16px">Login to your dashboard to ${isApproved ? "get started" : "re-upload documents"} →</p>
</div>`,
  });
}

// ─── NO SHOW ALERT ────────────────────────────────────────────────────────────
async function sendNoShowAlert(staffEmail, clinicName, appointment) {
  return send({
    to: staffEmail,
    subject: `No-Show: ${appointment.patientName} — ${appointment.slot}`,
    html: `<div style="font-family:Outfit,sans-serif;padding:24px"><h2>No-Show Alert ⚠️</h2><p>${appointment.patientName} did not arrive for their ${appointment.slot} appointment (${appointment.testName}).</p><p>A recovery WhatsApp message has been automatically sent to the patient.</p></div>`,
  });
}

// ─── SLOT CAPACITY ALERT ──────────────────────────────────────────────────────
async function sendSlotCapacityAlert(staffEmail, clinicName, slot, date) {
  return send({
    to: staffEmail,
    subject: `Slot Full: ${slot} on ${date} — ${clinicName}`,
    html: `<div style="font-family:Outfit,sans-serif;padding:24px"><h2>🔴 Slot Fully Booked</h2><p>The <strong>${slot}</strong> slot on <strong>${date}</strong> at ${clinicName} has reached maximum capacity (3 patients). It has been automatically deactivated for new bookings.</p></div>`,
  });
}

// ─── CORE SEND FUNCTION ───────────────────────────────────────────────────────
async function send({ to, subject, html, from = FROM, replyTo }) {
  try {
    const result = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });
    logger.info("Email sent via Resend", { to, subject, id: result.id });
    return result;
  } catch (err) {
    logger.error("Resend email failed", { to, subject, error: err.message });
    // Non-blocking — don't throw
  }
}

module.exports = {
  sendOnboardingWelcome,
  sendAppointmentConfirmation,
  sendReportDeliveredNotification,
  sendKycStatusUpdate,
  sendNoShowAlert,
  sendSlotCapacityAlert,
};
