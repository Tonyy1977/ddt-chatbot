// src/BookingWidget.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { DateTime } from "luxon";

export default function BookingWidget({ bookingTypeId, bookingTypeName, addMessage }) {
  const [slots, setSlots] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("select"); // select | confirm | details | done

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // track which month is shown
  const [currentMonth, setCurrentMonth] = useState(
    DateTime.now().setZone("America/New_York").startOf("month")
  );

  // fetch availability
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const res = await axios.get("/api/tidycal/availability", {
          params: { bookingTypeId },
        });
        setSlots(res.data.slots || {});
      } catch (err) {
        console.error("Error fetching availability:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAvailability();
  }, [bookingTypeId]);

  if (loading) return <p>Loading calendar...</p>;

  // build calendar grid
  const startOfMonth = currentMonth.startOf("month");
  const endOfMonth = currentMonth.endOf("month");
  const days = [];
  const firstDayOfWeek = startOfMonth.weekday % 7;
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= endOfMonth.day; d++) {
    const nyDate = DateTime.fromObject(
      { year: currentMonth.year, month: currentMonth.month, day: d },
      { zone: "America/New_York" }
    );
    days.push(nyDate.toFormat("yyyy-MM-dd"));
  }

  // navigation
  const prevMonth = () => setCurrentMonth(currentMonth.minus({ months: 1 }));
  const nextMonth = () => setCurrentMonth(currentMonth.plus({ months: 1 }));

  return (
    <div className="booking-widget">
      {/* Calendar Header */}
      <div className="calendar-header">
        <span className="month-label">{currentMonth.toFormat("LLLL yyyy")}</span>
        <div className="nav-buttons">
          <button onClick={prevMonth}>‹</button>
          <button onClick={nextMonth}>›</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="calendar-day-name">{d}</div>
        ))}

        {days.map((dateStr, i) => {
          if (!dateStr) return <div key={i} className="calendar-day empty"></div>;
          const isAvailable = slots[dateStr]?.length > 0;
          const isSelected = selectedDate === dateStr;
          return (
            <button
              key={dateStr}
              className={`calendar-day ${isAvailable ? "available" : "disabled"} ${isSelected ? "selected" : ""}`}
              onClick={() => {
                if (isAvailable) {
                  setSelectedDate(dateStr);
                  setSelectedTime(null);
                  setStep("select");
                }
              }}
            >
              {DateTime.fromISO(dateStr).day}
            </button>
          );
        })}
      </div>

      {/* Show time slots */}
      {selectedDate && step === "select" && (
        <div className="time-slots">
          <p>
            Available times for <strong>{bookingTypeName}</strong> on{" "}
            {DateTime.fromISO(selectedDate).toFormat("MMM d, yyyy")}:
          </p>
          {slots[selectedDate]?.map((slot) => {
            const nyTime = DateTime.fromISO(`${selectedDate}T${slot}`, { zone: "utc" })
              .setZone("America/New_York")
              .toFormat("h:mm a");
            return (
              <button
                key={slot}
                className={`time-slot ${selectedTime === slot ? "selected" : ""}`}
                onClick={() => {
                  setSelectedTime(slot);
                  setStep("confirm");
                }}
              >
                {nyTime}
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm step */}
      {step === "confirm" && selectedDate && selectedTime && (
        <div className="confirm-step">
          <p>
            You selected <strong>{bookingTypeName}</strong> on{" "}
            {DateTime.fromISO(selectedDate).toFormat("MMM d, yyyy")} at{" "}
            {DateTime.fromISO(`${selectedDate}T${selectedTime}`, { zone: "utc" })
              .setZone("America/New_York")
              .toFormat("h:mm a")} (New York time).
          </p>
          <button onClick={() => setStep("details")}>Confirm</button>
          <button onClick={() => setStep("select")}>Back</button>
        </div>
      )}

      {/* Name/email form */}
      {step === "details" && (
        <div className="details-form">
          <p>Please enter your details to complete the booking:</p>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            onClick={async () => {
              try {
                await axios.post("/api/tidycal/book", {
                  bookingTypeId,
                  date: selectedDate,
                  time: selectedTime,
                  name,
                  email,
                });

                // ✅ Send success as a chat bubble
                if (addMessage) {
                  const formattedDate = DateTime.fromISO(selectedDate).toFormat("MMM d, yyyy");
                  const formattedTime = DateTime.fromISO(`${selectedDate}T${selectedTime}`, { zone: "utc" })
                    .setZone("America/New_York")
                    .toFormat("h:mm a");

                  addMessage({
                    sender: "bot",
                    type: "text",
                    text: `Your ${bookingTypeName} has been scheduled for ${formattedDate} at ${formattedTime} (New York time). A confirmation email has been sent.`,
                  });
                }

                setStep("done");
              } catch (err) {
                console.error("Booking failed:", err);
                if (addMessage) {
                  addMessage({
                    sender: "bot",
                    type: "text",
                    text: "⚠️ Sorry, something went wrong while booking. Please try again.",
                  });
                }
              }
            }}
          >
            Confirm Booking
          </button>
        </div>
      )}

      {/* Inline success (optional, can remove if bubble is enough) */}
      {step === "done" && (
        <p>Booking complete.</p>
      )}
    </div>
  );
}
