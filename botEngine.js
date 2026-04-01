/**
 * DiagConnect — WhatsApp Bot Engine
 * Pulls tests from master catalog · Real-time slot booking
 */

const { SESSIONS, getSlotAvailability, bookSlot } = require("./slotManager");

// In-memory conversation state (replace with Redis in prod)
const convState = new Map();

function getState(phone) {
  return convState.get(phone) || { state: "idle", data: {} };
}
function setState(phone, state, data = {}) {
  convState.set(phone, { state, data });
}
function clearState(phone) {
  convState.delete(phone);
}

// Greeting based on time
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning! ☀️" : h < 17 ? "Good afternoon! 🌤" : "Good evening! 🌙";
}

function ts() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
async function handleIncomingMessage(tenant, message, contact, wa) {
  const phone   = contact.wa_id;
  const phoneId = tenant.wabaPhoneId;
  const msgType = message.type;

  // Extract text from message
  let input = "";
  if (msgType === "text")        input = message.text?.body?.trim() || "";
  if (msgType === "interactive") {
    input = message.interactive?.button_reply?.id
         || message.interactive?.list_reply?.id
         || message.interactive?.button_reply?.title
         || "";
  }

  const lo = input.toLowerCase();

  // Mark as read
  await wa.markRead(phoneId, message.id).catch(() => {});

  const conv = getState(phone);

  // ── GLOBAL RESETS ──────────────────────────────────────────
  if (!input || ["hi","hello","menu","start"].includes(lo) || lo.includes("main menu")) {
    clearState(phone);
    return sendMainMenu(tenant, wa, phoneId, phone);
  }

  // ── ROUTE BY STATE ─────────────────────────────────────────
  switch (conv.state) {
    case "book_test":     return handleBookTest(tenant, wa, phoneId, phone, input, conv.data);
    case "book_session":  return handleBookSession(tenant, wa, phoneId, phone, input, conv.data);
    case "book_slot":     return handleBookSlot(tenant, wa, phoneId, phone, input, conv.data);
    case "book_name":     return handleBookName(tenant, wa, phoneId, phone, input, conv.data);
    case "book_confirm":  return handleBookConfirm(tenant, wa, phoneId, phone, lo, conv.data);
    case "home_addr":     return handleHomeAddr(tenant, wa, phoneId, phone, input);
    case "report_req":    return handleReportReq(tenant, wa, phoneId, phone, input);
    case "human":         return notifyStaff(tenant, phone, input);
    default:              return handleIdle(tenant, wa, phoneId, phone, input, lo, message);
  }
}

// ─── MAIN MENU ────────────────────────────────────────────────────────────────
async function sendMainMenu(tenant, wa, phoneId, phone) {
  setState(phone, "idle");
  return wa.sendInteractive(phoneId, phone,
    `${greeting()} Welcome to *${tenant.name}*! 🏥\n\nOpen ${tenant.open} – ${tenant.close}`,
    [
      { id:"book",   title:"🔬 Book a Test" },
      { id:"prices", title:"💰 Test Prices"  },
      { id:"slots",  title:"📅 View Slots"   },
    ],
    null,
    'Reply "report" for results · "home" for collection',
  );
}

// ─── IDLE HANDLER ─────────────────────────────────────────────────────────────
async function handleIdle(tenant, wa, phoneId, phone, input, lo, message) {
  if (lo === "book"  || lo.includes("book"))          return startBooking(tenant, wa, phoneId, phone);
  if (lo === "prices"|| lo.includes("price"))         return sendPrices(tenant, wa, phoneId, phone);
  if (lo === "slots" || lo.includes("slot"))          return sendSlotSummary(tenant, wa, phoneId, phone);
  if (lo.includes("home") || lo.includes("collect"))  return startHomeCollection(tenant, wa, phoneId, phone);
  if (lo.includes("report") || lo.includes("result")) return startReportRetrieval(tenant, wa, phoneId, phone);
  if (lo.includes("talk") || lo.includes("staff") || lo.includes("human")) return escalateToHuman(tenant, wa, phoneId, phone);

  // Symptom detection
  if (/tired|fatigue|fever|pain|sugar|diabetes|thyroid|kidney|liver|blood|weak|headache|dizzy|weight|urine|stomach|cholesterol|vitamin|anaemia/i.test(input)) {
    return wa.sendInteractive(phoneId, phone,
      `I noticed you might have some health concerns. Would you like to:\n\n• Book a test directly\n• Speak to our team for guidance`,
      [{ id:"book", title:"🔬 Book a Test" }, { id:"talk", title:"💬 Talk to Team" }],
    );
  }

  return sendMainMenu(tenant, wa, phoneId, phone);
}

