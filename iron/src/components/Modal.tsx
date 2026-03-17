// components/Modal.tsx
import { motion } from "framer-motion";
import type { JSX } from "react";
import React from "react";

interface ModalProps {
  onClose: () => void;
}

export default function Modal({ onClose }: ModalProps): JSX.Element {
  return (
    <motion.div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 px-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="card-gold max-w-xl w-full max-h-[90vh]"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="bg-[#0d0d10] p-7 md:p-8 rounded-[calc(1.25rem-1px)] overflow-y-auto max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 mt-0.5"
              style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)' }}>
              🛡️
            </div>
            <div>
              <p className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.3em] uppercase mb-0.5">
                Before You Begin
              </p>
              <h2 className="text-xl md:text-2xl font-black text-white italic uppercase leading-tight">
                Health & Liability Disclaimer
              </h2>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px mb-5" style={{ background: 'linear-gradient(90deg, rgba(250,204,21,0.3), transparent)' }} />

          {/* Body */}
          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              IronBuddy provides AI-generated fitness and nutrition suggestions for{" "}
              <span className="text-white font-semibold">informational purposes only</span>. The content
              produced by IRON does not constitute medical advice and is{" "}
              <span className="text-white font-semibold">not a substitute for professional guidance</span>{" "}
              from a qualified practitioner.
            </p>

            <p className="text-gray-500 font-semibold text-xs uppercase tracking-wider">By clicking "I Agree" you confirm:</p>

            <ul className="space-y-2.5">
              {[
                "You are 18+ years of age, or have obtained parental/guardian consent.",
                "You have consulted a physician before beginning any exercise or diet program, or accept full responsibility.",
                "You understand physical exercise carries inherent risk of injury and voluntarily assume all such risks.",
                "You understand recommendations are AI-generated and may not account for your full medical history.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5 font-black"
                    style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.25)', color: '#facc15' }}>
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-gray-600 pt-3 leading-relaxed"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              The developer of IronBuddy accepts{" "}
              <span className="text-gray-400">no liability</span>{" "}
              for any injury, illness, loss, or damage arising directly or indirectly from use of this application or its AI-generated content.
            </p>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full py-3.5 bg-yellow-300 text-black font-black rounded-xl uppercase tracking-wider text-sm
              hover:brightness-110 hover:shadow-[0_0_28px_rgba(250,204,21,0.45)] hover:scale-[1.02]
              active:scale-95 transition-all duration-200"
          >
            I Agree — Let's Go 🚀
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
