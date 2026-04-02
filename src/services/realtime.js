/**
 * Realtime slot notification service (stub)
 * Will be replaced with WebSocket / SSE implementation
 */

function publishSlotFull(tenantId, date, slotTime) {
  console.log(`[REALTIME] Slot full: tenant=${tenantId} date=${date} slot=${slotTime}`);
}

function publishSlotOpened(tenantId, date, slotTime) {
  console.log(`[REALTIME] Slot opened: tenant=${tenantId} date=${date} slot=${slotTime}`);
}

module.exports = { publishSlotFull, publishSlotOpened };
