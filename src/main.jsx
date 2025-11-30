import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';  // ✅ correct file to load ChatToggle or FullChat

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
