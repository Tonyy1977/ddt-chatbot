// api/suggest.js — Vercel serverless version of TidyCal scheduling logic (dynamic filtering)

const SLOT_RULES = {
  workingWindows: {
    3: [{ start: { h: 17, m: 0 }, end: { h: 20, m: 0 } }], // Wednesday 5–8pm
    6: [{ start: { h: 11, m: 0 }, end: { h: 13, m: 0 } }], // Saturday 11–1pm
    0: [{ start: { h: 14, m: 0 }, end: { h: 16, m: 0 } }], // Sunday 2–4pm
  },
  bufferMins: 120,
};

const POLICY_SUMMARY =
  "We currently schedule on Wednesday (5–8pm), Saturday (11am–1pm), and Sunday (2–4pm). " +
  "Tours are 15 minutes; meetings are 30 minutes.";

// ---------- helpers ----------
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isSameDay = (a, b) => a.toDateString() === b.toDateString();
const addMinutes = (d, mins) => new Date(d.getTime() + mins * 60000);
const addDays = (d, days) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

function parseYMD(dateStr) {
  const [yy, mm, dd] = (dateStr || "").split("-").map(Number);
  const d = new Date();
  if (!yy || !mm || !dd) {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setFullYear(yy, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return d;
}
function setHhMm(base, hh, mm) {
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d;
}
function alignToGrid(d, stepMins) {
  const minutes = d.getMinutes();
  const over = minutes % stepMins;
  if (over === 0) return d;
  return addMinutes(d, stepMins - over);
}
function formatHuman(d) {
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}
function windowsForDate(dateObj) {
  return SLOT_RULES.workingWindows[dateObj.getDay()] || [];
}
function noon(dateObj) {
  return setHhMm(dateObj, 12, 0);
}

async function getAllBookingsJSON() {
  const apiKey = process.env.TIDYCAL_API_KEY;
  const resp = await fetch("https://tidycal.com/api/bookings", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await resp.json();
  return data?.data || [];
}

// ---------------- slot builders ----------------
function buildCandidateWindows(dateObj, stepMins, preference) {
  const all = windowsForDate(dateObj);
  if (!all.length) return [];
  const cand = [];
  for (const w of all) {
    const ws = setHhMm(dateObj, w.start.h, w.start.m);
    const we = setHhMm(dateObj, w.end.h, w.end.m);
    const latestStart = addMinutes(we, -stepMins);
    if (latestStart < ws) continue;
    const n = noon(dateObj);
    let start = ws, endStart = latestStart;
    if (preference === "morning") {
      endStart = addMinutes(n, -stepMins);
      if (endStart < ws) continue;
    } else if (preference === "afternoon") {
      if (latestStart < n) continue;
      start = n > ws ? n : ws;
    }
    cand.push({ start, endStart, stepMins });
  }
  return cand;
}

function findSlotsForDay({ dateObj, stepMins, preference, bookings, afterISO, count = 1, strategy = "first" }) {
  const windows = buildCandidateWindows(dateObj, stepMins, preference);
  if (!windows.length) return { slots: [], hadWindows: false };
  const now = new Date();
  const isToday = isSameDay(now, dateObj);
  const candidates = [];
  for (const w of windows) {
    let minStart = new Date(w.start);
    if (afterISO) {
      let after = /^\d{1,2}:\d{2}$/.test(afterISO)
        ? setHhMm(dateObj, ...afterISO.split(":").map(Number))
        : new Date(afterISO);
      if (isSameDay(after, dateObj) && after > minStart) minStart = after;
    }
    if (isToday) {
      const cutoff = alignToGrid(addMinutes(now, SLOT_RULES.bufferMins), w.stepMins);
      if (cutoff > minStart) minStart = cutoff;
    }
    minStart = alignToGrid(minStart, w.stepMins);
    for (let cur = new Date(minStart); cur <= w.endStart; cur = addMinutes(cur, w.stepMins)) {
      const end = addMinutes(cur, w.stepMins);
      const bad = bookings.some((b) => {
        const bs = new Date(b.starts_at), be = new Date(b.ends_at);
        return overlaps(cur, end, bs, be);
      });
      if (!bad) candidates.push({ start: new Date(cur), end });
    }
  }
  if (!candidates.length) return { slots: [], hadWindows: true };
  let ordered = candidates.slice().sort((a, b) => a.start - b.start);
  if (strategy === "last") ordered = ordered.slice(-count);
  else ordered = ordered.slice(0, count);
  return {
    slots: ordered.map(({ start, end }) => ({
      start: start.toISOString(),
      end: end.toISOString(),
      human: formatHuman(start),
    })),
    hadWindows: true,
  };
}

function findNextAvailableForward({ startDateObj, stepMins, preference, bookings, afterISO, count = 3 }) {
  for (let i = 0; i < 60; i++) {
    const dateObj = addDays(startDateObj, i);
    const res = findSlotsForDay({ dateObj, stepMins, preference, bookings, afterISO, count });
    if (res.slots.length) {
      return { dateYMD: ymd(dateObj), options: res.slots };
    }
  }
  return null;
}

// ---------------- handler ----------------
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const type = String(req.query.type || "").toLowerCase();       // "tour" or "meeting"
    const preference = String(req.query.preference || "").toLowerCase();
    const dateStr = String(req.query.date || ymd(new Date()));
    const afterISO = req.query.after ? String(req.query.after) : "";
    const count = Math.max(1, Math.min(5, Number(req.query.count) || 1));
    const strategy = String(req.query.strategy || "first").toLowerCase();

    // fetch all booking types dynamically
    const allBookings = await getAllBookingsJSON();

    // filter bookings dynamically
    let selectedBookings = allBookings;
    let stepMins = 30; // default
    let bookingUrl = "";

    if (type === "tour") {
      selectedBookings = allBookings.filter(b => /home tour/i.test(b.name));
      stepMins = 15;
      bookingUrl = selectedBookings[0]?.url || "";
    } else if (type === "meeting") {
      selectedBookings = allBookings.filter(b => /meeting/i.test(b.name));
      stepMins = 30;
      bookingUrl = selectedBookings[0]?.url || "";
    }

    const dateObj = parseYMD(dateStr);
    const windows = windowsForDate(dateObj);

    if (!windows.length) {
      const next = findNextAvailableForward({
        startDateObj: addDays(dateObj, 1), stepMins, preference,
        bookings: selectedBookings, afterISO,
      });
      return res.status(403).json({
        error: "Closed day", closedDay: true, policy: POLICY_SUMMARY,
        type, preference, dateYMD: ymd(dateObj),
        bookingUrl, nextAvailable: next,
      });
    }

    const { slots, hadWindows } = findSlotsForDay({
      dateObj, stepMins, preference, bookings: selectedBookings, afterISO, count, strategy
    });

    if (!slots.length) {
      const next = findNextAvailableForward({
        startDateObj: addDays(dateObj, 1), stepMins, preference,
        bookings: selectedBookings, afterISO,
      });
      return res.status(404).json({
        error: hadWindows ? "Fully booked" : "Closed day", fullyBooked: hadWindows,
        closedDay: !hadWindows, policy: POLICY_SUMMARY,
        type, preference, dateYMD: ymd(dateObj),
        bookingUrl, nextAvailable: next,
      });
    }

    const primary = slots[0];
    return res.status(200).json({
      type, preference, dateYMD: ymd(dateObj),
      bookingUrl,
      options: slots,
      start: primary.start, end: primary.end,
      human: primary.human, policy: POLICY_SUMMARY,
    });
  } catch (err) {
    console.error("❌ /api/suggest error:", err);
    return res.status(500).json({ error: "Failed to suggest a time" });
  }
}
