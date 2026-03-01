import { useState } from 'react';
import { useUser } from '../../context/userContext'; 
import OnboardingForm from '../Register';
import Navbar from '../Navbar';
import { Link } from "react-router-dom";
import Modal from '../Modal';
import Footer from '../Footer';
// create the hompage component 
export default function HomePage() {

    // initialize global state user 
    const { profile, setProfile } = useUser();

    // create local state for email and  password
    const [email,  setEmail] =  useState('');
    const [password, setPassword] = useState('');

    // handle login 
    const handleLogin = (e) => {
        e.preventDefault(); // prevent page reload 

        // check if user already exists in the local state 
        if (email === profile.email && password === profile.password){
            alert(`Welcome Back! ${profile.name}`); // welcome message
            // is user exists set onbboard true 
            setProfile({ 
                ...profile,
                onboarded:true, // mark as onboarded 
            });
        } else {
            // if user does not exist show alert 
            alert('Invalid email or password. Please try again.');
        }
    };
    // return the homepage layout 
    return (
        <div>   
            
            <Navbar />
            <section className="grid gap-8 md:grid-cols-2">
                <div className="bg-[--color-gm-dark] text-white justify-center items-center px-10"> 
                    <span className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">
                        AI COACH
                    </span>
                    <h1 className="text-4xl  font-black italic uppercase leading-tight">
                        <span>Hello, I am </span>
                        <span className="text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                            🤖 IRON 
                        </span>
                    </h1>
                        <br />
                    <span className="text-gray-400 text-3xl  mt-2 block">
                        Your Personal Fitness Trainer
                    </span>
                    <br />
                </div>
                <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl max-w-100 m-8">
                    <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase decoration-[--color-iron-gold]/30">
                    Sign In 
                    </h2>
                    <form onSubmit={handleLogin} 
                        className="space-y-4 mt-6">
                        <InputField 
                            label="Email" 
                            value={email} 
                            onChange={setEmail} 
                            type="email"
                            required 
                            placeholder="Enter your email" />
                        <InputField 
                            label="Password" 
                            value={password} 
                            onChange={setPassword} 
                            type="password" 
                            required 
                            placeholder="Enter your password" />
                        <button 
                            type="submit" 
                            className="w-full py-4 font-black rounded-lg uppercase transition-all duration-300
                                        bg-[--color-iron-gold] text-black hover:bg-[--color-iron-gold-hover] hover:text-white">
                                Sign In
                        </button>
                    </form>
                    <p className="text-gray-400 text-sm mt-4 text-center">
                        No Account yet?{" "}
                        <Link to="/register" 
                        className="text-[--color-iron-gold] hover:underline transition-colors duration-300 font-bold">
                            Sign Up Here
                        </Link>
                    </p>
                </div>            
            </section>
        <Footer /> 
    </div>
    );
}

// create a reusable input field component
function InputField({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:border-[--color-iron-gold] outline-none transition-all"
      />
    </div>
  );
}
