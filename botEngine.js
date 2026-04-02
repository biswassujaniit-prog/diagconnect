/**
 * DiagConnect — WhatsApp Bot Engine
 * Handles all incoming patient messages via Interakt
 */

const { SESSIONS, getSlotAvailability } = require("./slotManager");

const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "+1 5559164731";

// In-memory conversation state (use Redis in production)
const convState = new Map();
function getState(phone) { return convState.get(phone) || { state: "idle", data: {} }; }
function setState(phone, state, data = {}) { convState.set(phone, { state, data }); }
function clearState(phone) { convState.delete(phone); }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning! ☀️" : h < 17 ? "Good afternoon! 🌤" : "Good evening! 🌙";
}

async function handleIncomingMessage(tenant, message, contact, wa) {
  const phone   = contact.wa_id;
  const msgType = message.type;

  let input = "";
  if (msgType === "text")        input = message.text?.body?.trim() || "";
  if (msgType === "interactive") {
    input = message.interactive?.button_reply?.title
         || message.interactive?.list_reply?.title
         || message.interactive?.button_reply?.id
         || "";
  }
  const lo = input.toLowerCase();

  // Mark as read
  try { await wa.markRead(phone); } catch {}

  const conv = getState(phone);

  // Global reset
  if (!input || ["hi","hello","menu","start"].includes(lo) || lo.includes("main menu")) {
    clearState(phone);
    return sendMainMenu(tenant, wa, phone);
  }

  switch (conv.state) {
    case "book_test":    return handleBookTest(tenant, wa, phone, input, conv.data);
    case "book_session": return handleBookSession(tenant, wa, phone, input, conv.data);
    case "book_slot":    return handleBookSlot(tenant, wa, phone, input, conv.data);
    case "book_name":    return handleBookName(tenant, wa, phone, input, conv.data);
    case "book_confirm": return handleBookConfirm(tenant, wa, phone, lo, conv.data);
    case "home_addr":    return handleHomeAddr(tenant, wa, phone, input);
    case "report_req":   return handleReportReq(tenant, wa, phone, input);
    default:             return handleIdle(tenant, wa, phone, input, lo);
  }
}

async function sendMainMenu(tenant, wa, phone) {
  setState(phone, "idle");
  return wa.sendInteractive(phone,
    `${greeting()} Welcome to *${tenant.name}*! 🏥\n\nOpen ${tenant.open || "08:00"} – ${tenant.close || "20:00"}`,
    [
      { id:"book",   title:"🔬 Book a Test" },
      { id:"prices", title:"💰 Test Prices"  },
      { id:"slots",  title:"📅 View Slots"   },
    ],
    null,
    'Reply "report" for results · "home" for collection'
  );
}

async function handleIdle(tenant, wa, phone, input, lo) {
  if (lo === "book"   || lo.includes("book"))                return startBooking(tenant, wa, phone);
  if (lo === "prices" || lo.includes("price"))               return sendPrices(tenant, wa, phone);
  if (lo === "slots"  || lo.includes("slot"))                return sendSlotSummary(tenant, wa, phone);
  if (lo.includes("home")   || lo.includes("collect"))       return startHomeCollection(tenant, wa, phone);
  if (lo.includes("report") || lo.includes("result"))        return startReportRetrieval(tenant, wa, phone);
  if (lo.includes("talk")   || lo.includes("staff"))         return escalateToHuman(tenant, wa, phone);
  return sendMainMenu(tenant, wa, phone);
}

async function startBooking(tenant, wa, phone) {
  const tests = [
    { code:"CBC",   name:"Complete Blood Count",  price:300  },
    { code:"TSH",   name:"Thyroid Profile",        price:450  },
    { code:"HBA1C", name:"HbA1c",                  price:400  },
    { code:"LIPID", name:"Lipid Profile",          price:500  },
    { code:"FBC",   name:"Full Body Checkup",      price:1799 },
    { code:"DIAB",  name:"Diabetes Care Package",  price:899  },
  ];
  await wa.sendList(phone,
    "Which test would you like to book? 🔬\nAll prices from our master catalog:",
    "Select Test",
    [{ title:"Popular Tests", rows: tests.slice(0,4).map(t => ({ id:`test_${t.code}`, title:t.name.slice(0,24), description:`₹${t.price}` })) },
     { title:"Packages",      rows: tests.slice(4).map(t => ({ id:`test_${t.code}`, title:t.name.slice(0,24), description:`₹${t.price}` })).concat([{ id:"test_OTHER", title:"Other test", description:"Type name" }]) }]
  );
  setState(phone, "book_test", {});
}

