import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import { UserProvider } from './context/userContext.js'; 
import React from "react"

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <UserProvider>
        <App />
      </UserProvider>
    </StrictMode>,
  );
}