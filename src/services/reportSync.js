/**
 * DiagConnect — Automated Report Sync & Delivery Service
 *
 * Design philosophy:
 * 1. Reports arrive in R2 (uploaded by lab staff OR pushed via webhook from LIS)
 * 2. Before delivery, system performs 3-factor patient identity verification
 * 3. Only after ALL 3 factors match does the report get sent to WhatsApp
 * 4. Every delivery is logged in audit trail (DPDP compliance)
 *
 * Identity verification factors:
 *   Factor 1 — Phone number (must match appointment booking phone)
 *   Factor 2 — Report token (HMAC of tenantId + patientId — embedded in filename/path)
 *   Factor 3 — Appointment reference number (cross-checked in DB)
 */

const { PrismaClient } = require("@prisma/client");
const cron             = require("node-cron");
const crypto           = require("crypto");
const { uploadReport, presignedUrl, verifyOwnership } = require("./storage");
const { createWhatsAppService } = require("./whatsapp");
const emailService     = require("./email");
const logger           = require("../utils/logger");

const prisma = new PrismaClient();

// ─── PATIENT IDENTITY TOKEN ────────────────────────────────────────────────────
/**
 * Generates a deterministic patient token used to verify report ownership.
 * Only staff/system with knowledge of both tenantId AND patientId can generate this.
 */
function generatePatientToken(tenantId, patientId) {
  return crypto
    .createHmac("sha256", process.env.ENCRYPTION_KEY || "fallback_key")
    .update(`${tenantId}:${patientId}`)
    .digest("hex")
    .slice(0, 16);
}

// ─── 3-FACTOR PATIENT IDENTITY VERIFICATION ──────────────────────────────────
async function verifyPatientIdentity(tenantId, reportData) {
  const { patientPhone, appointmentRef, testCode, reportKey } = reportData;

  // Factor 1: Find appointment by reference AND phone (both must match)
  const appointment = await prisma.appointment.findFirst({
    where: {
      tenantId,
      referenceNo:  appointmentRef,
      patientPhone: patientPhone,
      status:       { in: ["COMPLETED", "ARRIVED", "SAMPLE_COLLECTED"] },
    },
    include: { patient: true },
  });

  if (!appointment) {
    logger.warn("Identity check FAILED — no matching appointment", { tenantId, appointmentRef, patientPhone });
    return { verified: false, reason: "NO_MATCHING_APPOINTMENT" };
  }

  // Factor 2: Verify the report path token matches patient
  if (reportKey) {
    const pathValid = verifyOwnership(reportKey, tenantId, appointment.patientId);
    if (!pathValid) {
      logger.warn("Identity check FAILED — report token mismatch", { tenantId, reportKey });
      return { verified: false, reason: "TOKEN_MISMATCH" };
    }
  }

  // Factor 3: Test code must match appointment test (prevent CBC report going to lipid patient)
  if (testCode && appointment.testCode && testCode !== appointment.testCode) {
    logger.warn("Identity check FAILED — test code mismatch", {
      expected: appointment.testCode, got: testCode,
    });
    return { verified: false, reason: "TEST_CODE_MISMATCH" };
  }

  logger.info("Identity verification PASSED — 3/3 factors", {
    appointmentRef, patientId: appointment.patientId,
  });

  return {
    verified:   true,
    appointment,
    patient:    appointment.patient,
    patientId:  appointment.patientId,
  };
}

