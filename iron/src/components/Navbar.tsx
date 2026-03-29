import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/userContext';
import { useTheme } from '../context/themeContext';
import { motion, AnimatePresence } from 'framer-motion';

const LANGS = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'hu', label: 'HU', flag: '🇭🇺' },
];

const NAV_LINK = 'relative text-[11px] font-bold uppercase tracking-[0.12em] font-sans leading-none transition-colors duration-200 group pb-0.5 bg-transparent border-none p-0 m-0 cursor-pointer';
const NAV_UNDERLINE = 'absolute bottom-0 left-0 h-px bg-[--color-iron-gold] transition-all duration-300';

const HOME_SECTIONS = [
  { id: 'how-it-works', key: 'home.section_nav.how_it_works' },
  { id: 'features',     key: 'home.section_nav.features' },
  { id: 'cta',          key: 'home.section_nav.join' },
];

export default function Navbar() {
  const [isOpen, setIsOpen]               = useState(false);
  const [langOpen, setLangOpen]           = useState(false);
  const [activeSection, setActiveSection] = useState('how-it-works');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { token, setProfile, logout }     = useUser();
  const location                          = useLocation();
  const navigate                          = useNavigate();
  const { t, i18n }                       = useTranslation();
  const langRef                           = useRef<HTMLDivElement>(null);

  const { theme, toggleTheme } = useTheme();
  const isHome = location.pathname === '/';

  const active = (path: string) => location.pathname === path;

  const currentLang = LANGS.find(l => l.code === i18n.language) ?? LANGS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isHome) return;
    const observers: IntersectionObserver[] = [];
    HOME_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: '-40% 0px -55% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [isHome]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };


  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 backdrop-blur-2xl"
      style={{
        background: theme === 'light'
          ? 'linear-gradient(180deg, rgba(240,240,243,0.97) 0%, rgba(240,240,243,0.93) 100%)'
          : 'linear-gradient(180deg, rgba(6,6,8,0.96) 0%, rgba(6,6,8,0.82) 100%)',
        borderBottom: theme === 'light' ? '1px solid rgba(0,0,0,0.09)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: theme === 'light' ? '0 2px 16px rgba(0,0,0,0.08)' : '0 1px 0 rgba(250,204,21,0.07), 0 8px 40px rgba(0,0,0,0.6)',
      }}
    >
      {/* ── Desktop bar ───────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-14">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <span className="text-[20px] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 inline-block" style={{ filter: 'grayscale(1) brightness(0.85) contrast(1.2)' }}>🦾</span>
          <span className="font-black text-[1rem] tracking-[0.16em] uppercase select-none">
            <span className="text-[--color-iron-gold]" style={{ textShadow: '0 0 20px rgba(250,204,21,0.5)' }}>IRON</span>
            <span style={{ color: theme === 'light' ? '#111111' : 'rgba(255,255,255,0.9)' }}>BUDDY</span>
          </span>
        </Link>

        {/* Desktop nav items */}
        <div className="hidden md:flex items-center gap-4 ml-auto">

          {/* Section scroll links */}
          {isHome && HOME_SECTIONS.map(({ id, key }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`${NAV_LINK} ${activeSection === id ? 'text-[--color-iron-gold]' : 'text-gray-400 hover:text-white'}`}
            >
              {t(key)}
              <span className={`${NAV_UNDERLINE} ${activeSection === id ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </a>
          ))}

          {/* Page links */}
          {[{ to: '/about', label: t('nav.about') }, { to: '/contact', label: t('nav.contact') }].map(({ to, label }) => (
            <Link
              key={to} to={to}
              className={`${NAV_LINK} ${active(to) ? 'text-[--color-iron-gold]' : 'text-gray-400 hover:text-white'}`}
            >
              {label}
              <span className={`${NAV_UNDERLINE} ${active(to) ? 'w-full' : 'w-0 group-hover:w-full'}`} />
            </Link>
          ))}

          {/* Thin divider before utility controls */}
          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Sign Up — pill style, compact */}
          {!token && (
            <Link
              to="/signup"
              className="px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-black
                bg-[--color-iron-gold] rounded-full
                hover:brightness-110 hover:shadow-[0_0_18px_rgba(250,204,21,0.4)] hover:scale-[1.04]
                transition-all duration-200 inline-block"
            >
              {t('nav.sign_up')}
            </Link>
          )}

          {/* Install app */}
          {installPrompt && (
            <button
              onClick={handleInstall}
              aria-label="Install IronBuddy app"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.08em] transition-all duration-200 hover:scale-[1.04]"
              style={{ background: 'rgba(250,204,21,0.1)', color: '#facc15', border: '1px solid rgba(250,204,21,0.25)' }}
            >
              ⬇ Install
            </button>
          )}

          {/* Theme toggle — icon only */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all duration-200 hover:scale-110"
            style={{ color: theme === 'light' ? '#555' : 'rgba(255,255,255,0.55)' }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Language — flag only, compact */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all duration-200 hover:scale-110"
              aria-label="Language"
            >
              {currentLang.flag}
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
                    background: theme === 'light' ? '#ffffff' : 'rgba(10,10,13,0.97)',
                    border: theme === 'light' ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: theme === 'light' ? '0 8px 32px rgba(0,0,0,0.15)' : '0 8px 32px rgba(0,0,0,0.7)',
                    minWidth: '130px',
                    top: '100%',
                    zIndex: 60,
                  }}
                >
                  {LANGS.map(({ code, label, flag }) => (
                    <button
                      key={code}
                      onClick={() => { i18n.changeLanguage(code); setProfile(p => ({ ...p, language: code })); setLangOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-bold transition-all duration-150"
                      style={{
                        color: i18n.language === code ? '#d97706' : theme === 'light' ? '#333' : 'rgba(255,255,255,0.6)',
                        background: i18n.language === code ? 'rgba(250,204,21,0.1)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (i18n.language !== code) (e.currentTarget as HTMLButtonElement).style.background = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (i18n.language !== code) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
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
          className="md:hidden flex flex-col items-center justify-center w-9 h-9 gap-[5px] rounded-xl transition-all"
          style={{
            background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
            border: theme === 'light' ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)',
          }}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block w-4.5 h-[2px] rounded-full transition-all duration-300 origin-center ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} style={{ background: theme === 'light' ? '#111' : '#fff' }} />
          <span className={`block w-4.5 h-[2px] rounded-full transition-all duration-300 ${isOpen ? 'opacity-0 scale-x-0' : ''}`} style={{ background: theme === 'light' ? '#111' : '#fff' }} />
          <span className={`block w-4.5 h-[2px] rounded-full transition-all duration-300 origin-center ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} style={{ background: theme === 'light' ? '#111' : '#fff' }} />
        </button>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden"
            style={{
              borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
              background: theme === 'light' ? 'rgba(240,240,243,0.98)' : 'rgba(6,6,8,0.97)',
            }}
          >
            <ul className="flex flex-col gap-0.5 px-4 py-3">

              {isHome && HOME_SECTIONS.map(({ id, key }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all
                      ${activeSection === id
                        ? 'bg-yellow-300/10 text-[--color-iron-gold] border border-yellow-300/20'
                        : theme === 'light' ? 'text-gray-600 hover:text-black hover:bg-black/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {t(key)}
                  </a>
                </li>
              ))}

              {[{ to: '/about', label: t('nav.about') }, { to: '/contact', label: t('nav.contact') }].map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to} onClick={() => setIsOpen(false)}
                    className={`block px-3 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all
                      ${active(to) ? 'bg-yellow-300/10 text-[--color-iron-gold] border border-yellow-300/20' : theme === 'light' ? 'text-gray-600 hover:text-black hover:bg-black/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {label}
                  </Link>
                </li>
              ))}

              <li className="pt-2 mt-1" style={{ borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)' }}>
                {token ? (
                  <button
                    onClick={() => { logout(); setIsOpen(false); navigate('/'); }}
                    className="w-full block px-3 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider text-center transition-all"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    {t('nav.sign_out')}
                  </button>
                ) : (
                  <Link to="/signup" onClick={() => setIsOpen(false)}
                    className="block px-3 py-2.5 bg-yellow-300 text-black rounded-xl text-sm font-black uppercase tracking-wider text-center hover:bg-yellow-200 transition-all">
                    {t('nav.sign_up')}
                  </Link>
                )}
              </li>

              {installPrompt && (
                <li>
                  <button
                    onClick={() => { handleInstall(); setIsOpen(false); }}
                    aria-label="Install IronBuddy app"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all"
                    style={{ background: 'rgba(250,204,21,0.1)', color: '#facc15', border: '1px solid rgba(250,204,21,0.25)' }}
                  >
                    ⬇ Install App
                  </button>
                </li>
              )}

              {/* Mobile theme + language in one row */}
              <li className="pt-2" style={{ borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${theme === 'light' ? 'text-gray-600 hover:text-black hover:bg-black/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {theme === 'dark' ? '☀️' : '🌙'}
                    <span className="text-xs uppercase tracking-wider">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </button>
                  <div className="flex gap-1.5">
                    {LANGS.map(({ code, flag }) => (
                      <button
                        key={code}
                        onClick={() => { i18n.changeLanguage(code); setProfile(p => ({ ...p, language: code })); setIsOpen(false); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all"
                        style={{
                          background: i18n.language === code ? 'rgba(250,204,21,0.15)' : theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                          border: i18n.language === code ? '1px solid rgba(250,204,21,0.35)' : theme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                        aria-label={code}
                      >
                        {flag}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
