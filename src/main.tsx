
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (typeof window !== 'undefined' && !window.process) {
  (window as any).process = { env: {} };
}

async function init() {
  // Fetch server-side config for runtime environment variables (Cloud Run)
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      // Prioritize API_KEY (user-selected) over GEMINI_API_KEY (environment)
      (window as any).SERVER_GEMINI_API_KEY = config.API_KEY || config.GEMINI_API_KEY;
    }
  } catch (e) {
    console.warn('Could not fetch server config. Falling back to build-time env.');
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

init();
