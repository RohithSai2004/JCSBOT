// frontend/src/Components/SearchInput.jsx
import React, { useCallback, useMemo, useRef } from "react";
import {
  Send,
  PlusCircle,
  Trash2,
  FileText,
  FileArchive,
  Image as ImageIcon,
  XCircle,
  ChevronDown,
} from "lucide-react";

const FileTypeIcon = React.memo(({ fileType }) => {
  if (fileType.includes("pdf")) return <FileArchive className="text-red-500 dark:text-red-400" size={20} />;
  if (fileType.includes("image")) return <ImageIcon className="text-blue-500 dark:text-blue-400" size={20} />;
  return <FileText className="text-muted-foreground dark:text-dark-muted-foreground" size={20} />;
});

const FilePreviewItem = React.memo(({ file, index, removeFile }) => (
  <div
    className="flex-shrink-0 border border-border dark:border-dark-border rounded-lg px-3 py-2 bg-card dark:bg-dark-card shadow-sm flex items-center gap-2.5 min-w-[160px] transition-all hover:shadow-md hover:border-primary dark:hover:border-dark-primary"
  >
    <FileTypeIcon fileType={file.type} />
    <div className="text-xs text-card-foreground dark:text-dark-card-foreground max-w-[100px] truncate" title={file.name}>
      {file.name}
    </div>
    <button
      onClick={() => removeFile(index)}
      className="text-muted-foreground dark:text-dark-muted-foreground hover:text-destructive dark:hover:text-dark-destructive transition-colors ml-auto p-0.5 rounded-full hover:bg-destructive/10 dark:hover:bg-dark-destructive/10"
      aria-label="Remove file"
    >
      <XCircle size={18} />
    </button>
  </div>
));

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

  const handleFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    const effectiveQuery =
      !trimmedQuery && uploadedFiles.length > 0 && selectedTask === "summarization"
        ? "Summarize the uploaded document"
        : trimmedQuery;
    
    if (!effectiveQuery && uploadedFiles.length === 0) return;
    
    setQuery(""); 
    await handleSubmit(effectiveQuery || (uploadedFiles.length > 0 ? `Tell me about the uploaded file(s).` : ""));
  }, [query, selectedTask, uploadedFiles, handleSubmit, setQuery]);

  const handleTaskChange = useCallback((e) => {
    setSelectedTask(e.target.value);
  }, [setSelectedTask]);

  const handleClearFiles = useCallback(() => {
    setUploadedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setUploadedFiles, fileInputRef]);

  const taskOptions = useMemo(() => (
    <>
      <option value="file Q&A">Ask about document(s)</option>
      <option value="summarization">Summarize document(s)</option>
      {uploadedFiles.length > 1 && (
        <option value="comparison">Compare documents</option>
      )}
      <option value="general conversation">General Conversation</option>
    </>
  ), [uploadedFiles.length]);

  const inputPlaceholder = useMemo(() => {
    if (uploadedFiles.length > 0) {
      return selectedTask === "summarization"
        ? "Optional: add specific summarization instructions..."
        : `Ask about ${uploadedFiles.length > 1 ? 'documents' : 'document'} or type a message...`;
    }
    return "Ask anything or drop files...";
  }, [uploadedFiles, selectedTask]);

  const filePreviews = useMemo(() => (
    uploadedFiles.map((file, index) => (
      <FilePreviewItem
        key={`${file.name}-${index}-${file.rawFile?.lastModified || index}`}
        file={file}
        index={index}
        removeFile={removeFile}
      />
    ))
  ), [uploadedFiles, removeFile]);

  const dropZoneRef = useRef(null);
  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const previews = files.map((file) => ({
        name: file.name,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        type: file.type, rawFile: file,
      }));
      setUploadedFiles(prev => [...prev, ...previews]);
      if (files.length > 0 && selectedTask === "general conversation") {
        setSelectedTask(files.length === 1 ? "file Q&A" : "comparison");
      }
      e.dataTransfer.clearData();
    }
  }, [selectedTask, setSelectedTask, setUploadedFiles]);

  return (
    <div 
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="w-full p-3 sm:p-4 sticky bottom-0 bg-background/80 dark:bg-dark-background/80 backdrop-blur-md shadow-2xl"
    >
      <div className="max-w-3xl mx-auto">
        {uploadedFiles.length > 0 && (
          <div className="mb-3 px-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <select
                  value={selectedTask}
                  onChange={handleTaskChange}
                  className="appearance-none pl-3 pr-8 py-2 text-xs rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card text-card-foreground dark:text-dark-card-foreground shadow-sm focus:ring-2 focus:ring-light-ring dark:focus:ring-dark-ring focus:border-transparent outline-none"
                >
                  {taskOptions}
                </select>
                <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-dark-muted-foreground pointer-events-none"/>
              </div>
              <button
                onClick={handleClearFiles}
                className="text-xs text-destructive dark:text-dark-destructive hover:text-red-700 dark:hover:text-rose-400 transition-colors flex items-center gap-1 font-medium"
                aria-label="Clear all uploaded files"
              >
                <Trash2 size={14} /> Clear files
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
              {filePreviews}
            </div>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="relative">
          {/* MAIN INPUT BAR CONTAINER: 
            *** MOST IMPORTANT CHECK FOR VERTICAL LINES ***
            Ensure this 'div' element does NOT have any `divide-x` or `divide-[color]` Tailwind classes in your project.
            Example of problematic classes to remove: `divide-x divide-gray-300 dark:divide-gray-700`
            The classes below are for the overall appearance of the input bar.
          */}
          <div className="flex items-center bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-full shadow-lg overflow-hidden transition-all duration-200 focus-within:ring-2 focus-within:ring-light-ring dark:focus-within:ring-dark-ring focus-within:border-transparent">
            
            {/* UPLOAD BUTTON (+) */}
            <button
              type="button"
              onClick={handleFileUploadClick}
              className="p-2.5 sm:p-3 text-muted-foreground dark:text-dark-muted-foreground hover:text-primary dark:hover:text-dark-primary transition-colors focus:outline-none focus:bg-primary/10 dark:focus:bg-dark-primary/10 rounded-full ml-1.5 border-0" // border-0 to remove any default/inherited borders
              disabled={isLoading}
              aria-label="Upload file"
            >
              <PlusCircle size={22} />
            </button>
            
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
              accept=".pdf,.txt,.docx,.jpg,.jpeg,.png,.csv,.xlsx,.md"
            />

            {/* TEXT INPUT FIELD */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={inputPlaceholder}
              className="flex-1 px-2 sm:px-4 py-3 sm:py-3.5 bg-transparent outline-none text-sm sm:text-base text-foreground dark:text-dark-foreground placeholder:text-muted-foreground dark:placeholder:text-dark-muted-foreground border-0" // border-0 to remove any default/inherited borders
              disabled={isLoading}
            />

            {/* SEND BUTTON AREA */}
            <div className="flex items-center pr-2 sm:pr-2.5 border-0"> {/* border-0 on this wrapper too, just in case */}
              <button
                type="submit"
                className={`p-2 sm:p-2.5 rounded-full transition-all duration-150 ease-in-out focus:outline-none transform active:scale-95 border-0 ${ // border-0 on the button
                  isLoading || (!query.trim() && uploadedFiles.length === 0)
                    ? "bg-muted dark:bg-dark-muted text-muted-foreground dark:text-dark-muted-foreground cursor-not-allowed"
                    : "bg-gradient-to-br from-light-primary to-light-accent dark:from-dark-primary dark:to-dark-accent text-white hover:shadow-lg dark:hover:shadow-dark-primary/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-light-ring dark:focus-visible:ring-dark-ring focus-visible:ring-offset-card dark:focus-visible:ring-offset-dark-card"
                }`}
                disabled={isLoading || (!query.trim() && uploadedFiles.length === 0)}
                aria-label="Send message"
              >
                {isLoading ? (
                  <div className="animate-spin h-5 w-5 border-2 border-t-transparent border-current rounded-full"></div>
                ) : (
                  <Send size={18} className="sm:h-5 sm:w-5"/>
                )}
              </button>
            </div>
          </div>
        </form>

        {messages && messages.length > 0 && (
          <div className="flex justify-center mt-2.5">
            <button
              onClick={clearConversation}
              className="text-xs text-muted-foreground dark:text-dark-muted-foreground hover:text-destructive dark:hover:text-dark-destructive transition-colors flex items-center gap-1 font-medium"
              aria-label="Clear conversation"
            >
              <Trash2 size={13} /> Clear conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SearchInput);
