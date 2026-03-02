import { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useUser } from '../context/userContext';
import { Link } from "react-router-dom";

export default function OnboardingForm() {

 
  
  const { setProfile } = useUser();
  const [step, setStep] = useState(1); // Steuert den aktuellen Schritt

  // 1. States für alle Felder (wie in deinem Code)
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [birthdate, setBirthdate] = useState(new Date());
  const [weight, setWeight] = useState('');
  const [fitnessGoals, setFitnessGoals] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [equipments, setEquipments] = useState('');
  const [allergies, setAllergies] = useState('');
  const [injuries, setInjuries] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const AIname = 'Iron Buddy';

  // Navigation
  const nextStep = (e) => { e.preventDefault(); setStep(s => s + 1); };
  const prevStep = (e) => { e.preventDefault(); setStep(s => s - 1); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const userData = {
      firstname, lastname, birthdate, weight, fitnessGoals, experienceLevel,
      equipments: equipments.split(',').map(item => item.trim()),
      allergies: allergies.split(',').map(item => item.trim()),
      injuries: injuries.split(',').map(item => item.trim()),
      email, password, onboarded: true,
    };
    setProfile(userData);
  };

  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white flex items-center justify-center p-4 space-x-10">

      <div className="w-full max-w-2xl bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
        
        {/* Progress Indicator */}
        <div className="flex justify-between mb-8">
          {[1, 2, 3].map(num => (
            <div key={num} className={`h-2 flex-1 mx-1 rounded-full ${step >= num ? 'bg-[--color-iron-gold]' : 'bg-gray-700'}`} />
          ))}
        </div>

        {/* --- STEP 1: PERSONAL --- */}
        {step === 1 && (
          <form onSubmit={nextStep} className="space-y-4">
            <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">Step 1: The Basics</h2>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="First Name" value={firstname} onChange={setFirstname} required placeholder="Max" />
              <InputField label="Last Name" value={lastname} onChange={setLastname} required placeholder="Mustermann" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Birthdate</label>
              <Calendar onChange={setBirthdate} value={birthdate} className="rounded-lg border-none text-black" />
            </div>
      
            <button 
                type="submit" 
                className="w-full flex-1 py-3 font-bold rounded-lg uppercase transition-all duration-300
                          bg-[--color-iron-gold] text-black 
                          animate-coach-breathe hover:bg-green-500 hover:text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] hover:scale-[1.02] active:scale-95"
              >
              Next
            </button>
          </form>
        )}

        {/* --- STEP 2: FITNESS --- */}
        {step === 2 && (
          <form onSubmit={nextStep} className="space-y-4">
            <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">Step 2: Vitals & Goals</h2>
            <InputField label="Weight (kg)" type="number" value={weight} onChange={setWeight} required placeholder="80" />
            <select value={fitnessGoals} 
            onChange={ setFitnessGoals} placeholder="Fitness Goals..."
            required className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all">
              <option value="" disabled>Fitness Goals</option>
              <option value="Weight Loss">Weight Loss</option>
              <option value="Muscle Gain">Muscle Gain</option>
              <option value="Endurance">Endurance</option>
              <option value="General Fitness">General Fitness</option>
            </select>
            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} placeholder="Beginner..."
             required className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all">
             <option value="" disabled>Experience Level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Unsure">Unsure</option>
            </select>
            
            <div className="flex gap-4 animate-coach-breathe">
              <button type="submit" onClick={prevStep} className="flex-1 py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase shadow-[0_0_15px_rgba(250,204,21,0.4)] border border-gray-600 rounded-lg">Back</button>
              <button type="submit" className="hover:bg-green-500 hover:text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] 
              hover:scale-[1.02] active:scale-95 flex-1 py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase">Next</button>
            </div>
          </form>
        )}

        {/* --- STEP 3: SAFETY & ACCOUNT --- */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">Step 3: Safety & Finalize</h2>
    
            <select multiple value={equipments} onChange={(e) => setEquipments(Array.from(e.target.selectedOptions, option => option.value))} 
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all"
            
            >
              <option value="" disabled>Equipments to train with...</option>
              <option value="Weights">Weights</option>
              <option value="Bells">Dumbbells and Bells of all kind</option>
              <option value="Resistance_Bands">Resistance Bands</option>
              <option value="Bodyweight">Bodyweight</option>
            </select>
            <InputField label="Allergies" value={allergies} onChange={setAllergies} placeholder="Peanuts..." />
            <InputField label="Injuries" value={injuries} onChange={setInjuries} placeholder="Back pain..." />
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
              <InputField label="Email" type="email" value={email} onChange={setEmail} required placeholder="email@example.com" 
              className="border border-gray-700 rounded-lg bg-gray-800 text-white focus:border-[--color-iron-gold] outline-none transition-all" />
              <InputField label="Password" type="password" value={password} onChange={setPassword} required placeholder="********" />
            </div>
            <div className="flex gap-4 animate-coach-breathe">
              <button type="submit" onClick={prevStep} className="flex-1 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase shadow-[0_0_15px_rgba(250,204,21,0.4)]py-3 border border-gray-600 rounded-lg">Back</button>
              <button type="submit" className="flex-1 py-3 bg-[--color-iron-gold] text-black font-bold rounded-lg uppercase shadow-[0_0_15px_rgba(250,204,21,0.4)]">Get Started</button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

// Hilfskomponente um den Code sauber zu halten
function InputField({ label, value, onChange, type = "text", placeholder, required }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{label}</label>
      <input 
        type={type} value={value} required={required} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all"
      />
    </div>
  );
}
