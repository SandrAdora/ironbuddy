import { useState } from 'react';
import { useUser } from '../../context/userContext.js';
import { Link, useNavigate } from "react-router-dom";
import React from "react";
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequestPasswordReset } from '../../api';

export default function Home() {
  const { login, logout, token } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate('/user');
  }, [token]);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/user');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSending(true);
    try {
      await apiRequestPasswordReset(forgotEmail);
      setForgotDone(true);
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotSending(false);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotEmail('');
    setForgotDone(false);
    setForgotError('');
  };

  return (
    <div className="mt-20 bg-[--color-gym-dark] text-white min-h-screen">
      <section className="grid gap-8 md:grid-cols-2 px-6 py-12">
        <div className="flex flex-col justify-center px-4">
          <span className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">
            AI COACH
          </span>
          <h1 className="text-4xl font-black italic uppercase leading-tight mt-2">
            <span className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]">Hello, I am </span>
            <span className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.9)] animate-coach-breathe">
              🦾 IRON
            </span>
          </h1>
          <span className="text-gray-400 text-3xl mt-4 block">
            Your Personal Fitness Trainer
          </span>
        </div>

        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-w-md mx-auto w-full
          text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
          <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">
            Sign In
          </h2>
          <form onSubmit={handleLogin} className="space-y-4 mt-6">
            <InputField label="Email" value={email} onChange={setEmail}
              type="email" required placeholder="email@example.com" />
            <InputField label="Password" value={password} onChange={setPassword}
              type="password" required placeholder="••••••••" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-4 font-black rounded-lg uppercase transition-all duration-300
                bg-yellow-300 text-black hover:bg-yellow-200 hover:shadow-[0_0_25px_rgba(253,224,71,0.7)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Forgot password link */}
          <div className="mt-3 text-center">
            <button
              onClick={() => setForgotOpen(true)}
              className="text-gray-500 hover:text-[--color-iron-gold] text-xs font-semibold transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <p className="text-gray-400 text-sm mt-4 text-center">
            {token ? (
              <button onClick={() => { logout(); }} className="text-[--color-iron-gold] hover:underline font-bold bg-transparent border-none cursor-pointer p-0">
                Sign Out
              </button>
            ) : (
              <>No Account yet?{" "}
                <Link to="/signup" className="text-[--color-iron-gold] hover:underline transition-colors duration-300 font-bold">
                  Sign Up Here
                </Link>
              </>
            )}
          </p>
        </div>
      </section>

      {/* ── Forgot Password Modal ──────────────────────────────── */}
      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={closeForgot}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-[#0f1117] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_40px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              {forgotDone ? (
                <div className="text-center space-y-4">
                  <span className="text-5xl">📧</span>
                  <p className="text-[--color-iron-gold] font-black uppercase text-lg tracking-wide">Check your inbox</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    If <span className="text-white font-semibold">{forgotEmail}</span> is registered, you'll receive a password reset link shortly.
                  </p>
                  <button
                    onClick={closeForgot}
                    className="w-full py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
                      hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest mb-1">🔑 Reset Password</p>
                  <p className="text-gray-400 text-xs mb-6">Enter your account email and we'll send you a reset link.</p>
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <InputField
                      label="Email"
                      value={forgotEmail}
                      onChange={setForgotEmail}
                      type="email"
                      required
                      placeholder="email@example.com"
                    />
                    {forgotError && <p className="text-red-400 text-xs">{forgotError}</p>}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeForgot}
                        className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs hover:text-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={forgotSending}
                        className="flex-1 py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs
                          hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                      >
                        {forgotSending ? 'Sending…' : 'Send Link'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

function InputField({ label, value, onChange, type = "text", placeholder, required }: InputFieldProps) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white
          focus:border-yellow-300/60 outline-none transition-all backdrop-blur-sm"
      />
    </div>
  );
}
