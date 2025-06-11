import React from 'react';
import { motion } from 'framer-motion';
import { AiOutlineQuestionCircle, AiOutlineCode, AiOutlineFileSearch } from 'react-icons/ai';
import { FiCpu, FiFileText } from 'react-icons/fi';

const capabilitiesData = [
  {
    title: "Basic Q&A",
    description: "Ask general questions and get accurate, intelligent responses instantly.",
    icon: <AiOutlineQuestionCircle className="h-8 w-8 text-purple-600" />,
  },
  {
    title: "Document Summary & Q/A (OCR)",
    description: "Summarize scanned or uploaded documents and extract key information using OCR.",
    icon: <AiOutlineFileSearch className="h-8 w-8 text-blue-600" />,
  },
  {
    title: "Advanced Intelligence and Analysis",
    description: "Gain deep insights through intelligent analysis for better decision-making.",
    icon: <FiCpu className="h-8 w-8 text-indigo-600" />,
  },
  {
    title: "Code Audit",
    description: "Analyze code quality, find bugs, and validate syntax with precision.",
    icon: <FiFileText className="h-8 w-8 text-green-600" />,
  },
  {
    title: "Code Generation",
    description: "Generate code snippets or programs in Java, .NET, Python, and more.",
    icon: <AiOutlineCode className="h-8 w-8 text-emerald-600" />,
  },
];

const Capabilities = () => {
  return (
    <section className="bg-gradient-to-b from-white via-gray-50 to-white py-20 px-6 sm:px-10 lg:px-20">
      <div className="max-w-7xl mx-auto text-center">
        <motion.h2
          className="text-4xl sm:text-5xl font-extrabold mb-4"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Powerful <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Capabilities</span>
        </motion.h2>

        <motion.p
          className="text-gray-600 mb-14 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Unlock the full potential of JAi JCS smart tools to streamline your workflow and boost productivity.
        </motion.p>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {capabilitiesData.map((cap, index) => (
            <motion.div
              key={index}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col items-start text-left"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <div className="mb-4">{cap.icon}</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{cap.title}</h3>
              <p className="text-gray-600">{cap.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Capabilities;