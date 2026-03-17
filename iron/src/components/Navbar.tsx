import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/userContext';
import { motion, AnimatePresence } from 'framer-motion';

const LANGS = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'hu', label: 'HU', flag: '🇭🇺' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { token, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const langRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => { logout(); navigate('/'); setIsOpen(false); };
  const active = (path: string) => location.pathname === path;

  const currentLang = LANGS.find(l => l.code === i18n.language) ?? LANGS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 backdrop-blur-2xl"
      style={{
        background: 'linear-gradient(180deg, rgba(6,6,8,0.96) 0%, rgba(6,6,8,0.82) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 0 rgba(250,204,21,0.07), 0 8px 40px rgba(0,0,0,0.6)',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="text-[22px] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 inline-block">🦾</span>
          <span className="font-black text-[1.1rem] tracking-[0.18em] uppercase select-none">
            <span className="text-[--color-iron-gold]" style={{ textShadow: '0 0 24px rgba(250,204,21,0.5)' }}>IRON</span>
            <span className="text-white/90">BUDDY</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {[{ to: '/about', label: t('nav.about') }, { to: '/contact', label: t('nav.contact') }].map(({ to, label }) => (
            <Link
              key={to} to={to}
              className={`relative text-xs font-bold uppercase tracking-[0.14em] transition-colors duration-200 group pb-0.5
                ${active(to) ? 'text-[--color-iron-gold]' : 'text-gray-400 hover:text-white'}`}
            >
              {label}
              <span className={`absolute bottom-0 left-0 h-px bg-[--color-iron-gold] transition-all duration-300
                ${active(to) ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </Link>
          ))}

          {token ? (
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-400
                border border-white/10 rounded-xl hover:text-white hover:border-white/25 hover:bg-white/5 transition-all duration-200"
            >
              {t('nav.sign_out')}
            </button>
          ) : (
            <Link
              to="/signup"
              className="px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-black
                bg-[--color-iron-gold] rounded-xl
                hover:brightness-110 hover:shadow-[0_0_22px_rgba(250,204,21,0.45)] hover:scale-[1.04]
                transition-all duration-200 inline-block"
            >
              {t('nav.sign_up')}
            </Link>
          )}

          {/* Language switcher */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-[0.1em] transition-all duration-200 hover:bg-white/5"
              style={{
                color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              aria-label="Language"
            >
              <span className="text-sm leading-none">{currentLang.flag}</span>
              <span>{currentLang.label}</span>
              <svg className={`w-3 h-3 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.93, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.93, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 rounded-xl overflow-hidden"
                  style={{
                    background: 'rgba(10,10,13,0.97)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                    minWidth: '130px',
                    top: '100%',
                    zIndex: 60,
                  }}
                >
                  {LANGS.map(({ code, label, flag }) => (
                    <button
                      key={code}
                      onClick={() => { i18n.changeLanguage(code); setLangOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-bold transition-all duration-150 hover:bg-white/5"
                      style={{
                        color: i18n.language === code ? '#facc15' : 'rgba(255,255,255,0.6)',
                        background: i18n.language === code ? 'rgba(250,204,21,0.07)' : 'transparent',
                      }}
                    >
                      <span className="text-base">{flag}</span>
                      <span className="tracking-widest">{label}</span>
                      {i18n.language === code && <span className="ml-auto text-[--color-iron-gold]">✓</span>}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Hamburger */}
        <button
          className="md:hidden flex flex-col items-center justify-center w-10 h-10 gap-[5px]
            rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-[2px] bg-white rounded-full transition-all duration-300 origin-center ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block w-5 h-[2px] bg-white rounded-full transition-all duration-300 ${isOpen ? 'opacity-0 scale-x-0' : ''}`} />
          <span className={`block w-5 h-[2px] bg-white rounded-full transition-all duration-300 origin-center ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,6,8,0.97)' }}
          >
            <ul className="flex flex-col gap-1 px-4 py-3">
              {[{ to: '/about', label: t('nav.about') }, { to: '/contact', label: t('nav.contact') }].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to} onClick={() => setIsOpen(false)}
                    className={`block px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all
                      ${active(to) ? 'bg-yellow-300/10 text-[--color-iron-gold] border border-yellow-300/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li className="pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {token ? (
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-wider
                      text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                    {t('nav.sign_out')}
                  </button>
                ) : (
                  <Link to="/signup" onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 bg-yellow-300 text-black rounded-xl text-sm font-black uppercase tracking-wider text-center hover:bg-yellow-200 transition-all">
                    {t('nav.sign_up')}
                  </Link>
                )}
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
