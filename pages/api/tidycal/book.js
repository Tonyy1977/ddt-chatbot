import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bookingTypeId, date, time, name, email, timezone } = req.body;

    if (!bookingTypeId || !date || !time || !name || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Combine date + time into ISO UTC
    const starts_at = new Date(`${date}T${time}:00Z`).toISOString();

    // ✅ Create booking directly
    const response = await axios.post(
      `https://tidycal.com/api/booking-types/${bookingTypeId}/bookings`,
      {
        starts_at,
        name,
        email,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TIDYCAL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(201).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;

    if (status === 409) {
      return res.status(409).json({
        error: "Timeslot unavailable",
        details:
          error.response?.data ||
          "The requested time is already booked. Please select another.",
      });
    }

    return res.status(status).json({
      error: "Booking failed",
      details: error.response?.data || error.message,
    });
  }
}
