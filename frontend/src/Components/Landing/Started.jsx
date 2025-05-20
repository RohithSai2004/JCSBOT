import React from 'react';
import { Link } from 'react-router-dom';

const Started = () => {
  return (
    <div className="flex justify-center items-center py-16 px-4 bg-gradient-to-b from-[#f9f9fb] to-white">
      <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-2xl w-full">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">get started</span>
        </h2>
        <p className="text-gray-600 mb-8">
          Join thousands of users already enhancing their productivity with JAI JCS intelligent assistance.
        </p>
        <Link to="/" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-full text-lg transition duration-300">
          Explore JAI JCS Dashboard
        </Link>
      </div>
    </div>
  );
};

export default Started;
