import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminDashboard from './AdminDashboard';
import ChristmasAtmosphere from '../../Edusure/ChristmasAtmosphere';
import '../../index.css';
import './admin.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChristmasAtmosphere>
      <AdminDashboard previewMode />
    </ChristmasAtmosphere>
  </StrictMode>,
);