async function handleBookTest(tenant, wa, phone, input, data) {
  const testMap = { test_CBC:"Complete Blood Count|300", test_TSH:"Thyroid Profile|450", test_HBA1C:"HbA1c|400", test_LIPID:"Lipid Profile|500", test_FBC:"Full Body Checkup|1799", test_DIAB:"Diabetes Care Package|899" };
  let testName = input, price = "";
  const key = Object.keys(testMap).find(k => input.startsWith(k));
  if (key) { [testName, price] = testMap[key].split("|"); }
  await wa.sendInteractive(phone,
    `*${testName}* ✅\n\nWhich session works best?`,
    [{ id:"sess_MORNING",   title:"🌅 Morning (7–11am)"  },
     { id:"sess_MIDDAY",    title:"☀️ Midday (11am–2pm)" },
     { id:"sess_AFTERNOON", title:"🌤 Afternoon (2–6pm)" }],
    null, "Reply 'evening' for 6–8pm slots"
  );
  setState(phone, "book_session", { testName, price });
}

async function handleBookSession(tenant, wa, phone, input, data) {
  const sessMap = { sess_MORNING:"MORNING", sess_MIDDAY:"MIDDAY", sess_AFTERNOON:"AFTERNOON", sess_EVENING:"EVENING" };
  const lo = input.toLowerCase();
  const sessionId = sessMap[input] || (lo.includes("morning") ? "MORNING" : lo.includes("midday") ? "MIDDAY" : lo.includes("afternoon") ? "AFTERNOON" : lo.includes("evening") ? "EVENING" : "MORNING");
  const session  = SESSIONS.find(s => s.id === sessionId);
  const today    = new Date().toISOString().split("T")[0];
  let slots = [];
  try {
    const sessions = await getSlotAvailability(tenant.id || "demo", today);
    slots = sessions.find(s => s.id === sessionId)?.slots.filter(sl => sl.status === "OPEN").slice(0, 6) || [];
  } catch { slots = [{time:"09:00",display:"9:00 AM",available:3},{time:"09:15",display:"9:15 AM",available:3},{time:"09:30",display:"9:30 AM",available:3}]; }

  if (!slots.length) {
    return wa.sendInteractive(phone, `😔 No open slots in ${session?.label} today. Try another session:`,
      [{ id:"sess_MORNING", title:"🌅 Morning" }, { id:"sess_AFTERNOON", title:"🌤 Afternoon" }, { id:"sess_EVENING", title:"🌙 Evening" }]);
  }
  await wa.sendInteractive(phone,
    `*${session?.emoji} ${session?.label}* available slots:\n\n${slots.map(s => `• ${s.display} — ${s.available} spots`).join("\n")}`,
    slots.slice(0,3).map(s => ({ id:`slot_${s.time}`, title:`${s.display} (${s.available} left)` }))
  );
  setState(phone, "book_slot", { ...data, sessionId });
}

async function handleBookSlot(tenant, wa, phone, input, data) {
  const slotTime = input.replace("slot_","");
  await wa.sendText(phone, "Patient's full name? 👤\n_(Type below)_");
  setState(phone, "book_name", { ...data, slot:slotTime, date:new Date().toISOString().split("T")[0] });
}

async function handleBookName(tenant, wa, phone, name, data) {
  const ref = "#DC" + Math.floor(Math.random() * 900000 + 100000);
  await wa.sendInteractive(phone,
    `📋 *Booking Summary*\n\n👤 ${name}\n🔬 ${data.testName}\n📅 Today at ${data.slot}\n📍 ${tenant.name}\n💰 ₹${data.price || "Quoted"}\n🆔 Ref: *${ref}*\n\nConfirm?`,
    [{ id:"confirm_yes", title:"✅ Confirm" }, { id:"confirm_no", title:"✏️ Change" }]
  );
  setState(phone, "book_confirm", { ...data, name, ref });
}

async function handleBookConfirm(tenant, wa, phone, lo, data) {
  clearState(phone);
  if (lo.includes("confirm_no") || lo.includes("change")) return startBooking(tenant, wa, phone);
  await wa.sendText(phone, `🎉 *Booking Confirmed!*\n\nRef: *${data.ref}*\n👤 ${data.name}\n🔬 ${data.testName}\n📅 Today at ${data.slot}\n📍 ${tenant.addr || tenant.name}\n\n_Reminder 24h before. Report auto-delivered when ready._ 🙏`);
}

