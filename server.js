// server.js (v3) — Enforce new working days/hours and continuous availability checks
// Policy (effective immediately):
// - We only conduct bookings on: Wednesday, Saturday, Sunday
// - Wednesday: 17:00–20:00
// - Saturday: 11:00–13:00
// - Sunday:   14:00–16:00
// - Tours = 15 minutes (last starts 15 minutes before window end)
// - Meetings = 30 minutes (last starts 30 minutes before window end)
// - Same-day 120 min buffer
// - Suggest endpoint supports: count, strategy, after (ISO or 'HH:mm'), preference filtering
// - If requested day is not a working day → 403 { closedDay: true, nextAvailable }
// - If requested day is fully booked → 404 { fullyBooked: true, nextAvailable }

import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import mongoose from "mongoose";
import cors from "cors";

dotenv.config();
const app = express();

/* ---------------------------- CORS ---------------------------- */
const allowedOrigins = [
  "http://localhost:3000",
  "https://ddt-chatbot-gy6g.vercel.app",
];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) cb(null, origin);
      else cb(new Error("CORS not allowed from this origin"));
    },
    credentials: true,
  })
);
app.use(express.json());

/* -------------------------- MongoDB --------------------------- */
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const chatSchema = new mongoose.Schema({
  sender: String,
  text: String,
  timestamp: Date,
  sessionId: String,
});
const Chat = mongoose.model("Chat", chatSchema);

