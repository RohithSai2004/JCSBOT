import React from 'react';
import ToolImage from '../../Assets/L1.avif';
import { Link } from 'react-router-dom';


const L1 = () => {
  return (
    <section className="w-full bg-gradient-to-br from-white to-blue-100 py-10 px-6 md:px-10">
      <div className="max-w-6xl mx-auto flex flex-col-reverse md:flex-row items-center gap-10">

        {/* Left: Content */}
        <div className="w-full md:w-1/2 space-y-6 text-center md:text-left">
          <h1 className="text-5xl font-extrabold text-blue-700 leading-snug">
            Explore Our <span className="text-gray-800">Generative AI Tool</span>
          </h1>

          <p className="text-lg text-gray-700 leading-relaxed">
            Unlock new levels of efficiency and creativity with our smart assistant, powered by advanced Generative AI technology – your partner for automation, development, and smart analysis.
          </p>


          <div className="pt-6 flex flex-wrap justify-center md:justify-start gap-4">
            <Link to="/dashboard" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition duration-300">
              Start Exploring
            </Link>
            <Link to="/about" className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-100 transition duration-300">
              Learn More
            </Link>
          </div>
        </div>

        {/* Right: Image */}
        <div className="w-full md:w-1/2">
          <div className="rounded-3xl overflow-hidden shadow-xl h-[300px] md:h-[350px]">
            <img
              src={ToolImage}
              alt="Generative AI Tool"
              className="w-full h-full object-cover transition-transform duration-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default L1;