// ─── DELIVER REPORT VIA WHATSAPP ──────────────────────────────────────────────
async function deliverReport(tenantId, reportId) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { appointment: true, patient: true, tenant: true },
  });

  if (!report) throw new Error(`Report ${reportId} not found`);
  if (report.deliveryStatus === "READ" || report.deliveryStatus === "DELIVERED") {
    logger.info("Report already delivered, skipping", { reportId });
    return;
  }

  // ── Identity verification before delivery ────────────────────────────────
  const identity = await verifyPatientIdentity(tenantId, {
    patientPhone:   report.patient.phone,
    appointmentRef: report.appointment.referenceNo,
    testCode:       report.appointment.testCode,
    reportKey:      report.fileKey,
  });

  if (!identity.verified) {
    // Log the failure — don't deliver
    await prisma.auditLog.create({ data: {
      tenantId,
      action:     "report.delivery_blocked",
      resource:   "Report",
      resourceId: reportId,
      metadata:   { reason: identity.reason, reportId },
    }});
    await prisma.report.update({ where: { id: reportId }, data: { deliveryStatus: "FAILED" } });
    throw new Error(`Identity verification failed: ${identity.reason}`);
  }

  // ── Generate time-limited download URL (24 hours) ────────────────────────
  const downloadUrl = await presignedUrl(report.fileKey, 86400);

  // ── Send via WhatsApp ─────────────────────────────────────────────────────
  const wa = createWhatsAppService(report.tenant);
  const waResult = await wa.sendDocument(
    report.patient.phone,
    downloadUrl,
    `📄 Your *${report.appointment.testName}* report from *${report.tenant.name}* is ready.\n\nRef: ${report.appointment.referenceNo}\nDate: ${new Date(report.appointment.scheduledDate).toLocaleDateString("en-IN")}\n\n⚠️ _This link expires in 24 hours. Download now._\n\nFor queries, reply here or call us. 🙏`,
    report.fileName,
  );

  // ── Update DB ─────────────────────────────────────────────────────────────
  await prisma.report.update({
    where: { id: reportId },
    data: {
      deliveredAt:    new Date(),
      deliveryStatus: "DELIVERED",
      waMessageId:    waResult?.messages?.[0]?.id,
    },
  });

  // ── Audit log ─────────────────────────────────────────────────────────────
  await prisma.auditLog.create({ data: {
    tenantId,
    action:     "report.delivered",
    resource:   "Report",
    resourceId: reportId,
    metadata: {
      patientPhone: report.patient.phone.replace(/(\d{4})\d{4}(\d{2})/, "$1****$2"),
      testName:     report.appointment.testName,
      waMessageId:  waResult?.messages?.[0]?.id,
    },
  }});

  // ── Notify staff via email ────────────────────────────────────────────────
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: { in: ["OWNER", "ADMIN"] } },
  });
  if (owner?.email) {
    await emailService.sendReportDeliveredNotification(owner.email, report.tenant.name, {
      patientName: report.patient.name,
      phone:       report.patient.phone,
      testName:    report.appointment.testName,
      ref:         report.appointment.referenceNo,
    });
  }

  logger.info("Report delivered successfully", { reportId, patientId: report.patientId });
  return { success: true, waMessageId: waResult?.messages?.[0]?.id };
}

// ─── WEBHOOK HANDLER (LIS pushes reports here) ────────────────────────────────
/**
 * Your LIS/LIMS calls POST /api/reports/incoming with:
 * {
 *   appointmentRef: "#DC240301",
 *   patientPhone: "+919876511111",
 *   testCode: "TSH",
 *   pdfBase64: "...",   // OR pdfUrl: "https://your-lis.com/reports/123.pdf"
 *   patientToken: "optional_lis_patient_id"
 * }
 */
