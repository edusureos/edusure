import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminDashboard from './AdminDashboard';
import '../../index.css';
import './admin.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminDashboard previewMode />
  </StrictMode>,
);