async function sendPrices(tenant, wa, phone) {
  const tests = [
    {name:"Complete Blood Count",price:300},{name:"Thyroid Profile",price:450},
    {name:"HbA1c",price:400},{name:"Lipid Profile",price:500},
    {name:"Urine Routine",price:180},{name:"Full Body Checkup ⭐",price:1799},
    {name:"Diabetes Care Package",price:899},{name:"Vitamin D",price:800},
  ];
  return wa.sendInteractive(phone,
    tests.map(t => `🔵 *${t.name}* — ₹${t.price}`).join("\n") + "\n\n_Prices from master catalog. Tap to book._",
    [{ id:"book", title:"🔬 Book a Test" }, { id:"home", title:"🏠 Home Collection" }]
  );
}

async function sendSlotSummary(tenant, wa, phone) {
  const today = new Date().toISOString().split("T")[0];
  let text = "📅 *Today\'s Available Slots*\n\n";
  try {
    const sessions = await getSlotAvailability(tenant.id || "demo", today);
    for (const s of sessions) {
      const open = s.slots.filter(sl => sl.status === "OPEN").length;
      text += `${s.emoji} *${s.label}* (${s.start}–${s.end}) — ${open > 0 ? `${open} open` : "Full ❌"}\n`;
    }
  } catch { text += "🌅 Morning · ☀️ Midday · 🌤 Afternoon · 🌙 Evening\nAll sessions available"; }
  return wa.sendInteractive(phone, text + "\n\nBook a test to select your slot:",
    [{ id:"book", title:"🔬 Book a Test" }]);
}

async function startHomeCollection(tenant, wa, phone) {
  await wa.sendText(phone, "🏠 *Home Sample Collection*\n\nCoverage: Kharghar · Panvel · Nerul · Airoli\n*Extra charge: ₹150*\n\nShare your full address with landmark 👇");
  setState(phone, "home_addr", {});
}

async function handleHomeAddr(tenant, wa, phone, address) {
  clearState(phone);
  await wa.sendText(phone, `✅ *Address noted!*\n\n📍 ${address}\n\nTeam will confirm within 30 minutes via WhatsApp.`);
}

async function startReportRetrieval(tenant, wa, phone) {
  await wa.sendText(phone, "📄 *Report Retrieval*\n\nShare your booking reference (e.g. #DC240301) or registered phone number 👇");
  setState(phone, "report_req", {});
}

async function handleReportReq(tenant, wa, phone, input) {
  clearState(phone);
  await wa.sendText(phone, "🔍 Checking your report...\n\nIf ready, it will be sent here automatically. If still processing, you\'ll receive it as soon as the lab uploads results. 🙏");
}

async function escalateToHuman(tenant, wa, phone) {
  setState(phone, "human", {});
  await wa.sendText(phone, `👩‍💼 *Connecting to team...*\n\nA staff member will respond within 5 minutes.\n🕐 Hours: ${tenant.open || "08:00"} – ${tenant.close || "20:00"}`);
}

async function sendReminder24h(tenant, appointment) {
  try {
    const wa = require("./whatsapp");
    await wa.sendText(appointment.patientPhone,
      `🔔 *Appointment Reminder*\n\nHi ${appointment.patientName},\n\nYou have a *${appointment.testName}* appointment tomorrow at *${appointment.slot}* at *${tenant.name}*.\n\nPrep: ${appointment.prep || "No special preparation"}\nRef: ${appointment.referenceNo}`
    );
  } catch (err) { console.error("Reminder 24h failed:", err.message); }
}

async function sendReminder2h(tenant, appointment) {
  try {
    const wa = require("./whatsapp");
    await wa.sendText(appointment.patientPhone,
      `⏰ *Appointment in 2 hours!*\n\n${appointment.patientName}, your *${appointment.testName}* is at *${appointment.slot}* today.\n📍 ${tenant.addr || tenant.name}\nRef: ${appointment.referenceNo}`
    );
  } catch (err) { console.error("Reminder 2h failed:", err.message); }
}

async function sendNoShowRecovery(tenant, appointment) {
  try {
    const wa = require("./whatsapp");
    await wa.sendInteractive(appointment.patientPhone,
      `We missed you today, ${appointment.patientName} 😊\n\nWould you like to reschedule your *${appointment.testName}*?`,
      [{ id:"book", title:"📅 Reschedule" }, { id:"talk", title:"💬 Contact Us" }]
    );
  } catch (err) { console.error("No-show recovery failed:", err.message); }
}

module.exports = { handleIncomingMessage, sendReminder24h, sendReminder2h, sendNoShowRecovery };
