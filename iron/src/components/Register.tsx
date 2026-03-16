import { useState } from 'react';
import { useUser } from '../context/userContext';
import type { UserProfile } from '../context/userContext';
import React from "react";
import Footer from './Footer';
import { apiRegister } from '../api';
import { useNavigate } from 'react-router-dom';



// compoentes 
interface InputFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}


// --- Main Component ---
export default function OnboardingForm() {
  const { login } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [firstname, setFirstname] = useState<string>('');
  const [lastname, setLastname] = useState<string>('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [fitnessGoals, setFitnessGoals] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('');
  const [equipments, setEquipments] = useState<string[]>([]);
  const [communityVisible, setCommunityVisible] = useState<boolean>(false);
  const [allergies, setAllergies] = useState<string>('');
  const [injuries, setInjuries] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const nextStep = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setStep((s) => s + 1);
  };

  const prevStep = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
        allergies: allergies.split(',').map((item) => item.trim()).filter(Boolean),
        injuries: injuries.split(',').map((item) => item.trim()).filter(Boolean),
        communityVisible,
        disclaimerAcceptedAt: localStorage.getItem("ironbuddy_disclaimer_accepted_at") || new Date().toISOString(),
      };
      // 1. Create the Django user account
      await apiRegister(email, email, password);
      // 2. Log in and set the full profile in context in one step.
      //    Passing profileData skips the blank backend fetch so it can't
      //    overwrite the profile we're about to save.
      await login(email, password, profileData);
      // The context's useEffect will persist profileData to the backend.
      navigate('/user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-white p-4">
        <div className="w-full max-w-100 bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
          <h2 className="text-2xl font-extrabold uppercase italic text-[--color-iron-gold] drop-shadow-[0_0_18px_rgba(250,204,21,0.9)]">
            Set up your Iron Zone account
          </h2>
          <p className="text-gray-300 mt-3 text-lg tracking-wide">
            Power up your account and let Iron guide every rep, set and goal
          </p>

          {/* Progress Indicator */}
          <div className="flex justify-between mb-8 space-y-4 mt-6">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={`h-2 flex-1 mx-1 rounded-full ${
                  step >= num ? 'bg-[--color-iron-gold]' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* --- STEP 1: PERSONAL --- */}
          {step === 1 && (
            <form onSubmit={nextStep} className="space-y-4">
              <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">
                Step 1: The Basics
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="First Name"
                  value={firstname}
                  onChange={setFirstname}
                  required
                  placeholder="Max"
                />
                <InputField
                  label="Last Name"
                  value={lastname}
                  onChange={setLastname}
                  required
                  placeholder="Mustermann"
                />
              </div>
              <div className="flex flex-col gap-2">
                <InputField
                  label="Birthdate"
                  value={birthdate}
                  onChange={setBirthdate}
                  type="date"
                  required
                  placeholder="DD.MM.YYYY"
                />
              </div>
              <select
                value={gender}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGender(e.target.value)}
                required
                className="w-full p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-white focus:border-yellow-300/60 outline-none transition-all [&>option]:bg-black [&>option]:text-white"
              >
                <option value="" disabled>Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Diverse">Diverse</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
              <button
                type="submit"
                className="w-full flex-1 py-3 font-bold rounded-lg uppercase transition-all duration-300
                           bg-yellow-300 text-black hover:bg-yellow-200 hover:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:scale-[1.02] active:scale-95
                           animate-coach-breathe hover:bg-green-500 hover:text-white
                           hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] hover:scale-[1.02] active:scale-95"
              >
                Next
              </button>
            </form>
          )}

          {/* --- STEP 2: FITNESS --- */}
          {step === 2 && (
            <form onSubmit={nextStep} className="space-y-4">
              <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">
                Step 2: Vitals & Goals
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Weight (kg)" type="number" value={weight} onChange={setWeight} required placeholder="80" />
                <InputField label="Height (cm)" type="number" value={height} onChange={setHeight} required placeholder="175" />
              </div>
              <select
                value={fitnessGoals}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFitnessGoals(e.target.value)
                }
                required
                className="w-full p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-white focus:border-yellow-300/60 outline-none transition-all [&>option]:bg-black [&>option]:text-white"
              >
                <option value="" disabled>
                  Fitness Goals
                </option>
                <option value="Weight Loss">Weight Loss</option>
                <option value="Muscle Gain">Muscle Gain</option>
                <option value="Endurance">Endurance</option>
                <option value="General Fitness">General Fitness</option>
              </select>
              <select
                value={experienceLevel}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setExperienceLevel(e.target.value)
                }
                required
                className="w-full p-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-white focus:border-yellow-300/60 outline-none transition-all [&>option]:bg-black [&>option]:text-white"
              >
                <option value="" disabled>
                  Experience Level
                </option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Unsure">Unsure</option>
              </select>
              <div className="flex gap-4 animate-coach-breathe">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-3 bg-yellow-300 text-black hover:bg-yellow-200 hover:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:scale-[1.02] active:scale-95 font-bold rounded-lg uppercase shadow-[0_0_15px_rgba(250,204,21,0.4)] border border-gray-600"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="hover:bg-green-500 hover:text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.6)]
                             hover:scale-[1.02] active:scale-95 flex-1 py-3 bg-yellow-300 text-black hover:bg-yellow-200 hover:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:scale-[1.02] active:scale-95 font-bold rounded-lg uppercase"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* --- STEP 3: SAFETY & ACCOUNT --- */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">
                Step 3: Safety & Finalize
              </h2>
              <div>
                <h3 className="text-lg text-white font-bold mb-3">Training with... <span className="text-gray-500 text-sm font-normal">(select all that apply)</span></h3>
                <div className="grid grid-cols-2 gap-2">
                  {['Full Gym', 'Dumbbells', 'Barbell & Rack', 'Resistance Bands', 'Kettlebells', 'No Equipment'].map((option) => (
                    <label
                      key={option}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                        equipments.includes(option)
                          ? 'border-yellow-300/60 bg-yellow-300/10 text-white'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={equipments.includes(option)}
                        onChange={() =>
                          setEquipments((prev) =>
                            prev.includes(option)
                              ? prev.filter((e) => e !== option)
                              : [...prev, option]
                          )
                        }
                        className="h-4 w-4 accent-yellow-300"
                      />
                      <span className="text-sm font-semibold">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <InputField
                label="Allergies"
                value={allergies}
                onChange={setAllergies}
                placeholder="Allergies or None..."
              />
              <InputField
                label="Injuries"
                value={injuries}
                onChange={setInjuries}
                placeholder="Injuries or None..."
              />
              {/* Community visibility toggle */}
              <div
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer"
                onClick={() => setCommunityVisible((v) => !v)}
              >
                <div>
                  <p className="text-sm font-bold text-white">👥 Community Visibility</p>
                  <p className="text-xs text-gray-500 mt-0.5">Show me in the community tab so others can message me</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 shrink-0 ml-4 ${communityVisible ? 'bg-yellow-300' : 'bg-white/10'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${communityVisible ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4 border-t border-gray-800">
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  placeholder="email@example.com"
                />
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  required
                  placeholder="********"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-4 animate-coach-breathe">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-3 bg-yellow-300 text-black hover:bg-yellow-200 hover:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:scale-[1.02] active:scale-95 font-bold rounded-lg uppercase"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-yellow-300 text-black hover:bg-yellow-200 hover:shadow-[0_0_20px_rgba(253,224,71,0.6)] hover:scale-[1.02] active:scale-95 font-bold rounded-lg uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Get Started'}
                </button>
              </div>
            </form>
          )}
        </div>
        <Footer />
      </div>
    </>
  );
}

// --- Helper Components ---

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  className,
}: InputFieldProps) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        className={
          className ??
          'p-3 w-full rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-white focus:border-yellow-300/60 outline-none transition-all'
        }
      />
    </div>
  );
}
