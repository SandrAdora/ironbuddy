import { useState } from 'react';
import { useUser, type UserProfile } from '../context/userContext';
import React from "react";
import Footer from './Footer';



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

interface RadioButtonProps {
  label: string;
  value: string;
  selected: string;
  onChange: (val: string) => void;
}

// --- Main Component ---
export default function OnboardingForm() {
  const { setProfile } = useUser();
  const [step, setStep] = useState<number>(1);

  const [firstname, setFirstname] = useState<string>('');
  const [lastname, setLastname] = useState<string>('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [fitnessGoals, setFitnessGoals] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('');
  const [equipments, setEquipments] = useState<string>('');
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const userData: UserProfile = {
      name: `${firstname} ${lastname}`,
      birthdate,
      weight: parseFloat(weight) || null,
      height: parseFloat(height) || null,
      gender,
      fitnessGoals,
      experienceLevel,
      equipments,
      allergies: allergies.split(',').map((item) => item.trim()),
      injuries: injuries.split(',').map((item) => item.trim()),
      email,
      password,
      onboarded: true,
    };
    setProfile(userData);
  };

  return (
    <>
      <div className="text-white p-4">
        <div className="w-full max-w-100 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
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
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all"
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
                           bg-[--color-iron-gold] text-black
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
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all"
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
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all"
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
                  className="flex-1 py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase shadow-[0_0_15px_rgba(250,204,21,0.4)] border border-gray-600"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="hover:bg-green-500 hover:text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.6)]
                             hover:scale-[1.02] active:scale-95 flex-1 py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase"
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
              <h3 className="text-2xl text-white">Trainings with...</h3>
              <RadioButton
                label="Equipments"
                value="Equipments"
                selected={equipments}
                onChange={setEquipments}
              />
              <br />
              <RadioButton
                label="Resistance Bands"
                value="Resistance Bands"
                selected={equipments}
                onChange={setEquipments}
              />
              <br />
              <RadioButton
                label="No Equipments"
                value="No Equipments"
                selected={equipments}
                onChange={setEquipments}
              />
              <br />
              <InputField
                label="Allergies"
                value={allergies}
                onChange={setAllergies}
                placeholder="Peanuts..."
              />
              <InputField
                label="Injuries"
                value={injuries}
                onChange={setInjuries}
                placeholder="Back pain..."
              />
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  placeholder="email@example.com"
                  className="border border-gray-700 rounded-lg bg-gray-800 text-white focus:border-[--color-iron-gold] outline-none transition-all"
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
              <div className="flex gap-4 animate-coach-breathe">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase shadow-[0_0_15px_rgba(250,204,21,0.4)] border border-gray-600"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                >
                  Get Started
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
          'p-3 w-full rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all'
        }
      />
    </div>
  );
}

function RadioButton({ label, value, selected, onChange }: RadioButtonProps) {
  return (
    <label>
      <input
        type="radio"
        value={value}
        checked={selected === value}
        onChange={() => onChange(value)}
        className="h-5 w-6 text-[--color-iron-gold] focus:ring-[--color-iron-gold]"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}