// ─── BOOKING FLOW ─────────────────────────────────────────────────────────────
async function startBooking(tenant, wa, phoneId, phone) {
  // Fetch tests — in prod, load from DB (master catalog)
  const popularTests = [
    { code:"CBC",   name:"Complete Blood Count",  price:300  },
    { code:"TSH",   name:"Thyroid Profile",        price:450  },
    { code:"HBA1C", name:"HbA1c",                  price:400  },
    { code:"LIPID", name:"Lipid Profile",          price:500  },
    { code:"FBC",   name:"Full Body Checkup",      price:1799 },
    { code:"DIAB",  name:"Diabetes Care Package",  price:899  },
  ];

  await wa.sendList(phoneId, phone,
    "Which test or package would you like to book? 🔬\n\nAll prices from our master catalog:",
    "Select Test",
    [{
      title: "Popular Tests",
      rows: popularTests.slice(0,4).map(t => ({
        id:          `test_${t.code}`,
        title:       t.name.slice(0,24),
        description: `₹${t.price}`,
      })),
    }, {
      title: "Packages",
      rows: popularTests.slice(4).map(t => ({
        id:          `test_${t.code}`,
        title:       t.name.slice(0,24),
        description: `₹${t.price}`,
      })).concat([{ id:"test_OTHER", title:"Other — Type name", description:"Search full catalog" }]),
    }],
  );

  setState(phone, "book_test", {});
}

async function handleBookTest(tenant, wa, phoneId, phone, input, data) {
  const testMap = {
    test_CBC:"Complete Blood Count|300", test_TSH:"Thyroid Profile|450",
    test_HBA1C:"HbA1c|400", test_LIPID:"Lipid Profile|500",
    test_FBC:"Full Body Checkup|1799", test_DIAB:"Diabetes Care Package|899",
  };

  let testName = input, price = "";
  const key = Object.keys(testMap).find(k => input.startsWith(k));
  if (key) { [testName, price] = testMap[key].split("|"); }

  // Send session selector
  await wa.sendInteractive(phoneId, phone,
    `*${testName}* ✅\n\nWhich session works for you?`,
    [
      { id:"sess_MORNING",   title:"🌅 Morning (7–11am)"  },
      { id:"sess_MIDDAY",    title:"☀️ Midday (11am–2pm)" },
      { id:"sess_AFTERNOON", title:"🌤 Afternoon (2–6pm)" },
    ],
    null,
    "Evening slots also available — reply 'evening'",
  );

  setState(phone, "book_session", { testName, price });
}

async function handleBookSession(tenant, wa, phoneId, phone, input, data) {
  const sessionMap = {
    sess_MORNING:"MORNING", sess_MIDDAY:"MIDDAY",
    sess_AFTERNOON:"AFTERNOON", sess_EVENING:"EVENING",
  };

  let sessionId = sessionMap[input]
    || (input.toLowerCase().includes("morning")   ? "MORNING"
      : input.toLowerCase().includes("midday")    ? "MIDDAY"
      : input.toLowerCase().includes("afternoon") ? "AFTERNOON"
      : input.toLowerCase().includes("evening")   ? "EVENING" : "MORNING");

  const session = SESSIONS.find(s => s.id === sessionId);
  const today   = new Date().toISOString().split("T")[0];

  // Get real slot availability
  let slots;
  try {
    const sessions = await getSlotAvailability(tenant.id, today);
    const sess     = sessions.find(s => s.id === sessionId);
    slots = sess?.slots.filter(sl => sl.status === "OPEN").slice(0, 6) || [];
  } catch {
    // Fallback to generated slots
    slots = [
      { time:"08:00", display:"8:00 AM" }, { time:"08:15", display:"8:15 AM" },
      { time:"09:00", display:"9:00 AM" }, { time:"09:30", display:"9:30 AM" },
    ].slice(0, 4);
  }

  if (!slots.length) {
    return wa.sendInteractive(phoneId, phone,
      `😔 No open slots in *${session?.label}* today.\n\nTry a different session:`,
      [
        { id:"sess_MORNING",   title:"🌅 Morning" },
        { id:"sess_AFTERNOON", title:"🌤 Afternoon" },
        { id:"sess_EVENING",   title:"🌙 Evening" },
      ],
    );
  }

  const slotBtns = slots.slice(0, 3).map(sl => ({
    id:    `slot_${sl.time}`,
    title: sl.display + (sl.available ? ` (${sl.available} left)` : ""),
  }));

  await wa.sendInteractive(phoneId, phone,
    `*${session?.emoji} ${session?.label}* slots for today:\n\n${slots.map(sl => `• ${sl.display} — ${sl.available ?? 3} spots`).join("\n")}`,
    slotBtns,
    null,
    "Reply with any time e.g. 10:30",
  );

  setState(phone, "book_slot", { ...data, sessionId });
}

