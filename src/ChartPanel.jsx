import React, { useMemo, useRef } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1"];

function ChartPanel({ messages }) {
  const chartRef = useRef();

  const downloadPDF = async () => {
    const canvas = await html2canvas(chartRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save(`Micah_Chat_Analytics_${Date.now()}.pdf`);
  };

  // 🧠 GPT Topic Stats
  const topicStats = useMemo(() => {
    const countMap = {};
    messages.forEach((msg) => {
      const topic = msg.topics?.[0] || msg.topic;
      if (topic) {
        countMap[topic] = (countMap[topic] || 0) + 1;
      }
    });
    return Object.entries(countMap).map(([name, value]) => ({ name, value }));
  }, [messages]);

  // ⏱️ Messages Per Day
  const dailyStats = useMemo(() => {
    const countByDay = {};
    messages.forEach((msg) => {
      if (!msg.createdAt) return;
      const d = new Date(msg.createdAt);
      if (isNaN(d)) return;
      const date = d.toISOString().split("T")[0];
      countByDay[date] = (countByDay[date] || 0) + 1;
    });
    return Object.entries(countByDay).map(([date, count]) => ({
      date,
      count,
    }));
  }, [messages]);

  // 🥧 User vs Bot Pie
  const pieStats = useMemo(() => {
    const userCount = messages.filter((m) => m.sender === "user").length;
    const botCount = messages.filter((m) => m.sender === "bot").length;
    return [
      { name: "User", value: userCount },
      { name: "Bot", value: botCount },
    ];
  }, [messages]);

  // 📉 Top Sessions
  const sessionCounts = useMemo(() => {
    const sessionMap = {};
    messages.forEach((msg) => {
      sessionMap[msg.sessionId] = (sessionMap[msg.sessionId] || 0) + 1;
    });
    return Object.entries(sessionMap)
      .map(([sessionId, count]) => ({ sessionId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [messages]);

  // 📦 Cumulative Growth
  const cumulativeStats = useMemo(() => {
    const sorted = [...messages]
      .filter((m) => m.createdAt && !isNaN(new Date(m.createdAt)))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const result = [];
    let total = 0;

    sorted.forEach((msg) => {
      const d = new Date(msg.createdAt);
      if (isNaN(d)) return;
      const date = d.toISOString().split("T")[0];
      total++;
      result.push({ date, total });
    });

    // collapse duplicates by date
    return Object.values(
      result.reduce((acc, cur) => {
        acc[cur.date] = cur;
        return acc;
      }, {})
    );
  }, [messages]);

  return (
    <div>
      <div style={{ textAlign: "right", marginBottom: "10px" }}>
        <button onClick={downloadPDF}>Download PDF</button>
      </div>

      <div ref={chartRef}>
        <h2 style={{ marginTop: "20px" }}>📊 Chat Analytics Dashboard</h2>

        {/* 📈 Line Chart */}
        <div style={{ marginTop: "40px" }}>
          <h3>📈 Messages Per Day</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyStats}>
              <CartesianGrid stroke="#ccc" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 🥧 User vs Bot */}
        <div style={{ marginTop: "40px" }}>
          <h3>🥧 User vs Bot Messages</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieStats}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {pieStats.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 📉 Top Sessions */}
        <div style={{ marginTop: "40px" }}>
          <h3>📉 Top 5 Active Sessions</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sessionCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sessionId" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 📦 Cumulative Growth */}
        <div style={{ marginTop: "40px" }}>
          <h3>📦 Cumulative Message Growth</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cumulativeStats}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" />
              <YAxis />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorTotal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default ChartPanel;
