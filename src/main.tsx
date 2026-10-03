import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initDisplayScale } from './hooks/useDisplayScale';

// Inisialisasi skala desktop proporsional sebelum render pertama
initDisplayScale();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

