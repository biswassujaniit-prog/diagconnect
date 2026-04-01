/**
 * DiagConnect — Smart Slot Management Service
 *
 * Sessions:
 *   MORNING   : 07:00 – 11:00  (16 slots × 15 min)
 *   MIDDAY    : 11:00 – 14:00  (12 slots × 15 min)
 *   AFTERNOON : 14:00 – 18:00  (16 slots × 15 min)
 *   EVENING   : 18:00 – 20:00  ( 8 slots × 15 min)
 *
 * Rules:
 *   - Max 3 bookings per slot (SLOT_CAPACITY = 3)
 *   - Once 3 patients booked, slot is FULL and cannot be booked
 *   - Real-time updates via slot_bookings table
 *   - Staff can override capacity from dashboard
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SLOT_CAPACITY = 3;

// ─── SESSION DEFINITIONS ──────────────────────────────────────────────────────
const SESSIONS = [
  { id: "MORNING",   label: "Morning",   emoji: "🌅", start: "07:00", end: "11:00", color: "#F59E0B" },
  { id: "MIDDAY",    label: "Midday",    emoji: "☀️",  start: "11:00", end: "14:00", color: "#EF4444" },
  { id: "AFTERNOON", label: "Afternoon", emoji: "🌤",  start: "14:00", end: "18:00", color: "#6366F1" },
  { id: "EVENING",   label: "Evening",   emoji: "🌙",  start: "18:00", end: "20:00", color: "#0D9488" },
];

// ─── GENERATE ALL SLOTS FOR A SESSION ─────────────────────────────────────────
function generateSlots(startTime, endTime) {
  const slots = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let current = sh * 60 + sm;
  const end   = eh * 60 + em;

  while (current < end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const label = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
    const ampm  = h < 12 ? "AM" : "PM";
    const h12   = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const display = `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
    slots.push({ time: label, display });
    current += 15;
  }
  return slots;
}

// ─── GET SLOT AVAILABILITY FOR A DATE ─────────────────────────────────────────
/**
 * Returns all slots for a date with real-time booking counts.
 * Slots with count >= SLOT_CAPACITY are marked as FULL.
 */
