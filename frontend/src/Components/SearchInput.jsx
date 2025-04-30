import React from "react";
import {
  FaMicrophone,
  FaPaperPlane,
  FaPlus,
  FaTrash,
} from "react-icons/fa";
import {
  BsFileEarmarkText,
  BsFileEarmarkPdf,
  BsFileEarmarkImage,
} from "react-icons/bs";

const SearchInput = ({
  query,
  setQuery,
  handleSubmit,
  isLoading,
  uploadedFiles,
  handleFileUploadClick,
  fileInputRef,
  handleFileChange,
  removeFile,
  selectedTask,
  setSelectedTask,
  setUploadedFiles,
  clearConversation,
  messages,
}) => {
  const getFileIcon = (fileType) => {
    if (fileType.includes("pdf")) return <BsFileEarmarkPdf className="text-red-500" />;
    if (fileType.includes("image")) return <BsFileEarmarkImage className="text-blue-500" />;
    return <BsFileEarmarkText className="text-gray-500" />;
  };

  return (
    <div className="w-4/6 p-4 sticky bottom-0 dark:bg-gray-900 dark:border-gray-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Task Selection */}
        {uploadedFiles.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="file Q&A">Ask about document</option>
              <option value="summarization">Summarize document</option>
              {uploadedFiles.length > 1 && (
                <option value="comparison">Compare documents</option>
              )}
              <option value="data analysis and forecast">Analyze data</option>
            </select>
            <button
              onClick={() => setUploadedFiles([])}
              className="text-sm text-red-500 hover:text-red-700 transition flex items-center gap-1"
            >
              <FaTrash size={12} /> Clear files
            </button>
          </div>
        )}

        {/* File Previews */}
        {uploadedFiles.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex-shrink-0 border rounded-xl px-3 py-2 bg-white shadow-md flex items-center gap-2 min-w-[160px] transition hover:shadow-lg dark:bg-gray-800 dark:border-gray-700"
              >
                <div className="p-2 bg-gray-100 rounded-full dark:bg-gray-700">
                  {getFileIcon(file.type)}
                </div>
                <div className="text-sm max-w-[120px] truncate dark:text-white">
                  {file.name}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500 transition ml-1"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmedQuery = query.trim();
            const effectiveQuery =
              !trimmedQuery && selectedTask === "summarization"
                ? "Summarize the uploaded document"
                : trimmedQuery;
            if (!effectiveQuery) return;
            await handleSubmit(effectiveQuery);
            setQuery("");
          }}
          className="relative"
        >
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm overflow-hidden transition-all duration-200 max-w-3xl mx-auto">
            <button
              type="button"
              onClick={handleFileUploadClick}
              className="p-3 text-gray-500 hover:text-blue-600 transition"
              disabled={isLoading}
            >
              <FaPlus />
            </button>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
              accept=".pdf,.txt,.docx,.jpg,.jpeg,.png"
            />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                uploadedFiles.length > 0
                  ? selectedTask === "summarization"
                    ? "Add specific instructions for summarization..."
                    : "Ask about the document..."
                  : "Ask anything or upload documents..."
              }
              className="flex-1 px-4 py-3 bg-transparent outline-none dark:text-white"
              disabled={isLoading}
            />

            <div className="flex items-center pr-2 gap-2">
              <button
                type="button"
                className="p-2 text-gray-500 hover:text-blue-600 transition"
                disabled={isLoading}
              >
                <FaMicrophone />
              </button>
              <button
                type="submit"
                className={`p-2 rounded-full transition ${
                  isLoading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="animate-spin h-4 w-4 border-2 border-t-transparent border-white rounded-full"></div>
                ) : (
                  <FaPaperPlane />
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Clear conversation button */}
        {messages.length > 0 && (
          <div className="flex justify-center mt-3">
            <button
              onClick={clearConversation}
              className="text-sm text-gray-500 hover:text-gray-700 transition flex items-center gap-1 dark:text-gray-400 dark:hover:text-white"
            >
              <FaTrash size={12} /> Clear conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchInput;