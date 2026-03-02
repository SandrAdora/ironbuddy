// React imports
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Component Imports
import HomePage from "./components/pages/HomePage";
import RegisterPage from "./components/pages/RegisterPage";
import Sidebar from "./components/Sidebar";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* definiert den link zu die entsprechende Pages*/}
        
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
      <Sidebar />


    </BrowserRouter>
  );
}