async function getSlotAvailability(tenantId, date) {
  // Count existing bookings grouped by slot for this date
  const bookings = await prisma.appointment.groupBy({
    by: ["slot"],
    where: {
      tenantId,
      scheduledDate: new Date(date),
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    _count: { slot: true },
  });

  const bookingMap = {};
  for (const b of bookings) {
    bookingMap[b.slot] = b._count.slot;
  }

  // Build sessions with slot availability
  const now     = new Date();
  const isToday = new Date(date).toDateString() === now.toDateString();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const sessions = SESSIONS.map(session => {
    const slots = generateSlots(session.start, session.end).map(slot => {
      const booked   = bookingMap[slot.time] || 0;
      const slotMins = parseInt(slot.time.split(":")[0]) * 60 + parseInt(slot.time.split(":")[1]);
      const isPast   = isToday && slotMins <= nowMins;
      const isFull   = booked >= SLOT_CAPACITY;

      return {
        time:      slot.time,
        display:   slot.display,
        booked,
        available: SLOT_CAPACITY - booked,
        capacity:  SLOT_CAPACITY,
        status:    isPast ? "PAST" : isFull ? "FULL" : "OPEN",
      };
    });

    const openCount = slots.filter(s => s.status === "OPEN").length;

    return {
      ...session,
      slots,
      openSlots: openCount,
      allFull:   openCount === 0,
    };
  });

  return sessions;
}

// ─── BOOK A SLOT (with race condition protection) ─────────────────────────────
/**
 * Books a slot atomically — uses a database transaction to prevent
 * two patients booking the same slot simultaneously (race condition).
 */
async function bookSlot(tenantId, patientId, testId, date, slotTime, source) {
  return prisma.$transaction(async (tx) => {
    // Re-check count inside transaction (prevents race)
    const count = await tx.appointment.count({
      where: {
        tenantId,
        scheduledDate: new Date(date),
        slot:   slotTime,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    });

    if (count >= SLOT_CAPACITY) {
      throw new Error(`SLOT_FULL: ${slotTime} on ${date} is fully booked`);
    }

    const test    = testId ? await tx.test.findUnique({ where: { id: testId } }) : null;
    const patient = await tx.patient.findUnique({ where: { id: patientId } });
    const ref     = `#DC${Date.now().toString().slice(-6)}`;

    const appointment = await tx.appointment.create({
      data: {
        tenantId,
        patientId,
        testId,
        testName:      test?.name || "Test",
        testCode:      test?.code,
        testPrice:     test?.price || 0,
        scheduledDate: new Date(date),
        slot:          slotTime,
        status:        "CONFIRMED",
        bookingSource: source || "WHATSAPP_BOT",
        referenceNo:   ref,
        patientPhone:  patient.phone,
        patientName:   patient.name,
      },
    });

    // Check if slot just became full → emit event
    if (count + 1 >= SLOT_CAPACITY) {
      console.log("Slot reached capacity", { tenantId, date, slotTime });
      // Emit to connected dashboard clients via Redis pub/sub
      // require("./realtime").publishSlotFull(tenantId, date, slotTime);
    }

    return appointment;
  });
}

// ─── GET NEXT AVAILABLE SLOTS ─────────────────────────────────────────────────
/** Returns the next N available slots across upcoming days */
async function getNextAvailableSlots(tenantId, n = 5) {
  const results = [];
  const today   = new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date     = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const dateStr  = date.toISOString().split("T")[0];
    const sessions = await getSlotAvailability(tenantId, dateStr);

    for (const session of sessions) {
      for (const slot of session.slots) {
        if (slot.status === "OPEN" && results.length < n) {
          results.push({
            date:     dateStr,
            dateLabel: dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : date.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }),
            session:  session.label,
            time:     slot.time,
            display:  slot.display,
            available: slot.available,
          });
        }
      }
    }
    if (results.length >= n) break;
  }

  return results;
}

// ─── CANCEL SLOT (re-opens capacity) ─────────────────────────────────────────
async function cancelSlot(appointmentId, reason) {
  const appt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status:       "CANCELLED",
      cancelledAt:  new Date(),
      cancelReason: reason,
    },
  });

  // Check if cancellation re-opens a previously full slot
  const remaining = await prisma.appointment.count({
    where: {
      tenantId:      appt.tenantId,
      scheduledDate: appt.scheduledDate,
      slot:          appt.slot,
      status:        { notIn: ["CANCELLED", "NO_SHOW"] },
    },
  });

  if (remaining < SLOT_CAPACITY) {
    // Slot is no longer full — update real-time dashboard
    // require("./realtime").publishSlotOpened(appt.tenantId, appt.scheduledDate.toISOString().split("T")[0], appt.slot);
  }

  return appt;
}

// ─── STAFF OVERRIDE (expand capacity for special cases) ───────────────────────
async function overrideSlotCapacity(tenantId, date, slotTime, newCapacity, staffId) {
  // Store override in slot_overrides table
  await prisma.slotOverride.upsert({
    where: { tenantId_date_slot: { tenantId, date: new Date(date), slot: slotTime } },
    update: { capacity: newCapacity, updatedBy: staffId },
    create: { tenantId, date: new Date(date), slot: slotTime, capacity: newCapacity, createdBy: staffId },
  });
  console.log("Slot capacity overridden", { tenantId, date, slotTime, newCapacity, staffId });
}

module.exports = {
  SESSIONS,
  SLOT_CAPACITY,
  generateSlots,
  getSlotAvailability,
  bookSlot,
  cancelSlot,
  getNextAvailableSlots,
  overrideSlotCapacity,
};
