import React from 'react';
import Logo from "../../Assets/jaijcs.jpg";
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="w-full bg-white shadow-md px-6 py-3 flex items-center justify-between">
      {/* Logo */}
      <Link to="/landing" className="flex items-center space-x-3">
        <img src={Logo} alt="logo" className="h-14 w-14 rounded-xl object-cover" />
        <span className="text-xl font-semibold text-blue-700">JAi JCS</span>
      </Link>

      {/* Navigation */}
      <nav>
        <ul className="flex space-x-8 text-gray-700 font-medium text-lg">
          <Link to="/landing" className="hover:text-blue-600 transition duration-300 cursor-pointer">Home</Link>
          <Link to="/dashboard" className="hover:text-blue-600 transition duration-300 cursor-pointer">Dashboard</Link>
          <Link to="/about" className="hover:text-blue-600 transition duration-300 cursor-pointer">About</Link>
        </ul>
      </nav>
    </header>
  );
};

export default Header;