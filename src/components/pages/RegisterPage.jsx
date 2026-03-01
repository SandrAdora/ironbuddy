// src/pages/RegisterPage.jsx
import OnboardingForm from "../Register";
import HomepageNavbar from "../Navbar";
import { Link } from "react-router-dom";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white">
      <Navbar />

      <div className="flex justify-center mt-16 px-6">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-xl">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
