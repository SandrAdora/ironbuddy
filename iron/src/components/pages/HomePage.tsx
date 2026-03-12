import { useState } from 'react';
import { useUser } from '../../context/userContext.js';
import { Link } from "react-router-dom";
import React from "react";

export default function Home() {
  const { profile, setProfile } = useUser();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email === "email@example.com" && password === "password123") {
      alert(`Welcome Back! ${profile.name}`);
      setProfile({ ...profile, onboarded: true });
    } else {
      alert('Invalid email or password. Please try again.');
    }
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
              🤖 IRON
            </span>
          </h1>
          <span className="text-gray-400 text-3xl mt-4 block">
            Your Personal Fitness Trainer
          </span>
        </div>

        <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl max-w-md mx-auto w-full
          text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
          <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase">
            Sign In
          </h2>
          <form onSubmit={handleLogin} className="space-y-4 mt-6">
            <InputField label="Email" value={email} onChange={setEmail}
              type="email" required placeholder="email@example.com" />
            <InputField label="Password" value={password} onChange={setPassword}
              type="password" required placeholder="••••••••" />
            <button type="submit"
              className="w-full py-4 font-black rounded-lg uppercase transition-all duration-300
                bg-[--color-iron-gold] text-black hover:brightness-110">
              Sign In
            </button>
          </form>
          <p className="text-gray-400 text-sm mt-4 text-center">
            No Account yet?{" "}
            <Link to="/signup" className="text-[--color-iron-gold] hover:underline transition-colors duration-300 font-bold">
              Sign Up Here
            </Link>
          </p>
        </div>
      </section>
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
        className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white
          focus:border-[--color-iron-gold] outline-none transition-all"
      />
    </div>
  );
}
