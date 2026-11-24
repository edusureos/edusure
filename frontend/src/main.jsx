const API_ORIGIN = import.meta.env.PROD ? 'https://edusure-backend.onrender.com' : '';
if (API_ORIGIN) {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = `${API_ORIGIN}${input}`;
    }
    return origFetch(input, init);
  };
}
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
