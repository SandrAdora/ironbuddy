// src/pages/RegisterPage.jsx
import OnboardingForm from "../Register";
import { AnimatePresence } from "framer-motion";
import Modal from "../Modal";
import { useState, useEffect } from "react";

export default function Signup() {

  const [showModal, setShowModal] = useState(true);

  // process of storing agreement in localstorage 
  useEffect(() =>{
    const accepted = localStorage.getItem("ironbuddy_disclaimer");
    if (!accepted){
      setShowModal(true);
    }
  }, []);

  function handleAccept(){
    localStorage.setItem("ironbuddy_disclaimer", "accepted");
    setShowModal(false);
  }
  return (
  <div className="min-h-screen bg-[--color-gym-dark] text-white pt-28"> 
  < AnimatePresence>
    {showModal && <Modal onClose={handleAccept} />} 
  </AnimatePresence>
  <div className="flex justify-center mt-8 px-6">
          <OnboardingForm />
          </div>
    </div>
  
  );
}