async function handleBookSlot(tenant, wa, phoneId, phone, input, data) {
  let slotTime = input.replace("slot_", "");
  if (!slotTime.includes(":")) slotTime = input;

  await wa.sendText(phoneId, phone, "Patient's full name? 👤\n_(Type name below)_");
  setState(phone, "book_name", { ...data, slot: slotTime, date: new Date().toISOString().split("T")[0] });
}

async function handleBookName(tenant, wa, phoneId, phone, name, data) {
  const ref     = "#DC" + Math.floor(Math.random() * 900000 + 100000);
  const summary = `📋 *Booking Summary*\n\n👤 ${name}\n🔬 ${data.testName}\n📅 Today at ${data.slot}\n📍 ${tenant.name}\n💰 ₹${data.price || "As quoted"}\n🆔 Ref: *${ref}*\n\n✅ Confirm booking?`;

  await wa.sendInteractive(phoneId, phone, summary,
    [{ id:"confirm_yes", title:"✅ Confirm" }, { id:"confirm_no", title:"✏️ Change" }],
  );

  setState(phone, "book_confirm", { ...data, name, ref });
}

async function handleBookConfirm(tenant, wa, phoneId, phone, lo, data) {
  if (lo.includes("confirm_no") || lo.includes("change")) {
    clearState(phone);
    return startBooking(tenant, wa, phoneId, phone);
  }

  // Book the slot (with race-condition protection in slotManager)
  try {
    // TODO: get patientId from DB by phone
    // await bookSlot(tenant.id, patientId, testId, data.date, data.slot, "WHATSAPP_BOT");
  } catch (e) {
    if (e.message?.includes("SLOT_FULL")) {
      clearState(phone);
      return wa.sendText(phoneId, phone, "⚠️ Sorry, that slot just got fully booked while you were confirming. Please choose a different slot.");
    }
  }

  clearState(phone);

  await wa.sendText(phoneId, phone,
    `🎉 *Booking Confirmed!*\n\nRef: *${data.ref}*\n\n👤 ${data.name}\n🔬 ${data.testName}\n📅 Today at ${data.slot}\n📍 ${tenant.addr || tenant.name}\n\n📌 https://maps.google.com/?q=${encodeURIComponent(tenant.addr || tenant.name)}\n\n_We'll send a reminder 24h before. Your report will be automatically delivered here when ready._ 🙏`,
  );
}

// ─── PRICES ──────────────────────────────────────────────────────────────────
async function sendPrices(tenant, wa, phoneId, phone) {
  // In prod: fetch from DB master catalog
  const tests = [
    { name:"Complete Blood Count",  price:300  },
    { name:"Thyroid Profile",        price:450  },
    { name:"HbA1c",                  price:400  },
    { name:"Lipid Profile",          price:500  },
    { name:"Urine Routine",          price:180  },
    { name:"Blood Glucose Fasting",  price:100  },
    { name:"Full Body Checkup ⭐",   price:1799 },
    { name:"Diabetes Care Package",  price:899  },
  ];

  const text = tests.map(t => `🔵 *${t.name}* — ₹${t.price}`).join("\n")
    + "\n\n_Prices from master catalog. Tap to book any test._";

  return wa.sendInteractive(phoneId, phone, text,
    [{ id:"book", title:"🔬 Book a Test" }, { id:"home", title:"🏠 Home Collection" }],
  );
}

// ─── SLOT SUMMARY ─────────────────────────────────────────────────────────────
async function sendSlotSummary(tenant, wa, phoneId, phone) {
  const today = new Date().toISOString().split("T")[0];
  let text    = "📅 *Today's Available Slots*\n\n";

  try {
    const sessions = await getSlotAvailability(tenant.id, today);
    for (const s of sessions) {
      const open = s.slots.filter(sl => sl.status === "OPEN").length;
      text += `${s.emoji} *${s.label}* (${s.start}–${s.end}) — ${open > 0 ? `${open} slots open` : "Full ❌"}\n`;
    }
  } catch {
    text += "🌅 Morning (7–11am)\n☀️ Midday (11am–2pm)\n🌤 Afternoon (2–6pm)\n🌙 Evening (6–8pm)";
  }

  text += "\n\nTap *Book a Test* to select your slot:";
  return wa.sendInteractive(phoneId, phone, text,
    [{ id:"book", title:"🔬 Book a Test" }],
  );
}

