import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ChartPanel from './ChartPanel';

function AdminDashboard() {
  const [messages, setMessages] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [sender, setSender] = useState('All');
  const [sessionId, setSessionId] = useState('All');
  const [uniqueSessions, setUniqueSessions] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState('history');

  const [authenticated, setAuthenticated] = useState(false);
const [loginInput, setLoginInput] = useState({ email: '', password: '' });

useEffect(() => {
  const stored = localStorage.getItem('micah-admin-auth');
  if (stored === 'true') setAuthenticated(true);
}, []);

const handleLogin = async () => {
  try {
    const res = await axios.post('/api/admin/login', loginInput);
    if (res.data.success) {
      localStorage.setItem('micah-admin-auth', 'true');
      setAuthenticated(true);
    } else {
      alert('❌ Invalid credentials');
    }
  } catch {
    alert('❌ Login failed');
  }
};
  // ✅ Define fetchMessages
  const fetchMessages = async () => {
    try {
      const res = await axios.get('/api/messages');
console.log("📦 Full response:", res.data);
const messages = Array.isArray(res.data) ? res.data : [];
setMessages(messages);
setFiltered(messages);
      const sessions = [...new Set(messages.map(msg => msg.sessionId))];
      setUniqueSessions(sessions);
    } catch (err) {
      console.error('❌ Failed to load messages:', err);
    }
  };

  // ✅ Define fetchAnalytics
  const fetchAnalytics = async () => {
  try {
    const res = await axios.get('/api/analytics/summary');
    setAnalytics(res.data);
  } catch (err) {
    console.error('❌ Failed to load analytics summary:', err);
  }
};

  // ✅ Fetch both messages and analytics in one useEffect
  useEffect(() => {
    fetchAnalytics();
    fetchMessages();
  }, []);

  useEffect(() => {
    let filteredData = [...messages];

    if (sender !== 'All') {
      filteredData = filteredData.filter(msg => msg.sender.toLowerCase() === sender.toLowerCase());
    }

    if (sessionId !== 'All') {
      filteredData = filteredData.filter(msg => msg.sessionId === sessionId);
    }

    if (search.trim()) {
      filteredData = filteredData.filter(msg =>
        msg.text.toLowerCase().includes(search.toLowerCase()) ||
        msg.sessionId.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredData = filteredData.filter(msg => {
        const msgDate = msg.createdAt ? new Date(msg.createdAt) : null;
        return msgDate >= start && msgDate <= end;
      });
    }

    setFiltered(filteredData);
  }, [sender, sessionId, search, startDate, endDate, messages]);

  const exportCSV = () => {
  const rows = [['Session ID', 'Sender', 'Text', 'Timestamp', 'Topic']];

  messages.forEach(msg => {
    rows.push([
  msg.sessionId || '',
  msg.sender || '',
  `"${msg.text?.toString().replace(/"/g, '""') || ''}"`,
  msgDate ? msgDate.toISOString() : '',
  msg.topic || ''
]);
  });

  const csvContent = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Micah_Chat_History_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
if (!authenticated) {
  return (
    <div style={{ padding: '20px' }}>
      <h2>🔐 Admin Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={loginInput.email}
        onChange={(e) => setLoginInput({ ...loginInput, email: e.target.value })}
        style={{ marginBottom: '10px', display: 'block' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={loginInput.password}
        onChange={(e) => setLoginInput({ ...loginInput, password: e.target.value })}
        style={{ marginBottom: '10px', display: 'block' }}
      />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

  return (
    <div style={{ padding: '20px' }}>
      <h1>Micah Admin Dashboard</h1>

<div style={{ marginBottom: '20px' }}>
  <button onClick={() => setTab('history')} style={{ marginRight: '10px' }}>
    Chat History
  </button>
  <button onClick={() => setTab('graph')}>Graph</button>
</div>
{tab === 'history' && (
  <button onClick={exportCSV} style={{ marginLeft: '10px' }}>Export CSV</button>
)}
<button
  onClick={() => {
    localStorage.removeItem('micah-admin-auth');
    window.location.href = '/?mode=admin';
  }}
  style={{
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    cursor: 'pointer'
  }}
>
  Logout
</button>


      {/* ✅ Quick Analytics Panel */}
      <div style={{ marginBottom: '20px', background: '#f3f3f3', padding: '15px', borderRadius: '10px' }}>
  <h3>📈 Quick Analytics</h3>
  <p><strong>Total Messages:</strong> {filtered.length}</p>
  <p><strong>Unique Sessions:</strong> {[...new Set(filtered.map(msg => msg.sessionId))].length}</p>
  <p><strong>User Messages:</strong> {filtered.filter(msg => msg.sender === 'user').length}</p>
  <p><strong>Bot Messages:</strong> {filtered.filter(msg => msg.sender === 'bot').length}</p>
  <p><strong>Summary:</strong> {analytics ? JSON.stringify(analytics) : 'loading...'}</p>
</div>

{/* ✅ Chart Display */}
{tab === 'graph' && <ChartPanel messages={filtered} />}
{tab === 'history' && (
  <>
    {/* ✅ Filter Panel */}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
      <div>
        <label><strong>Sender:</strong></label><br />
        <select value={sender} onChange={e => setSender(e.target.value)}>
          <option>All</option>
          <option>User</option>
          <option>Bot</option>
        </select>
      </div>

      <div>
        <label><strong>Session ID:</strong></label><br />
        <select value={sessionId} onChange={e => setSessionId(e.target.value)}>
          <option>All</option>
          {uniqueSessions.map((sid, i) => (
            <option key={i} value={sid}>{sid}</option>
          ))}
        </select>
      </div>

      <div>
        <label><strong>Search:</strong></label><br />
        <input
          type="text"
          placeholder="Enter keyword..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div>
        <label><strong>Start Date:</strong></label><br />
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </div>

      <div>
        <label><strong>End Date:</strong></label><br />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>
    </div>

    {/* ✅ Table Display */}
    {filtered.length === 0 ? (
      <p>No messages found.</p>
    ) : (
      <table border="1" cellPadding="10" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Session</th>
            <th>Sender</th>
            <th>Message</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((msg, i) => (
            <tr key={i}>
              <td>{msg.sessionId}</td>
              <td style={{ fontWeight: 'bold' }}>{msg.sender === 'bot' ? 'Bot' : 'User'}</td>
              <td style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</td>
              <td>{new Date(msg.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </>
)}
    </div>
  );
}

export default AdminDashboard;
