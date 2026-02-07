import axios from "axios";

export default async function handler(req, res) {
  const { bookingTypeId } = req.query; // use bookingTypeId directly

  try {
    if (!bookingTypeId) {
      return res.status(400).json({ error: "Missing bookingTypeId" });
    }

    const apiKey = process.env.TIDYCAL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing TIDYCAL_API_KEY" });
    }

    // Format ISO datetime without milliseconds
    const formatIsoNoMs = (date) =>
      date.toISOString().replace(/\.\d{3}Z$/, "Z");

    const today = new Date();
    const startsAt = formatIsoNoMs(new Date(today.setHours(0, 0, 0, 0)));

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const endsAt = formatIsoNoMs(new Date(endDate.setHours(23, 59, 59, 0)));

    const url = `https://tidycal.com/api/booking-types/${bookingTypeId}/timeslots?starts_at=${encodeURIComponent(
      startsAt
    )}&ends_at=${encodeURIComponent(endsAt)}`;

    const tidyRes = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Transform raw response → { dates, slots }
    const dates = [];
    const slots = {};

    tidyRes.data.data.forEach((slot) => {
      const start = new Date(slot.starts_at);
      const dateStr = start.toISOString().split("T")[0]; // YYYY-MM-DD
      const timeStr = start.toISOString().substring(11, 16); // HH:mm

      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
        slots[dateStr] = [];
      }
      slots[dateStr].push(timeStr);
    });

    return res.status(200).json({ dates, slots });
  } catch (err) {
    console.error("❌ TidyCal availability error:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Failed to fetch availability",
      detail: err.response?.data || err.message,
    });
  }
}
