import React from 'react';

const Work = () => {
  return (
    <section className="bg-white py-16 px-4">
      <div className="max-w-7xl mx-auto text-center">
        {/* Heading */}
        <h2 className="text-4xl font-extrabold mb-4">
          How <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">It Works</span>
        </h2>
        <p className="text-gray-600 mb-16 max-w-3xl mx-auto">
          Getting started with JAI JCS is simple and intuitive, designed to fit seamlessly into your workflow.
        </p>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Step 1 */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-lg mb-4">
              1
            </div>
            <h3 className="text-xl font-semibold mb-2">Choose a Tool</h3>
            <p className="text-gray-600 text-center max-w-xs">
              Select the JAI tool that best fits your current needs from the dashboard.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-lg mb-4">
              2
            </div>
            <h3 className="text-xl font-semibold mb-2">Provide Input</h3>
            <p className="text-gray-600 text-center max-w-xs">
              Enter your query, data, or content requirements in the intuitive interface.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-lg mb-4">
              3
            </div>
            <h3 className="text-xl font-semibold mb-2">Get Results</h3>
            <p className="text-gray-600 text-center max-w-xs">
              Review and use JAI's intelligent output tailored to your specific needs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Work;
