// src/pages/RegisterPage.tsx
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import OnboardingForm from "../Register";
import type {JSX} from "react";
import Modal from "../Modal";

export default function Signup(): JSX.Element {
  const [showModal, setShowModal] = useState<boolean>(true);

  // Process of storing agreement in localStorage
  useEffect(() => {
    const accepted = localStorage.getItem("ironbuddy_disclaimer");
    if (!accepted) {
      setShowModal(true);
    }
  }, []);

  function handleAccept(): void {
    const timestamp = new Date().toISOString();
    localStorage.setItem("ironbuddy_disclaimer_accepted_at", timestamp);
    localStorage.setItem("ironbuddy_disclaimer", "accepted");
    setShowModal(false);
  }

  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white pt-28">
      <AnimatePresence>
        {showModal && <Modal onClose={handleAccept} />}
      </AnimatePresence>
      <div className="flex justify-center mt-8 px-6 pb-16">
        <OnboardingForm />
      </div>
    </div>
  );
}