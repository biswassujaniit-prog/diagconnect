/**
 * DiagConnect — Slot Management Service
 * Sessions: Morning / Midday / Afternoon / Evening
 * Max 3 patients per 15-min slot. Race-condition safe via DB transaction.
 */

const SLOT_CAPACITY = 3;

const SESSIONS = [
  { id:"MORNING",   label:"Morning",   emoji:"🌅", start:"07:00", end:"11:00", color:"#F59E0B" },
  { id:"MIDDAY",    label:"Midday",    emoji:"☀️",  start:"11:00", end:"14:00", color:"#EF4444" },
  { id:"AFTERNOON", label:"Afternoon", emoji:"🌤",  start:"14:00", end:"18:00", color:"#6366F1" },
  { id:"EVENING",   label:"Evening",   emoji:"🌙",  start:"18:00", end:"20:00", color:"#0D9488" },
];

function generateSlots(start, end) {
  const slots = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endM = eh * 60 + em;
  while (cur < endM) {
    const h = Math.floor(cur / 60), mn = cur % 60;
    const time = `${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}`;
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const disp = `${h12}:${String(mn).padStart(2,"0")} ${h < 12 ? "AM" : "PM"}`;
    slots.push({ time, display: disp });
    cur += 15;
  }
  return slots;
}

async function getSlotAvailability(tenantId, date) {
  // In production this queries the DB. Stub returns all slots open.
  const now     = new Date();
  const isToday = new Date(date).toDateString() === now.toDateString();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  return SESSIONS.map(session => {
    const slots = generateSlots(session.start, session.end).map(slot => {
      const slotMins = parseInt(slot.time.split(":")[0]) * 60 + parseInt(slot.time.split(":")[1]);
      const isPast   = isToday && slotMins <= nowMins;
      return {
        time:      slot.time,
        display:   slot.display,
        booked:    0,
        available: SLOT_CAPACITY,
        capacity:  SLOT_CAPACITY,
        status:    isPast ? "PAST" : "OPEN",
      };
    });
    return { ...session, slots, openSlots: slots.filter(s => s.status === "OPEN").length };
  });
}

async function bookSlot(tenantId, patientId, testId, date, slotTime, source) {
  // In production this uses a DB transaction.
  // Returns a mock appointment for now.
  const ref = `#DC${Date.now().toString().slice(-6)}`;
  return { id: `A${Date.now()}`, tenantId, patientId, testId, date, slot: slotTime, status: "CONFIRMED", referenceNo: ref, bookingSource: source || "WALKIN" };
}

async function cancelSlot(appointmentId, reason) {
  return { id: appointmentId, status: "CANCELLED", cancelReason: reason };
}

async function getNextAvailableSlots(tenantId, n = 5) {
  const results = [];
  const today   = new Date();
  for (let dayOffset = 0; dayOffset < 7 && results.length < n; dayOffset++) {
    const date    = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const dateStr = date.toISOString().split("T")[0];
    const sessions = await getSlotAvailability(tenantId, dateStr);
    for (const session of sessions) {
      for (const slot of session.slots) {
        if (slot.status === "OPEN" && results.length < n) {
          results.push({
            date:      dateStr,
            dateLabel: dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : date.toLocaleDateString("en-IN", { weekday:"short", month:"short", day:"numeric" }),
            session:   session.label,
            emoji:     session.emoji,
            time:      slot.time,
            display:   slot.display,
            available: slot.available,
          });
        }
      }
    }
  }
  return results;
}

module.exports = { SESSIONS, SLOT_CAPACITY, generateSlots, getSlotAvailability, bookSlot, cancelSlot, getNextAvailableSlots };
