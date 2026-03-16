//app.jsx
// React imports
import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Component Imports
import Home from "./components/pages/HomePage";
import About from './components/pages/AboutPage';
import Contact from './components/pages/ContactPage';
import Signup from './components/pages/SignupPage';
import UserProfile from './components/UserProfile';
import ResetPasswordPage from './components/pages/ResetPasswordPage';


function AnimatedRoutes(){
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        <Route path="/" element={
          <PageWrapper><Home /></PageWrapper>} />
        <Route path="/about" element={<PageWrapper><About /></PageWrapper>} />
        <Route path="/contact" element={
          <PageWrapper>
          <Contact />
          </PageWrapper>
          } />
        <Route path="/signup" element={
          <PageWrapper>
            <Signup />
          </PageWrapper>} />
        <Route path="/user" element={
          <PageWrapper>
            <UserProfile />
          </PageWrapper>} />
        <Route path="/reset-password" element={
          <PageWrapper>
            <ResetPasswordPage />
          </PageWrapper>} />
      </Routes>
    </AnimatePresence>
  )
}
function PageWrapper({ children }: { children: React.ReactNode }){
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      style={{ position: 'relative' }}
    >
      {children}
    </motion.div>
  );
}

function AppInner() {
  const location = useLocation();
  const isDashboard = location.pathname === '/user';
  return (
    <>
      <Navbar />
      <AnimatedRoutes />
      {!isDashboard && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
