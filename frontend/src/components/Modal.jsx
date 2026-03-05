import { useState } from "react";
import { AnimatePresence , motion } from "framer-motion";
import Signup from "./pages/SignupPage";
import Home from "./pages/HomePage"


// components/Modal.jsx

export default function Modal({ onClose }) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-gray-900 p-8 rounded-xl max-w-xl text-white shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <h2 className="text-3xl font-black text-[--color-iron-gold] italic uppercase">
          Welcome to IronBuddy
        </h2>

        <p className="text-gray-300 mt-4 leading-relaxed">
          Before you begin, please read our health disclaimer.
        </p>

        <p className="text-gray-400 mt-4 text-sm leading-relaxed">
          By using IronBuddy, you confirm that you are in suitable physical
          condition to follow fitness recommendations. IronBuddy provides
          general guidance and does not replace professional medical advice.
          Stop immediately if you feel discomfort and consult a healthcare
          professional.
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg hover:bg-[--color-iron-gold-hover]"
        >
          I Agree
        </button>
      </motion.div>
    </motion.div>
  );
}