/* ------------------------- Debug keys ------------------------- */
console.log("🔑 Loaded OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("🔑 Loaded TIDYCAL_API_KEY:", !!process.env.TIDYCAL_API_KEY);

/* ----------------------- Chat Endpoints ----------------------- */
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, sessionId = "guest" } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OpenAI API key" });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o", messages }),
    });

    const text = await response.text();
    if (!response.ok) return res.status(response.status).json({ error: `OpenAI error: ${text}` });

    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content || "Sorry, something went wrong.";

    if (messages?.length) {
      const userMsg = messages[messages.length - 1];
      await Chat.create({ sender: "user", text: userMsg.content, timestamp: new Date(), sessionId });
    }
    await Chat.create({ sender: "bot", text: reply, timestamp: new Date(), sessionId });

    res.json(data);
  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/api/history", async (req, res) => {
  try {
    const { sessionId, messages } = req.body;
    if (!sessionId || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const saved = await Chat.insertMany(
      messages.map((m) => ({ sender: m.sender, text: m.text, timestamp: new Date(), sessionId }))
    );
    res.json({ success: true, saved });
  } catch (err) {
    console.error("❌ Failed to save history:", err);
    res.status(500).json({ error: "Failed to save history" });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId query param" });
    const chatHistory = await Chat.find({ sessionId }).sort({ timestamp: 1 });
    res.json(chatHistory);
  } catch (err) {
    console.error("❌ Failed to fetch chat history:", err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

app.get("/api/admin/messages", async (_req, res) => {
  try {
    const allMessages = await Chat.find({}).sort({ timestamp: 1 });
    res.json(allMessages);
  } catch (err) {
    console.error("❌ Failed to fetch admin messages:", err);
    res.status(500).json({ error: "Failed to fetch admin messages" });
  }
});

/* ---------------------- Scheduling Config ---------------------- */

const SLOT_RULES = {
  types: {
    tour:    { stepMins: 15, url: "https://tidycal.com/ddtenterpriseusa/15-minute-meeting" },
    meeting: { stepMins: 30, url: "https://tidycal.com/ddtenterpriseusa/30-minute-meeting" },
  },
  // Only these working windows are valid
  // JS getDay(): 0 Sunday, 1 Monday, ..., 3 Wednesday, 6 Saturday
  workingWindows: {
    3: [ { start: { h: 17, m: 0 }, end: { h: 20, m: 0 } } ], // Wednesday 5pm–8pm
    6: [ { start: { h: 11, m: 0 }, end: { h: 13, m: 0 } } ], // Saturday 11am–1pm
    0: [ { start: { h: 14, m: 0 }, end: { h: 16, m: 0 } } ], // Sunday   2pm–4pm
  },
  bufferMins: 120,
};

const POLICY_SUMMARY =
  "We currently schedule on Wednesday (5–8pm), Saturday (11am–1pm), and Sunday (2–4pm). " +
  "Tours are 15 minutes; meetings are 30 minutes. Last start is 15/30 minutes before the window ends.";

// ---------- helpers ----------
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
  d.setFullYear(yy);
  d.setMonth(mm - 1);
  d.setDate(dd);
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
  if (over === 0) {
    const z = new Date(d);
    z.setSeconds(0, 0);
    return z;
  }
  const diff = stepMins - over;
  const aligned = addMinutes(d, diff);
  aligned.setSeconds(0, 0);
  return aligned;
}

function formatHuman(d) {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ----------------- Read existing TidyCal bookings ---------------- */
async function getAllBookingsJSON() {
  const apiKey = process.env.TIDYCAL_API_KEY;
  const resp = await fetch("https://tidycal.com/api/bookings", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const txt = await resp.text();
    throw new Error("Non-JSON from TidyCal /bookings: " + txt.slice(0, 200));
  }
  const data = await resp.json();
  return data?.data || [];
}

/* ---------------- Build candidate windows for a date ---------------- */
function windowsForDate(dateObj) {
  const dow = dateObj.getDay();
  return SLOT_RULES.workingWindows[dow] || [];
}

function noon(dateObj) {
  return setHhMm(dateObj, 12, 0);
}

function buildCandidateWindows(dateObj, typeKey, preference) {
  const all = windowsForDate(dateObj);
  const stepMins = SLOT_RULES.types[typeKey].stepMins;
  if (!all.length) return [];

  const cand = [];
  for (const w of all) {
    const ws = setHhMm(dateObj, w.start.h, w.start.m);
    const we = setHhMm(dateObj, w.end.h,   w.end.m);
    // Latest allowed start is window end - duration
    const latestStart = addMinutes(we, -stepMins);
    if (latestStart < ws) continue; // window too small for duration

    // Preference filter against noon
    const n = noon(dateObj);
    let start = ws, endStart = latestStart;
    if (preference === "morning") {
      // end must be <= noon → start <= noon - step
      endStart = addMinutes(n, -stepMins);
      if (endStart < ws) continue; // nothing morning in this window
    } else if (preference === "afternoon") {
      // start must be >= noon
      if (latestStart < n) continue; // window sits fully before noon
      start = n > ws ? n : ws;
    }

    cand.push({ start, endStart, stepMins, windowEnd: we });
  }
  return cand;
}

/* -------------- Compute N slots for a given day ------------- */
function findSlotsForDay({
  dateObj,
  typeKey,
  preference,
  bookings,
  afterISO,
  count = 1,
  strategy = "first", // 'first' | 'last' | 'nearest'
}) {
  const windows = buildCandidateWindows(dateObj, typeKey, preference);
  if (!windows.length) return { slots: [], hadWindows: false }; // closed day for this preference

  // same-day buffer
  const now = new Date();
  const isToday = isSameDay(now, dateObj);

  const candidates = [];
  for (const w of windows) {
    const { stepMins } = w;
    // compute minStart per window
    let minStart = new Date(w.start);

    // after anchor: if same day, apply
    if (afterISO) {
      let after;
      if (/^\d{1,2}:\d{2}$/.test(afterISO)) {
        const [hh, mm] = afterISO.split(":").map(Number);
        after = setHhMm(dateObj, hh, mm);
      } else {
        after = new Date(afterISO);
      }
      if (isSameDay(after, dateObj) && after > minStart) minStart = after;
    }

    // same-day buffer
    if (isToday) {
      const cutoff = alignToGrid(addMinutes(now, SLOT_RULES.bufferMins), stepMins);
      if (cutoff > minStart) minStart = cutoff;
    }

    // align and iterate
    minStart = alignToGrid(minStart, stepMins);
    for (let cur = new Date(minStart); cur <= w.endStart; cur = addMinutes(cur, stepMins)) {
      const end = addMinutes(cur, stepMins);

      // Check overlap against all bookings
      const bad = bookings.some((b) => {
        const bs = new Date(b.starts_at);
        const be = new Date(b.ends_at);
        return overlaps(cur, end, bs, be);
      });
      if (!bad) candidates.push({ start: new Date(cur), end: new Date(end) });
    }
  }

  if (!candidates.length) return { slots: [], hadWindows: true };

  // order/strategy
  let ordered = candidates.slice().sort((a, b) => a.start - b.start);

  if (strategy === "last") {
    ordered = ordered.slice(-count);
  } else if (strategy === "nearest" && afterISO) {
    const anchor = /^\d{1,2}:\d{2}$/.test(afterISO)
      ? setHhMm(dateObj, Number(afterISO.split(":")[0]), Number(afterISO.split(":")[1]))
      : new Date(afterISO);
    ordered = candidates
      .slice()
      .sort((a, b) => Math.abs(a.start - anchor) - Math.abs(b.start - anchor))
      .slice(0, count);
  } else {
    ordered = ordered.slice(0, count);
  }

  const humanized = ordered.map(({ start, end }) => ({
    start: start.toISOString(),
    end: end.toISOString(),
    human: formatHuman(start),
  }));

  return { slots: humanized, hadWindows: true };
}

/* --------- scan forward to find next available day with options --------- */
function findNextAvailableForward({
  startDateObj, // date *after* the requested day
  typeKey,
  preference,
  bookings,
  afterISO, // keep same clock anchor
  count = 3,
  strategy = "first",
  horizonDays = 45,
}) {
  for (let i = 0; i < horizonDays; i++) {
    const dateObj = addDays(startDateObj, i);
    const res = findSlotsForDay({ dateObj, typeKey, preference, bookings, afterISO, count, strategy });
    if (res.slots.length) {
      return { dateYMD: ymd(dateObj), options: res.slots };
    }
  }
  return null;
}

/* ----------------- Suggest Endpoint ----------------- */
/**
 * GET /api/tidycal/suggest
 * Query:
 *  - type: 'tour' | 'meeting'
 *  - preference: '' | 'morning' | 'afternoon'
 *  - date: 'YYYY-MM-DD' (optional; default= today)
 *  - after: ISO datetime or 'HH:mm' clock (optional)
 *  - count: number of options to return (default=1, max=5)
 *  - strategy: 'first' | 'last' | 'nearest' (optional, default 'first')
 */
app.get("/api/tidycal/suggest", async (req, res) => {
  try {
    const apiKey = process.env.TIDYCAL_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing TidyCal API key" });

    const type = String(req.query.type || "meeting").toLowerCase();
    const preference = String(req.query.preference || "").toLowerCase();
    const dateStr = String(req.query.date || ymd(new Date()));
    const afterISO = req.query.after ? String(req.query.after) : "";
    const count = Math.max(1, Math.min(5, Number(req.query.count) || 1));
    const strategy = String(req.query.strategy || "first").toLowerCase();

    if (!SLOT_RULES.types[type]) {
      return res.status(400).json({ error: "Invalid booking type" });
    }

    const dateObj = parseYMD(dateStr);
    const bookings = await getAllBookingsJSON();

    // validate working day
    const windows = windowsForDate(dateObj);
    if (!windows.length) {
      const next = findNextAvailableForward({
        startDateObj: addDays(dateObj, 1),
        typeKey: type,
        preference,
        bookings,
        afterISO,
        count: Math.min(count, 3),
        strategy: "first",
        horizonDays: 60,
      });
      return res.status(403).json({
        error: "Closed day (no working windows on this date)",
        closedDay: true,
        policy: POLICY_SUMMARY,
        type,
        preference,
        dateYMD: ymd(dateObj),
        bookingUrl: SLOT_RULES.types[type].url,
        nextAvailable: next,
      });
    }

    // make suggestions for this date
    const { slots, hadWindows } = findSlotsForDay({
      dateObj,
      typeKey: type,
      preference,
      bookings,
      afterISO,
      count,
      strategy,
    });

    if (!slots.length) {
      const next = findNextAvailableForward({
        startDateObj: addDays(dateObj, 1),
        typeKey: type,
        preference,
        bookings,
        afterISO,
        count: Math.min(count, 3),
        strategy: "first",
        horizonDays: 60,
      });

      return res.status(404).json({
        error: hadWindows ? "Fully booked or no slots meet your filters" : "Closed day",
        fullyBooked: hadWindows,
        closedDay: !hadWindows,
        policy: POLICY_SUMMARY,
        type,
        preference,
        dateYMD: ymd(dateObj),
        bookingUrl: SLOT_RULES.types[type].url,
        nextAvailable: next,
      });
    }

    const primary = slots[0];
    return res.json({
      type,
      preference,
      dateYMD: ymd(dateObj),
      bookingUrl: SLOT_RULES.types[type].url,
      options: slots,
      start: primary.start,
      end: primary.end,
      human: primary.human,
      policy: POLICY_SUMMARY,
    });
  } catch (err) {
    console.error("❌ /api/tidycal/suggest error:", err);
    res.status(500).json({ error: "Failed to suggest a time" });
  }
});

/* ------------------------ Start Server ------------------------ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
