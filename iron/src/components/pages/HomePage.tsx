import { useState, useEffect } from 'react';
import { useUser } from '../../context/userContext.js';
import { Link, useNavigate } from "react-router-dom";
import React from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequestPasswordReset } from '../../api';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const { login, logout, token } = useUser();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => { if (token) navigate('/user'); }, [token]);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const [forgotOpen, setForgotOpen]       = useState(false);
  const [forgotEmail, setForgotEmail]     = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotDone, setForgotDone]       = useState(false);
  const [forgotError, setForgotError]     = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/user');
    } catch {
      setError(t('home.signin.error'));
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
      setForgotError(t('home.forgot.error'));
    } finally {
      setForgotSending(false);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false); setForgotEmail(''); setForgotDone(false); setForgotError('');
  };

  const FEATURES = [
    { icon: '🤖', text: t('home.features.ai_coach') },
    { icon: '🥗', text: t('home.features.nutrition') },
    { icon: '📈', text: t('home.features.analytics') },
    { icon: '👥', text: t('home.features.community') },
  ];

  const STATS = [
    { value: '10K+', label: t('home.stats.athletes') },
    { value: '500+', label: t('home.stats.plans') },
    { value: '4.9★', label: t('home.stats.rating') },
  ];

  const FEATURE_CARDS = [
    { icon: '🦾', title: t('home.features_section.ai_coach_title'),  desc: t('home.features_section.ai_coach_desc') },
    { icon: '🥗', title: t('home.features_section.meals_title'),      desc: t('home.features_section.meals_desc') },
    { icon: '💪', title: t('home.features_section.workouts_title'),   desc: t('home.features_section.workouts_desc') },
    { icon: '📏', title: t('home.features_section.tracker_title'),    desc: t('home.features_section.tracker_desc') },
    { icon: '💬', title: t('home.features_section.community_title'),  desc: t('home.features_section.community_desc') },
    { icon: '🌍', title: t('home.features_section.languages_title'),  desc: t('home.features_section.languages_desc') },
  ];

  const HOW_STEPS = [
    { step: '01', icon: '📋', title: t('home.how_it_works.step1_title'), desc: t('home.how_it_works.step1_desc') },
    { step: '02', icon: '🤖', title: t('home.how_it_works.step2_title'), desc: t('home.how_it_works.step2_desc') },
    { step: '03', icon: '📈', title: t('home.how_it_works.step3_title'), desc: t('home.how_it_works.step3_desc') },
  ];

  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white">

      {/* ── Hero ────────────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex items-center pt-16 overflow-hidden">

        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.07) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-14 items-center">

          {/* Left — hero copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="flex flex-col gap-7"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-3 self-start">
              <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.7))' }} />
              <span className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.35em] uppercase opacity-80">
                {t('home.badge')}
              </span>
              <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, rgba(250,204,21,0.7), transparent)' }} />
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-6xl md:text-7xl font-black uppercase leading-[0.85] tracking-tight mb-1">
                <span className="text-white">{t('home.headline1')}</span>{' '}
                <span style={{
                  background: 'linear-gradient(135deg, #facc15 0%, #fb923c 60%, #facc15 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>{t('home.headline2')}</span>
              </h1>
              <h1 className="text-6xl md:text-7xl font-black uppercase leading-[0.85] tracking-tight">
                <span className="text-white">{t('home.headline3')} </span>
                <span className="text-white animate-coach-breathe inline-block">🦾 {t('home.headline4')}</span>
              </h1>
            </div>

            <p className="text-gray-400 text-base leading-relaxed max-w-[420px]">
              {t('home.tagline')}
            </p>

            {/* Features list */}
            <ul className="space-y-2">
              {FEATURES.map(({ icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 text-sm"
                    style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)' }}>
                    {icon}
                  </span>
                  <span className="text-sm text-gray-300 font-medium">{text}</span>
                </li>
              ))}
            </ul>

            {/* Stats row */}
            <div className="flex items-center gap-7 pt-1">
              {STATS.map(({ value, label }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <div className="w-px h-9 bg-white/10" />}
                  <div>
                    <div className="text-xl font-black text-[--color-iron-gold] leading-tight">{value}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">{label}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </motion.div>

          {/* Right — sign-in card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="card-gold max-w-md mx-auto w-full"
          >
            <div className="bg-[#0d0d10] p-8 rounded-[calc(1.25rem-1px)]">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[--color-iron-gold]" style={{ boxShadow: '0 0 8px rgba(250,204,21,0.8)' }} />
                <span className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.3em] uppercase">{t('home.signin.portal')}</span>
              </div>
              <h2 className="text-2xl font-black text-white italic uppercase mb-6 mt-1">{t('home.signin.title')}</h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <InputField label={t('profile.email')} value={email} onChange={setEmail} type="email" required placeholder="email@example.com" />
                <InputField label={t('password.current')} value={password} onChange={setPassword} type="password" required placeholder="••••••••" />
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <span className="text-red-400 text-xs shrink-0">⚠</span>
                    <p className="text-red-400 text-xs">{error}</p>
                  </div>
                )}
                <button
                  type="submit" disabled={loading}
                  className="w-full py-3.5 font-black rounded-xl uppercase tracking-wider text-sm transition-all duration-200
                    bg-yellow-300 text-black
                    hover:brightness-110 hover:shadow-[0_0_28px_rgba(250,204,21,0.5)] hover:scale-[1.02]
                    active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('home.signin.submitting') : t('home.signin.submit')}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => setForgotOpen(true)}
                  className="text-gray-600 hover:text-gray-400 text-xs font-semibold transition-colors bg-transparent border-none p-0 cursor-pointer">
                  {t('home.signin.forgot')}
                </button>
                {token ? (
                  <button onClick={() => logout()}
                    className="text-[--color-iron-gold] text-xs font-bold hover:underline bg-transparent border-none cursor-pointer p-0">
                    {t('nav.sign_out')}
                  </button>
                ) : (
                  <Link to="/signup" className="text-xs text-gray-500 hover:text-gray-300 font-medium transition-colors">
                    {t('home.signin.no_account')}{' '}
                    <span className="text-[--color-iron-gold] font-bold">{t('nav.sign_up')}</span>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative py-24 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.35em] uppercase opacity-70 mb-2">{t('home.how_it_works.label')}</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic">{t('home.how_it_works.title')}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_STEPS.map(({ step, icon, title, desc }) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="relative p-6 rounded-2xl border"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="absolute -top-4 left-6 text-[10px] font-black tracking-widest text-[--color-iron-gold] bg-[#0a0a0d] px-2">{step}</div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: 'rgba(200, 138, 13, 0.08)', border: '1px solid rgba(250,204,21,0.15)' }}>
                  {icon}
                </div>
                <h3 className="text-lg font-black uppercase italic mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Grid ────────────────────────────────────────────────────── */}
      <section id="features" className="relative py-24 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.35em] uppercase opacity-70 mb-2">{t('home.features_section.label')}</p>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic">{t('home.features_section.title')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURE_CARDS.map(({ icon, title, desc }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="p-5 rounded-2xl border hover:border-yellow-300/20 transition-all duration-300 group"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
                  style={{ background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.12)' }}>
                  {icon}
                </div>
                <h3 className="text-sm font-black uppercase italic mb-1.5 group-hover:text-[--color-iron-gold] transition-colors">{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section id="cta" className="relative py-24 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 mx-auto w-[700px] h-[400px] top-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto px-6 text-center space-y-6">
          <span className="text-5xl">🏆</span>
          <h2 className="text-4xl md:text-5xl font-black uppercase italic leading-tight">
            {t('home.cta.title1')}<br />
            <span style={{ background: 'linear-gradient(135deg,#facc15,#fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {t('home.cta.title2')}
            </span>
          </h2>
          <p className="text-gray-400 leading-relaxed">
            {t('home.cta.desc')}
          </p>
          <Link
            to="/signup"
            className="inline-block px-10 py-4 font-black rounded-2xl uppercase tracking-wider text-sm transition-all duration-200
               text-black hover:brightness-110 hover:shadow-[0_0_36px_rgba(250,204,21,0.5)] hover:scale-[1.03] active:scale-95"
          >
            {t('home.cta.btn')}
          </Link>
        </div>
      </section>

      {/* ── Forgot Password Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={closeForgot}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="card-gold max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#0d0d10] p-8 rounded-[calc(1.25rem-1px)]">
                {forgotDone ? (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl"
                      style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)' }}>
                      📧
                    </div>
                    <p className="text-white font-black uppercase tracking-wide">{t('home.forgot.check_inbox')}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {t('home.forgot.sent_desc', { email: forgotEmail })}
                    </p>
                    <button onClick={closeForgot}
                      className="w-full py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all">
                      {t('home.forgot.done')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔑</span>
                      <span className="text-[--color-iron-gold] font-black uppercase text-xs tracking-[0.2em]">{t('home.forgot.title')}</span>
                    </div>
                    <p className="text-gray-500 text-xs mb-6">{t('home.forgot.desc')}</p>
                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                      <InputField label={t('profile.email')} value={forgotEmail} onChange={setForgotEmail} type="email" required placeholder="email@example.com" />
                      {forgotError && <p className="text-red-400 text-xs">{forgotError}</p>}
                      <div className="flex gap-3">
                        <button type="button" onClick={closeForgot}
                          className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl uppercase text-xs hover:text-white hover:bg-white/10 transition-all">
                          {t('common.cancel')}
                        </button>
                        <button type="submit" disabled={forgotSending}
                          className="flex-1 py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                          {forgotSending ? t('home.forgot.sending') : t('home.forgot.send')}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
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

function InputField({ label, value, onChange, type = 'text', placeholder, required }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em] ml-0.5">{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-gray-600
          bg-white/[0.04] border border-white/10
          focus:border-yellow-300/50 focus:bg-white/[0.06]
          outline-none transition-all duration-200"
        style={{ boxShadow: undefined }}
        onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(250,204,21,0.08)')}
        onBlur={(e)  => (e.currentTarget.style.boxShadow = 'none')}
      />
    </div>
  );
}