// ─── HOME COLLECTION ─────────────────────────────────────────────────────────
async function startHomeCollection(tenant, wa, phoneId, phone) {
  await wa.sendText(phoneId, phone,
    "🏠 *Home Sample Collection*\n\nWe collect from:\nKharghar · Panvel · Nerul · Airoli · Kopar Khairane\n\n*Additional charge: ₹150*\n\nPlease share your full address with landmark 👇",
  );
  setState(phone, "home_addr", {});
}

async function handleHomeAddr(tenant, wa, phoneId, phone, address) {
  clearState(phone);
  await wa.sendText(phoneId, phone,
    `✅ *Address noted!*\n\n📍 ${address}\n\nOur team will confirm your home collection within 30 minutes via this chat.\n\nFor urgent queries, call ${tenant.phone || "our front desk"}.`,
  );
}

// ─── REPORT RETRIEVAL ─────────────────────────────────────────────────────────
async function startReportRetrieval(tenant, wa, phoneId, phone) {
  await wa.sendText(phoneId, phone,
    "📄 *Report Retrieval*\n\nShare your:\n• Booking reference (e.g. #DC240301)\n  OR\n• Registered phone number\n\nType below 👇",
  );
  setState(phone, "report_req", {});
}

async function handleReportReq(tenant, wa, phoneId, phone, input) {
  clearState(phone);
  // TODO: query DB for appointment by ref/phone, check report status
  // For now: acknowledge
  await wa.sendText(phoneId, phone,
    "🔍 Checking your report…\n\nIf your report is ready, we'll send it here automatically. If the test is still being processed, you'll receive it as soon as the lab uploads the results.\n\nNo need to call — it comes directly to this chat! 🙏",
  );
}

// ─── HUMAN ESCALATION ────────────────────────────────────────────────────────
async function escalateToHuman(tenant, wa, phoneId, phone) {
  setState(phone, "human", {});
  await wa.sendText(phoneId, phone,
    `👩‍💼 *Connecting you to our team…*\n\nA staff member will respond within 5 minutes.\n🕐 Hours: ${tenant.open} – ${tenant.close}\n\nFeel free to type your question.`,
  );
}

async function notifyStaff(tenant, phone, message) {
  // In prod: emit to dashboard via Socket.io / Pusher
  // Also email staff via Resend
  console.log(`[STAFF NOTIFICATION] Tenant: ${tenant.id}, Patient: ${phone}, Msg: ${message}`);
}

// ─── SCHEDULED MESSAGES (called by scheduler) ─────────────────────────────────
async function sendReminder24h(tenant, appointment) {
  if (!tenant.wabaPhoneId || !global.waService) return;
  await global.waService.sendText(tenant.wabaPhoneId, appointment.patientPhone,
    `🔔 *Appointment Reminder*\n\nHi ${appointment.patientName},\n\nYou have a *${appointment.testName}* appointment tomorrow at *${appointment.slot}* at *${tenant.name}*.\n\n📋 Preparation: ${appointment.prep || "No special preparation needed"}\n\nRef: ${appointment.referenceNo}\n\n_Reply to this message if you need to reschedule._`,
  );
}

async function sendReminder2h(tenant, appointment) {
  if (!tenant.wabaPhoneId || !global.waService) return;
  await global.waService.sendText(tenant.wabaPhoneId, appointment.patientPhone,
    `⏰ *Appointment in 2 hours!*\n\n${appointment.patientName}, your *${appointment.testName}* is at *${appointment.slot}* today.\n\n📍 ${tenant.addr}\n🗺️ https://maps.google.com/?q=${encodeURIComponent(tenant.addr || tenant.name)}\n\nRef: ${appointment.referenceNo}`,
  );
}

async function sendNoShowRecovery(tenant, appointment) {
  if (!tenant.wabaPhoneId || !global.waService) return;
  await global.waService.sendInteractive(
    tenant.wabaPhoneId, appointment.patientPhone,
    `We missed you today, ${appointment.patientName} 😊\n\nWould you like to reschedule your *${appointment.testName}*?`,
    [{ id:"book", title:"📅 Reschedule" }, { id:"talk", title:"💬 Contact Us" }],
  );
}

module.exports = { handleIncomingMessage, sendReminder24h, sendReminder2h, sendNoShowRecovery };
