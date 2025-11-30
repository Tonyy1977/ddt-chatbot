import axios from "axios";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.TIDYCAL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing TIDYCAL_API_KEY" });
    }

    const tidyRes = await axios.get("https://tidycal.com/api/booking-types", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Unwrap and filter inactive ones
    const bookingTypes = (tidyRes.data?.data || [])
      .filter(bt => !bt.disabled_at) // only active
      .map(bt => ({
        id: bt.id,
        title: bt.title,
        description: bt.description,
        url: bt.url,
      }));

    return res.status(200).json(bookingTypes);
  } catch (err) {
    console.error("❌ TidyCal booking types error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to fetch booking types" });
  }
}
