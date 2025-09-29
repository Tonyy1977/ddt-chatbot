import React, { useEffect, useState } from 'react';

const ChatToggle = () => {
  const [showPopup, setShowPopup] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowPopup(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    window.parent.postMessage('toggle-chat', '*');
  };

  return (
    <div
  style={{
    position: 'fixed',
    width: '100%',
    height: '100%',
    background: 'transparent',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: '10px',
    boxSizing: 'border-box',
    overflow: 'visible',
  }}
>
      {showPopup && (
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '0',
            background: '#fff',
            padding: '10px 14px',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '14px',
            maxWidth: '220px',
            color: '#333',
          }}
        >
          Hi, I'm Micah, DDT's virtual assistant. How can I help you today?
        </div>
      )}

      <button
  onClick={handleClick}
  style={{
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundImage: 'url(/micah-toggle.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  }}
  aria-label="Open chat"
/>
    </div>
  );
};

export default ChatToggle;