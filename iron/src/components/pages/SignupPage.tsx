// src/pages/RegisterPage.tsx
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import OnboardingForm from "../Register";
import type {JSX} from "react";
import Modal from "../Modal";
import { useTheme } from "../../context/themeContext";

export default function Signup(): JSX.Element {
  const [showModal, setShowModal] = useState<boolean>(true);
  const { theme } = useTheme();

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
    <div
      className="min-h-screen pt-28"
      style={{ background: theme === 'light' ? '#f0f0f3' : 'var(--color-gym-dark)', color: theme === 'light' ? '#111' : '#fff' }}
    >
      <AnimatePresence>
        {showModal && <Modal onClose={handleAccept} />}
      </AnimatePresence>
      <div className="flex justify-center mt-8 px-6 pb-16">
        <OnboardingForm />
      </div>
    </div>
  );
}