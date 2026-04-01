/**
 * DiagConnect — Cloudflare R2 Storage Service
 *
 * Endpoint : https://f11ad4596cff52d5f1901dfe45a820c6.r2.cloudflarestorage.com
 * Access ID: 46f3bd6e6d311ac5b7e6086dc666fd7a
 * Secret   : e7ba9eaf6d31e38cef066fe785e7394f4544150cfb2cfa79f9261f45a433f61f
 * CF API   : cfat_5nZ1zBypInnTFGCuXPJf6uZYNFE15w3dehgCS4KG41170acc
 * Bucket   : diagconnect-reports
 *
 * Install: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const path   = require("path");

// ─── R2 CLIENT (S3-compatible) ────────────────────────────────────────────────
const r2 = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT
    || "https://f11ad4596cff52d5f1901dfe45a820c6.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId:
      process.env.R2_ACCESS_KEY_ID || "46f3bd6e6d311ac5b7e6086dc666fd7a",
    secretAccessKey:
      process.env.R2_SECRET_ACCESS_KEY
      || "e7ba9eaf6d31e38cef066fe785e7394f4544150cfb2cfa79f9261f45a433f61f",
  },
});

const BUCKET     = process.env.R2_BUCKET_NAME || "diagconnect-reports";
const URL_EXPIRY = parseInt(process.env.R2_URL_EXPIRY || "86400");

// ─── ONE-TIME BUCKET SETUP ────────────────────────────────────────────────────
async function initBucket() {
  try {
    await r2.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`✅ R2 bucket "${BUCKET}" created`);
  } catch (err) {
    if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(err.name)) {
      console.error("R2 create bucket:", err.message);
    } else {
      console.log(`ℹ️  R2 bucket "${BUCKET}" already exists`);
    }
  }
  try {
    await r2.send(new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: ["*"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedHeaders: ["*"],
          MaxAgeSeconds:  3600,
        }],
      },
    }));
    console.log("✅ R2 CORS configured");
  } catch (err) {
    console.error("R2 CORS:", err.message);
  }
}

// ─── PATIENT TOKEN ────────────────────────────────────────────────────────────
function patientToken(tenantId, patientId) {
  const key = process.env.ENCRYPTION_KEY || "diagconnect_enc_key_replace_in_prod";
  return crypto
    .createHmac("sha256", key)
    .update(`${tenantId}:${patientId}`)
    .digest("hex")
    .slice(0, 16);
}

// ─── UPLOAD REPORT PDF ────────────────────────────────────────────────────────
/**
 * Path: reports/{tenantId}/{yyyy}/{mm}/{patientToken}/{reportId}.pdf
 * - patientToken is HMAC(tenantId:patientId) — cannot be reversed
 * - AES256 server-side encryption applied
 */
async function uploadReport(buffer, { tenantId, patientId, reportId, testCode, date }) {
  const token  = patientToken(tenantId, patientId);
  const dt     = new Date(date || Date.now());
  const key    = `reports/${tenantId}/${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,"0")}/${token}/${reportId}.pdf`;
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  await r2.send(new PutObjectCommand({
    Bucket:               BUCKET,
    Key:                  key,
    Body:                 buffer,
    ContentType:          "application/pdf",
    ServerSideEncryption: "AES256",
    Metadata: {
      tenantId,
      patientId,
      reportId,
      testCode:      testCode || "",
      sha256,
      uploadedAt:    new Date().toISOString(),
      dataClass:     "sensitive_health",
      retentionDays: "2555",
    },
  }));

  console.log(`📤 Uploaded: ${key}`);
  return { key, checksum: sha256 };
}

// ─── PRESIGNED URL ────────────────────────────────────────────────────────────
/**
 * Returns a time-limited download URL (default 24h).
 * This URL is sent to the patient via WhatsApp.
 * Expires and becomes invalid after URL_EXPIRY seconds.
 */
async function presignedUrl(key, expiresIn = URL_EXPIRY) {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

// ─── VERIFY REPORT OWNERSHIP ─────────────────────────────────────────────────
function verifyOwnership(key, tenantId, patientId) {
  const expected = patientToken(tenantId, patientId);
  const parts    = key.split("/");
  return parts[1] === tenantId && parts[4] === expected;
}

// ─── UPLOAD TEST MASTER FILE ─────────────────────────────────────────────────
async function uploadTestMaster(buffer, tenantId, originalName) {
  const ext = path.extname(originalName).toLowerCase() || ".csv";
  const key = `master/${tenantId}/tests/${Date.now()}${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: ext === ".csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    Metadata:    { tenantId, originalName, uploadedAt: new Date().toISOString() },
  }));
  return key;
}

// ─── UPLOAD KYC DOCUMENT ─────────────────────────────────────────────────────
async function uploadKycDoc(buffer, tenantId, docType, originalName) {
  const ext = path.extname(originalName).toLowerCase() || ".pdf";
  const key = `kyc/${tenantId}/${docType}${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: "application/pdf",
    Metadata:    { tenantId, docType, uploadedAt: new Date().toISOString() },
  }));
  return key;
}

// ─── DELETE (DPDP erasure) ───────────────────────────────────────────────────
async function deleteObject(key) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log(`🗑️  Deleted: ${key}`);
}

// ─── EXISTS ───────────────────────────────────────────────────────────────────
async function exists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch { return false; }
}

// ─── LIST PATIENT REPORTS ─────────────────────────────────────────────────────
async function listPatientReports(tenantId, patientId) {
  const token = patientToken(tenantId, patientId);
  const res   = await r2.send(new ListObjectsV2Command({
    Bucket: BUCKET, Prefix: `reports/${tenantId}/`
  }));
  return (res.Contents || []).filter(o => o.Key.includes(`/${token}/`));
}

// ─── CONNECTION TEST ──────────────────────────────────────────────────────────
async function testConnection() {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: "_ping" }));
    return { ok: true, bucket: BUCKET };
  } catch (err) {
    if ([404, 403].includes(err.$metadata?.httpStatusCode) || err.name === "NotFound") {
      return { ok: true, bucket: BUCKET, note: "Reachable" };
    }
    return { ok: false, error: err.message };
  }
}

module.exports = {
  r2, BUCKET, initBucket,
  patientToken, uploadReport, presignedUrl,
  verifyOwnership, uploadTestMaster, uploadKycDoc,
  deleteObject, exists, listPatientReports, testConnection,
};
