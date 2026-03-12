import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/5">
      <div className="w-full flex justify-between items-center px-6 py-4">

        {/* Logo – far left */}
        <Link to="/" className="font-black text-2xl text-white tracking-widest uppercase flex items-center gap-2">
          🤖 <span className="text-[--color-iron-gold]">IRON</span>BUDDY
        </Link>

        {/* Desktop links – far right */}
        <ul className="hidden md:flex items-center gap-8">
          <li>
            <Link to="/about" className="text-gray-400 hover:text-white font-semibold text-sm uppercase tracking-wider transition-colors duration-200">
              About
            </Link>
          </li>
          <li>
            <Link to="/contact" className="text-gray-400 hover:text-white font-semibold text-sm uppercase tracking-wider transition-colors duration-200">
              Contact
            </Link>
          </li>
          <li>
            <Link to="/signup"
              className="px-5 py-2 bg-[--color-iron-gold] text-black font-black text-sm uppercase rounded-lg
                hover:brightness-110 transition-all duration-200">
              Sign Up
            </Link>
          </li>
        </ul>

        {/* Hamburger – mobile */}
        <button
          className="md:hidden text-white text-2xl"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "✖" : "☰"}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-black border-t border-white/10 px-6 py-4">
          <ul className="flex flex-col gap-4">
            <li>
              <Link to="/about" onClick={() => setIsOpen(false)}
                className="block text-gray-300 hover:text-white font-semibold uppercase tracking-wide">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" onClick={() => setIsOpen(false)}
                className="block text-gray-300 hover:text-white font-semibold uppercase tracking-wide">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/signup" onClick={() => setIsOpen(false)}
                className="block text-[--color-iron-gold] font-black uppercase tracking-wide">
                Sign Up
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
