//app.jsx
// React imports
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./App.css"
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Component Imports
import Home from "./components/pages/HomePage";
import About from './components/pages/AboutPage';
import Contact from './components/pages/ContactPage';
import Signup from './components/pages/SignupPage';


function AnimatedRoutes(){
  const location = useLocation(); // get information about current url

  // animate transitions
  return (
    <AnimatePresence mode="wait"> 
    <Navbar />
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
      </Routes>
    </AnimatePresence>
  )
}
function PageWrapper({ children }){
  // animation
  return (
    <motion.div 
      initial={{ opacity: 0, y:20 }} // starting state for the anmiation 
      animate={{ opacity: 1, y: 0 }} // 
      exit={{ opacity: 0, y: -20}}
      transition={{ duration: 0.5 }}

    >
      {children}
    </motion.div>
  );

}

export default function App() {
  return (
    
    <BrowserRouter>
    <Navbar />
      
        <AnimatedRoutes />
        <Footer />
      
    </BrowserRouter>
  );
}

