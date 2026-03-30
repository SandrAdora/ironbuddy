import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { apiConfirmPasswordReset } from '../../api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!uid || !token) {
    return (
      <div className="min-h-screen bg-[--color-gym-dark] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <span className="text-5xl">❌</span>
          <p className="text-red-400 font-black uppercase text-lg">Invalid Reset Link</p>
          <p className="text-gray-400 text-sm">This link is missing required parameters. Please request a new one.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm hover:bg-yellow-200 transition-all">
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      await apiConfirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed. The link may have expired.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white flex items-center justify-center p-6 mt-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        {done ? (
          <div className="text-center space-y-5">
            <span className="text-5xl">✅</span>
            <p className="text-[--color-iron-gold] font-black uppercase text-lg tracking-wide">Password Reset!</p>
            <p className="text-gray-400 text-sm">Your password has been updated. You can now sign in with your new password.</p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
                hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Sign In
            </button>
          </div>
        ) : (
          <>
            <p className="text-[--color-iron-gold] font-black uppercase text-sm tracking-widest mb-1">🔑 New Password</p>
            <p className="text-gray-400 text-xs mb-6">Enter and confirm your new password below.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordField label="New Password" value={password} onChange={setPassword} placeholder="Min. 8 characters" />
              <PasswordField label="Confirm Password" value={confirm} onChange={setConfirm} placeholder="Repeat password" />
              {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-yellow-300 text-black font-black rounded-xl uppercase text-sm
                  hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full p-3 pr-10 rounded-xl bg-white/5 border border-white/10 text-white
            focus:border-yellow-300/60 outline-none transition-all placeholder:text-gray-600"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors text-sm"
        >
          <FontAwesomeIcon icon={show ? faEyeSlash : faEye} />
        </button>
      </div>
    </div>
  );
}
