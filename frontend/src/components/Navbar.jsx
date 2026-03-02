import { useState } from 'react';



export default function Navbar() {

    const [isSmallScreen, setIsSmallScreen] =  useState(358);

    function handleScreen(){
        setIsSmallScreen(true);
    }
  return (
    <nav className="fixed top-5 w-full flex justify-between items-center px-6">
      
      {/* Logo */}
      <a href="/" className="font-bold text-3xl">🤖</a>

      { !isSmallScreen }

      {/* Navigation */}
      <ul className="flex items-center space-x-6">
        <li className="text-gray-700 hover:text-white font-bold">
          <a href="/">About</a>
        </li>
        <li className="text-gray-700 hover:text-white font-bold">
          <a href="#">Contact</a>
        </li>
        <li className="text-gray-700 hover:text-white font-bold">
          <a href="#">Sign Up</a>
        </li>
      </ul>

    </nav>
  );
}
