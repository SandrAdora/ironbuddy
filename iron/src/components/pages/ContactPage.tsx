import { useState } from 'react';
import type { JSX } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/themeContext';

export default function Contact(): JSX.Element {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const light = theme === 'light';

  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus]   = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/contact/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send message');
      setStatus('sent');
      setName(''); setEmail(''); setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-16" style={{ background: light ? '#f0f0f3' : 'var(--color-gym-dark)', color: light ? '#111' : '#fff' }}>

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(250,204,21,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-6">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.6))' }} />
            <span className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.35em] uppercase opacity-80">{t('contact.badge')}</span>
            <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, rgba(250,204,21,0.6), transparent)' }} />
          </div>
          <h1 className="text-4xl font-black uppercase italic" style={{ color: light ? '#111' : '#fff' }}>{t('contact.title')}</h1>
          <p className="text-sm mt-2" style={{ color: light ? '#666' : 'rgb(107,114,128)' }}>{t('contact.subtitle')}</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="rounded-2xl"
          style={{
            background: light ? '#ffffff' : '#0d0d10',
            border: light ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(250,204,21,0.35)',
            boxShadow: light ? '0 4px 24px rgba(0,0,0,0.08)' : '0 0 40px rgba(250,204,21,0.08)',
          }}
        >
          <div className="p-8 rounded-[calc(1.25rem-1px)]">
            {status === 'sent' ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  ✅
                </div>
                <p className="font-black uppercase tracking-wide text-lg" style={{ color: light ? '#111' : '#fff' }}>{t('contact.sent_title')}</p>
                <p className="text-sm" style={{ color: light ? '#666' : 'rgb(156,163,175)' }}>{t('contact.sent_desc')}</p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-2 px-8 py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs
                    hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {t('contact.send_another')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <FormField
                  label={t('contact.name')}
                  value={name}
                  onChange={setName}
                  placeholder={t('contact.name_placeholder')}
                  required
                  light={light}
                />
                <FormField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="email@example.com"
                  required
                  light={light}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] ml-0.5"
                    style={{ color: light ? '#888' : 'rgb(107,114,128)' }}>
                    {t('contact.message')}
                  </label>
                  <textarea
                    rows={5} required value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('contact.message_placeholder')}
                    className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none transition-all duration-200"
                    style={{
                      background: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                      border: light ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)',
                      color: light ? '#111' : '#fff',
                    }}
                    onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(250,204,21,0.15)')}
                    onBlur={(e)  => (e.currentTarget.style.boxShadow = 'none')}
                  />
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <span className="text-red-400 text-xs shrink-0">⚠</span>
                    <p className="text-red-400 text-xs">{error}</p>
                  </div>
                )}

                <button
                  type="submit" disabled={status === 'sending'}
                  className="w-full py-3.5 font-black rounded-xl uppercase tracking-wider text-sm transition-all duration-200
                    bg-yellow-300 text-black
                    hover:brightness-110 hover:shadow-[0_0_28px_rgba(250,204,21,0.5)] hover:scale-[1.02]
                    active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? t('contact.submitting') : t('contact.submit')}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder, required, light }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  light: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black uppercase tracking-[0.18em] ml-0.5"
        style={{ color: light ? '#888' : 'rgb(107,114,128)' }}>
        {label}
      </label>
      <input
        type={type} value={value} required={required} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
        style={{
          background: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
          border: light ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)',
          color: light ? '#111' : '#fff',
        }}
        onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(250,204,21,0.15)')}
        onBlur={(e)  => (e.currentTarget.style.boxShadow = 'none')}
      />
    </div>
  );
}
