import React, { useRef, useState } from "react";
import { FaMicrophone, FaArrowUp, FaPlus, FaFileAlt } from "react-icons/fa";

const Searchbar = () => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    // Add user message (right side)
    setMessages((prev) => [...prev, { text: query, isUser: true }]);
    setQuery("");
    
    // Simulate AI response after a short delay (left side)
    setTimeout(() => {
      setMessages((prev) => [...prev, { text: "This is a simulated AI response to: " + query, isUser: false }]);
    }, 500);
  };

  const handleFileUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({
      name: file.name,
      url: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
      type: file.type,
    }));
    setUploadedFiles((prev) => [...prev, ...previews]);
    files.forEach((file) =>
      setMessages((prev) => [...prev, { text: `📁 Uploaded: ${file.name}`, isUser: true }])
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Messages Display Area */}
      <div className="flex-1 overflow-y-auto p-4 pt-20">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`p-4 rounded-xl shadow-sm max-w-[80%] ${
                  msg.isUser 
                    ? 'bg-blue-100 rounded-br-none' 
                    : 'bg-gray-100 rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search Bar - centered */}
      <div className="w-full p-4 sticky bottom-5 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4 p-4 rounded-3xl border border-gray-300 shadow-xl bg-white">
            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 px-4 py-2 bg-transparent outline-none"
              />
            </form>

            {/* Icons Row */}
            <div className="flex justify-between items-center">
              {/* Left: Plus Button */}
              <div>
                <button
                  type="button"
                  onClick={handleFileUploadClick}
                  className="rounded-full p-3 bg-gray-100 hover:bg-gray-200 shadow"
                >
                  <FaPlus className="w-4 h-4 text-gray-700" />
                </button>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Right: Mic + Send Button */}
              <div className="flex gap-2">
                <button className="rounded-full p-3 bg-gray-100 hover:bg-gray-200 shadow">
                  <FaMicrophone className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={handleSubmit}
                  className="rounded-full p-3 bg-blue-600 text-white hover:bg-blue-700 shadow"
                >
                  <FaArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* File Previews */}
            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="border rounded-xl p-2 bg-gray-50 shadow-sm flex items-center justify-center"
                  >
                    {file.url ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="max-h-24 object-contain rounded-md"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <FaFileAlt className="text-xl" />
                        <span>{file.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Searchbar;