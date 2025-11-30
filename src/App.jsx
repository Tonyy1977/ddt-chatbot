import React from 'react';
import ChatToggle from './ChatToggle';
import FullChat from './FullChat';
import AdminDashboard from './AdminDashboard'; // ✅ Add this

function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  if (mode === "toggle") return <ChatToggle />;
  if (mode === "chat") return <FullChat />;
  if (mode === "admin") return <AdminDashboard />; // ✅ Route to admin view

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Micah Widget Preview</h2>
      <p>
        Add <code>?mode=toggle</code>, <code>?mode=chat</code>, or <code>?mode=admin</code> in the URL.
      </p>
    </div>
  );
}

export default App;
