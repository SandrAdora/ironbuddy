import { useState } from 'react';
import { useUser } from '../context/userContext'; 
import OnboardingForm from './Register';
import HomepageNavbar from './HompageNavbar';


// create the hompage component 
export default function HomePage() {

    // initialize global state user 
    const { profile, setProfile } = useUser();

    // create local state for email and  password
    const [email,  setEmail] =  usestate('');
    const [password, setPassword] = useState('');

    // handle login 
    const handleLogin = (e) => {
        e.peventDefault(); // prevent page reload 

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
    // return the hompage layout 
    return (
        <div classname="min-h-screen bg-[--color-gm-dark] text-white"> 
            <HomepageNavbar />
            <div className="flex flex-col mid:flex-row items-center justify-center gap-10 mt-16 px-6">
                {/* left side: branding */ }
                <div className="space-y-4 space-x-4 text-center md:text-left max-w-lg">
                    <span className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">
                        AI IRON COACH
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black italic uppercase leading-tight">
                        <span>Hello, I am </span>
                        <span className="text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                            🤖 Iron 
                        </span>
                    </h1>
                        <br />
                    <span className="text-gray-400 text-3xl md:text-4xl mt-2 block">
                        Your Personal Fitness Trainer
                    </span>
                        <p className="text-gray-400 text-lg">
                            Your  personalized AI  Fitness Trainer. I will help you to achieve the goals you set for yourself. 
                            I will create a personalized workout plan, which includes <i><strong>workouts, nutritions, recovery</strong></i> for you, based on your profile and your goals. 
                            I will also provide you with tips and advice to help you to achieve your goals with lots and lots of motivation.
                        </p> 
                        <Link 
                            to="/register"
                            className="inline-block bg-[--color-iron-gold] text-black font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-[--color-iron-gold-hover] transition-colors duration-300"  >
                                Get Started
                        </Link>                 
                </div>
                {/* right side: form logic login box */ }
                <div>
                    <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 shadow-2xl w-full max-w-md">
                        <h2 className="text-2xl font-bold text-[--color-iron-gold] italic uppercase underline decoration-[--color-iron-gold]/30">
                        Sign In </h2>
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
                        <p className="trext-gray-400 text-sm mt-4 text-center">
                            No Account yet?{" "}
                            <Link to="/register" 
                            className="text-[--color-iron-gold] hover:underline">
                                Sign Up Here
                            </Link>
                        </p>
                    </div>

                </div>

            </div>
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
