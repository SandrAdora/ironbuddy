import { useState } from 'react';
import { Link } from 'react-router-dom';
import About from './pages/AboutPage';
import Contact from './pages/ContactPage';
import Signup from './pages/SignupPage';


export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-5 w-full px-6 z-50">
      <div className="max-w-2xl md:mx-auto flex justify-between items-center pr-6 ">

        {/* Logo */}
        <Link to="/" className=" font-bold text-3xl text-white">
          🤖
        </Link>

        {/* Desktop Menu */}
        <ul className="md:flex items-center space-x-6 hidden">
          <li className="text-gray-300 hover:text-white font-bold">
            <Link to="/about">About</Link>
          </li>
          <li className="text-gray-300 hover:text-white font-bold">
            <Link to="/contact">Contact</Link>
          </li>
          <li className="text-gray-300 hover:text-white font-bold">
            <Link to="/signup">Sign Up</Link>
          </li>
        </ul>

        {/* Hamburger Button */}
        <button
          className="md:hidden text-black text-3xl"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "✖" : "☰"}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-black mt-4 rounded-lg shadow-lg px-6 py-4">
          <ul className="flex flex-col space-y-4 text-center">
            <li className="text-gray-300 hover:text-white font-bold">
              <Link to="/about" onClick={() => setIsOpen(false)}>About</Link>
            </li>
            <li className="text-gray-300 hover:text-white font-bold">
              <Link to="/contact" onClick={() => setIsOpen(false)}>Contact</Link>
            </li>
            <li className="text-gray-300 hover:text-white font-bold">
              <Link to="/signup" onClick={() => setIsOpen(false)}>Sign Up</Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
