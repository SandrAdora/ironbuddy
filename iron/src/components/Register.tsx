import { useState } from 'react';
import { useUser } from '../context/userContext';
import type { UserProfile } from '../context/userContext';
import { useTheme } from '../context/themeContext';
import React from "react";
import { apiRegister } from '../api';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

const STEP_INFO = [
  { num: 1, label: 'Basics',  icon: '👤' },
  { num: 2, label: 'Vitals',  icon: '🎯' },
  { num: 3, label: 'Finalize', icon: '🔐' },
];

export default function OnboardingForm() {
  const { login } = useUser();
  const { theme } = useTheme();
  const light = theme === 'light';
  const navigate = useNavigate();
  const [step, setStep]     = useState(1);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const [firstname, setFirstname]             = useState('');
  const [lastname, setLastname]               = useState('');
  const [birthdate, setBirthdate]             = useState('');
  const [weight, setWeight]                   = useState('');
  const [height, setHeight]                   = useState('');
  const [gender, setGender]                   = useState('');
  const [fitnessGoals, setFitnessGoals]       = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [equipments, setEquipments]           = useState<string[]>([]);
  const [communityVisible, setCommunityVisible] = useState(false);
  const [allergies, setAllergies]             = useState('');
  const [injuries, setInjuries]               = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');

  const nextStep = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setStep((s) => s + 1); };
  const prevStep = (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); setStep((s) => s - 1); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const profileData: Partial<UserProfile> = {
        name: `${firstname} ${lastname}`,
        birthdate,
        weight: parseFloat(weight) || null,
        height: parseFloat(height) || null,
        gender,
        fitnessGoals,
        experienceLevel,
        equipments: equipments.join(', '),
        allergies: allergies.split(',').map((i) => i.trim()).filter(Boolean),
        injuries: injuries.split(',').map((i) => i.trim()).filter(Boolean),
        communityVisible,
        disclaimerAcceptedAt: localStorage.getItem('ironbuddy_disclaimer_accepted_at') || new Date().toISOString(),
      };
      await apiRegister(email, email, password);
      await login(email, password, profileData);
      navigate('/user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepConnector = (num: number) =>
    step > num ? 'bg-yellow-300/60' : light ? 'bg-black/10' : 'bg-white/10';

  return (
    <div className="p-4 w-full" style={{ color: light ? '#111' : '#fff' }}>
      <div className="card-gold w-full max-w-md mx-auto">
        <div
          className="p-8 rounded-[calc(1.25rem-1px)]"
          style={{ background: light ? '#ffffff' : '#0d0d10' }}
        >

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[--color-iron-gold]" style={{ boxShadow: '0 0 8px rgba(250,204,21,0.8)' }} />
              <span className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.3em] uppercase">Iron Zone</span>
            </div>
            <h2 className="text-2xl font-black uppercase italic mt-1" style={{ color: light ? '#111' : '#fff' }}>
              Set Up Your Account
            </h2>
            <p className="text-sm mt-1" style={{ color: light ? '#777' : '#6b7280' }}>
              Let IRON guide every rep, set and goal.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-8">
            {STEP_INFO.map(({ num, label, icon }, i) => (
              <React.Fragment key={num}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-300
                    ${step > num ? 'bg-yellow-300 text-black' : step === num ? 'text-black font-black' : ''}`}
                    style={
                      step === num
                        ? { background: 'linear-gradient(135deg,#facc15,#fb923c)', boxShadow: '0 0 16px rgba(250,204,21,0.35)' }
                        : step < num
                          ? { background: light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: `1px solid ${light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, color: light ? '#aaa' : '#4b5563' }
                          : {}
                    }
                  >
                    {step > num ? '✓' : icon}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${step >= num ? 'text-[--color-iron-gold]' : light ? 'text-gray-400' : 'text-gray-700'}`}>
                    {label}
                  </span>
                </div>
                {i < STEP_INFO.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-4 transition-all duration-500 ${stepConnector(num)}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >

              {/* ── STEP 1 ── */}
              {step === 1 && (
                <form onSubmit={nextStep} className="space-y-4">
                  <SectionTitle light={light}>The Basics</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField light={light} label="First Name" value={firstname} onChange={setFirstname} required placeholder="Max" />
                    <InputField light={light} label="Last Name"  value={lastname}  onChange={setLastname}  required placeholder="Mustermann" />
                  </div>
                  <InputField light={light} label="Birthdate" value={birthdate} onChange={setBirthdate} type="date" required />
                  <StyledSelect light={light} value={gender} onChange={setGender} required placeholder="— Gender —">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Diverse">Diverse</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </StyledSelect>
                  <NavButtons light={light} onPrev={null} nextLabel="Next →" />
                </form>
              )}

              {/* ── STEP 2 ── */}
              {step === 2 && (
                <form onSubmit={nextStep} className="space-y-4">
                  <SectionTitle light={light}>Vitals & Goals</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField light={light} label="Weight (kg)" type="number" value={weight} onChange={setWeight} required placeholder="80" />
                    <InputField light={light} label="Height (cm)" type="number" value={height} onChange={setHeight} required placeholder="175" />
                  </div>
                  <StyledSelect light={light} value={fitnessGoals} onChange={setFitnessGoals} required placeholder="— Fitness Goal —">
                    <option value="Weight Loss">Weight Loss</option>
                    <option value="Muscle Gain">Muscle Gain</option>
                    <option value="Endurance">Endurance</option>
                    <option value="General Fitness">General Fitness</option>
                  </StyledSelect>
                  <StyledSelect light={light} value={experienceLevel} onChange={setExperienceLevel} required placeholder="— Experience Level —">
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Unsure">Unsure</option>
                  </StyledSelect>
                  <NavButtons light={light} onPrev={prevStep} nextLabel="Next →" />
                </form>
              )}

              {/* ── STEP 3 ── */}
              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <SectionTitle light={light}>Safety & Finalize</SectionTitle>

                  {/* Equipment checkboxes */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] ml-0.5 block mb-2" style={{ color: light ? '#777' : '#6b7280' }}>
                      Training with…
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Full Gym', 'Dumbbells', 'Barbell & Rack', 'Resistance Bands', 'Kettlebells', 'No Equipment'].map((opt) => {
                        const checked = equipments.includes(opt);
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all duration-200"
                            style={{
                              borderColor: checked ? 'rgba(250,204,21,0.5)' : light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)',
                              background: checked ? 'rgba(250,204,21,0.06)' : light ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)',
                              color: checked ? (light ? '#111' : '#fff') : light ? '#777' : '#6b7280',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setEquipments((prev) =>
                                prev.includes(opt) ? prev.filter((e) => e !== opt) : [...prev, opt]
                              )}
                              className="h-3.5 w-3.5 accent-yellow-300 shrink-0"
                            />
                            <span className="text-xs font-semibold leading-tight">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <InputField light={light} label="Allergies" value={allergies} onChange={setAllergies} placeholder="e.g. lactose, gluten — or None" />
                  <InputField light={light} label="Injuries" value={injuries} onChange={setInjuries} placeholder="e.g. knee pain — or None" />

                  {/* Community visibility */}
                  <div
                    className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200 border"
                    style={{
                      background: communityVisible ? 'rgba(250,204,21,0.06)' : light ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)',
                      borderColor: communityVisible ? 'rgba(250,204,21,0.3)' : light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)',
                    }}
                    onClick={() => setCommunityVisible((v) => !v)}
                  >
                    <div>
                      <p className="text-sm font-bold" style={{ color: light ? '#111' : '#fff' }}>👥 Community Visibility</p>
                      <p className="text-xs mt-0.5" style={{ color: light ? '#777' : '#6b7280' }}>Let others find and message you</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-all duration-200 flex items-center px-1 shrink-0 ml-4 ${communityVisible ? 'bg-yellow-300' : ''}`}
                      style={communityVisible ? { boxShadow: '0 0 10px rgba(250,204,21,0.3)' } : { background: light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)' }}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${communityVisible ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  {/* Credentials */}
                  <div className="pt-3 space-y-3" style={{ borderTop: `1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}` }}>
                    <InputField light={light} label="Email" type="email" value={email} onChange={setEmail} required placeholder="email@example.com" />
                    <InputField light={light} label="Password" type="password" value={password} onChange={setPassword} required placeholder="Min. 8 characters" />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <span className="text-red-400 text-xs shrink-0">⚠</span>
                      <p className="text-red-400 text-xs">{error}</p>
                    </div>
                  )}

                  <NavButtons light={light} onPrev={prevStep} nextLabel={loading ? 'Creating…' : 'Get Started 🚀'} disabled={loading} />
                </form>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function SectionTitle({ children, light }: { children: React.ReactNode; light: boolean }) {
  return (
    <h3 className="text-base font-black italic uppercase mb-1" style={{ color: light ? '#111' : '#fff' }}>{children}</h3>
  );
}

function NavButtons({ onPrev, nextLabel, disabled, light }: { onPrev: ((e: React.MouseEvent<HTMLButtonElement>) => void) | null; nextLabel: string; disabled?: boolean; light: boolean }) {
  return (
    <div className="flex gap-3 pt-2">
      {onPrev && (
        <button
          type="button" onClick={onPrev}
          className="flex-1 py-3 text-sm font-bold rounded-xl uppercase tracking-wider transition-all"
          style={{
            background: light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`,
            color: light ? '#555' : '#9ca3af',
          }}
        >
          ← Back
        </button>
      )}
      <button
        type="submit" disabled={disabled}
        className={`py-3 text-sm font-black rounded-xl uppercase tracking-wider transition-all duration-200
          bg-yellow-300 text-black
          hover:brightness-110 hover:shadow-[0_0_22px_rgba(250,204,21,0.45)] hover:scale-[1.02]
          active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
          ${onPrev ? 'flex-1' : 'w-full'}`}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function StyledSelect({ value, onChange, required, placeholder, children, light }: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  children: React.ReactNode;
  light: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
      style={{
        background: light ? '#f4f4f6' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`,
        color: light ? '#111' : '#fff',
      }}
    >
      {placeholder && <option value="" disabled style={{ background: light ? '#fff' : '#0d0d10', color: light ? '#111' : '#fff' }}>{placeholder}</option>}
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>, {
              style: { background: light ? '#fff' : '#0d0d10', color: light ? '#111' : '#fff' }
            })
          : child
      )}
    </select>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder, required, light }: InputFieldProps & { light: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black uppercase tracking-[0.18em] ml-0.5" style={{ color: light ? '#777' : '#6b7280' }}>{label}</label>
      <input
        type={type} value={value} required={required} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
        style={{
          background: light ? '#f4f4f6' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`,
          color: light ? '#111' : '#fff',
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = '1px solid rgba(250,204,21,0.5)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(250,204,21,0.08)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = `1px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}`;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}