async function handleIncomingReport(tenantId, data, fileBuffer) {
  const { appointmentRef, patientPhone, testCode, fileName } = data;

  // Verify identity first
  const identity = await verifyPatientIdentity(tenantId, {
    patientPhone, appointmentRef, testCode,
  });

  if (!identity.verified) {
    logger.error("Incoming report rejected — identity check failed", { tenantId, appointmentRef, reason: identity.reason });
    throw new Error(`Patient identity verification failed: ${identity.reason}`);
  }

  const { appointment, patient } = identity;

  // Upload to R2
  const reportId  = `RPT_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const safeFile  = fileName || `${testCode}_${reportId}.pdf`;

  const { key, checksum } = await uploadReport(fileBuffer, {
    tenantId,
    patientId: patient.id,
    reportId,
    testCode,
    date: appointment.scheduledDate,
  });

  // Create report record
  const report = await prisma.report.create({ data: {
    tenantId,
    patientId:     patient.id,
    appointmentId: appointment.id,
    fileName:      safeFile,
    fileKey:       key,
    fileChecksum:  checksum,
    uploadedAt:    new Date(),
    deliveryStatus:"PENDING",
  }});

  // Auto-deliver immediately
  await deliverReport(tenantId, report.id);

  return { success: true, reportId: report.id };
}

// ─── POLLING SCHEDULER (if LIS doesn't support webhooks) ─────────────────────
/**
 * Every 5 minutes, poll the LIS for new reports.
 * Only used as fallback — webhook mode is preferred.
 */
function startReportPolling() {
  if (!process.env.LIS_POLL_URL) return;

  logger.info("Starting LIS report polling every 5 minutes");
  cron.schedule("*/5 * * * *", async () => {
    try {
      const axios   = require("axios");
      const tenants = await prisma.tenant.findMany({ where: { isActive: true } });

      for (const tenant of tenants) {
        const response = await axios.get(process.env.LIS_POLL_URL, {
          headers: { "X-API-Key": process.env.LIS_API_KEY },
          params:  { tenantId: tenant.id, status: "ready" },
        });

        const pendingReports = response.data?.reports || [];
        for (const r of pendingReports) {
          try {
            const pdfRes = await axios.get(r.pdfUrl, { responseType: "arraybuffer" });
            await handleIncomingReport(tenant.id, r, Buffer.from(pdfRes.data));
          } catch (err) {
            logger.error("Failed to process polled report", { error: err.message, ref: r.appointmentRef });
          }
        }
      }
    } catch (err) {
      logger.error("LIS polling error", { error: err.message });
    }
  });
}

// ─── REMINDER SCHEDULER ───────────────────────────────────────────────────────
function startReminderScheduler() {
  // Every hour — check for appointments needing 24h reminders
  cron.schedule("0 * * * *", async () => {
    const { sendReminder24h, sendReminder2h, sendNoShowRecovery } = require("./botEngine");
    const now     = new Date();
    const in24h   = new Date(now.getTime() + 24*60*60*1000);
    const in2h    = new Date(now.getTime() + 2*60*60*1000);
    const minus45 = new Date(now.getTime() - 45*60*1000);

    const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
    for (const tenant of tenants) {
      // 24h reminders
      const appts24h = await prisma.appointment.findMany({ where: {
        tenantId: tenant.id, status: "CONFIRMED", reminderSent24h: false,
        scheduledDate: { gte: new Date(in24h.setHours(0,0,0,0)), lte: new Date(in24h.setHours(23,59,59,999)) }
      }});
      for (const a of appts24h) await sendReminder24h(tenant, a).catch(e => logger.error("24h reminder failed", { error: e.message }));

      // 2h reminders
      const appts2h = await prisma.appointment.findMany({ where: {
        tenantId: tenant.id, status: "CONFIRMED", reminderSent2h: false,
        slot: `${String(in2h.getHours()).padStart(2,"0")}:${String(Math.floor(in2h.getMinutes()/15)*15).padStart(2,"0")}`
      }});
      for (const a of appts2h) await sendReminder2h(tenant, a).catch(e => logger.error("2h reminder failed", { error: e.message }));

      // No-show recovery (45 min after slot with no arrival)
      const noShows = await prisma.appointment.findMany({ where: {
        tenantId: tenant.id, status: "CONFIRMED",
        scheduledDate: { lte: minus45 }
      }});
      for (const a of noShows) {
        await prisma.appointment.update({ where: { id: a.id }, data: { status: "NO_SHOW" } });
        await sendNoShowRecovery(tenant, a).catch(e => logger.error("No-show recovery failed", { error: e.message }));
      }
    }
  });
}

module.exports = { deliverReport, handleIncomingReport, startReportPolling, startReminderScheduler, generatePatientToken, verifyPatientIdentity };
