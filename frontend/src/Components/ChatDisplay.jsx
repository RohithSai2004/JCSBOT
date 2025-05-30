// frontend/src/Components/ChatDisplay.jsx
import React, { useRef, useEffect, useState, Children } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bot, FileArchive, ImageIcon, FileText as FileTextIcon, Zap, ClipboardCopy, Check, MessageSquare, Edit3, SearchCode } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css"; // Keep a good dark theme for code blocks

const FileIcon = React.memo(({ fileType }) => {
  if (fileType.includes("pdf")) return <FileArchive className="text-red-500 dark:text-red-400" size={18} />;
  if (fileType.includes("image")) return <ImageIcon className="text-blue-500 dark:text-blue-400" size={18} />;
  return <FileTextIcon className="text-light-muted-foreground dark:text-dark-muted-foreground" size={18} />;
});

const FileAttachment = React.memo(({ file }) => (
  <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-light-muted dark:bg-dark-muted/30 rounded-lg border border-light-border dark:border-dark-border max-w-xs shadow-sm">
    <FileIcon fileType={file.type} />
    <span className="text-xs text-light-muted-foreground dark:text-dark-muted-foreground truncate" title={file.name}>
      {file.name}
    </span>
  </div>
));

const PreWithCopyButton = ({ node, children, className: inheritedClassName, ...props }) => {
  // ... (PreWithCopyButton code from previous response, ID: chat_display_enhanced_v2 - it's good)
  const [copied, setCopied] = useState(false);
  const preRef = useRef(null);

  const extractTextContent = (elements) => {
    let text = '';
    Children.forEach(elements, (child) => {
      if (typeof child === 'string') {
        text += child;
      } else if (React.isValidElement(child) && child.props.children) {
        text += extractTextContent(child.props.children);
      }
    });
    return text;
  };
  
  const textToCopy = preRef.current ? preRef.current.textContent : extractTextContent(children);

  const handleCopy = async () => {
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, trying execCommand: ', err);
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed"; 
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else { console.error('Fallback execCommand failed'); }
      } catch (execErr) { console.error('Fallback execCommand error: ', execErr); }
      document.body.removeChild(textArea);
    }
  };
  
  return (
    <div className="relative group my-3"> {/* prose-pre styles are handled by the main prose wrapper */}
      <pre 
        ref={preRef} 
        {...props} 
        className={`${inheritedClassName} p-4 rounded-lg overflow-x-auto bg-slate-100 dark:bg-neutral-800 text-sm custom-scrollbar`}
      >
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 p-1.5 bg-white/70 dark:bg-neutral-700/70 text-slate-600 dark:text-neutral-300 hover:text-light-primary dark:hover:text-dark-primary rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150 ease-in-out z-10 border border-slate-300 dark:border-neutral-600 hover:border-light-primary/50 dark:hover:border-dark-primary/50"
        aria-label="Copy code"
      >
        {copied ? <Check size={16} className="text-green-500" /> : <ClipboardCopy size={16} />}
      </button>
    </div>
  );
};


const ChatDisplay = ({ messages, isLoading, onPromptSuggestionClick }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messages.length) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const renderMessageContent = (msg) => {
    const isErrorMessage = typeof msg.text === 'string' && msg.text.toLowerCase().startsWith("error:");
    return (
    <>
      <div
        className={`prose prose-sm max-w-none dark:prose-invert 
                   ${isErrorMessage ? 'prose-p:text-light-destructive dark:prose-p:text-dark-destructive' : ''}`}
      >
        <ReactMarkdown
          children={msg.text}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            pre: PreWithCopyButton,
            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="break-words" />
          }}
        />
      </div>
      {msg.files && msg.files.length > 0 && ( <div className="mt-3 space-y-2"> {msg.files.map((file, fileIndex) => ( <FileAttachment key={fileIndex} file={file} /> ))} </div> )}
      {msg.isStreaming && ( <div className="flex space-x-1 mt-2 items-center"> <motion.div className="w-1.5 h-1.5 bg-light-muted-foreground dark:bg-dark-muted-foreground rounded-full" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} /> <motion.div className="w-1.5 h-1.5 bg-light-muted-foreground dark:bg-dark-muted-foreground rounded-full" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }} /> <motion.div className="w-1.5 h-1.5 bg-light-muted-foreground dark:bg-dark-muted-foreground rounded-full" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} /> </div> )}
      <div className={`text-[11px] mt-2 ${msg.isUser ? "text-light-primary-foreground/70 dark:text-dark-primary-foreground/70" : "text-light-muted-foreground dark:text-dark-muted-foreground"} text-right`}>
        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </>
   );
  };

  const welcomePrompts = [
    { title: "Summarize the doc", desc: "Get key insights quickly.", icon: <FileTextIcon size={20} /> },
    { title: "Chat with document(s)", desc: "Ask specific questions.", icon: <SearchCode size={20} /> },
    { title: "General chat", desc: "Explore ideas & topics.", icon: <MessageSquare size={20} /> },
    { title: "Draft an email", desc: "For project updates.", icon: <Edit3 size={20} /> },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 custom-scrollbar bg-transparent">
      <div className="max-w-3xl mx-auto space-y-5">
        {messages.length === 0 && !isLoading ? (
          <div className="text-center pt-10 sm:pt-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 100 }}
              className="inline-block"
            >
              <div className="mb-10 text-center">
                <motion.h1
                    className="text-5xl sm:text-6xl font-extrabold text-transparent bg-clip-text 
                               bg-text-gradient-light dark:bg-text-gradient-dark 
                               block" // Removed animate-pulse-subtle for direct visibility
                    initial={{ opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.3, duration: 0.5}}
                >
                  Hello, I'm JA<span className="lowercase">i</span>
                </motion.h1>
                <motion.p 
                    className="text-xl sm:text-2xl text-light-muted-foreground dark:text-dark-muted-foreground mt-3"
                    initial={{ opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.5, duration: 0.5}}
                >
                    How can I help you today?
                </motion.p>
              </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-left">
                {welcomePrompts.map((prompt, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
                    className="p-4 card hover:border-light-primary dark:hover:border-dark-primary hover:bg-light-muted/30 dark:hover:bg-dark-muted/30 transition-all duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-light-ring dark:focus-visible:ring-dark-ring text-left group hover:shadow-lg"
                    onClick={() => onPromptSuggestionClick && onPromptSuggestionClick(prompt.title + (prompt.desc.startsWith("Get") ? "" : " " + prompt.desc))}
                  >
                    <div className="flex items-center gap-3.5">
                        <div className={`p-2 rounded-full group-hover:bg-light-primary/10 dark:group-hover:bg-dark-primary/10 transition-colors ${i % 2 === 0 ? 'bg-light-secondary/10 dark:bg-dark-secondary/20' : 'bg-light-accent/5 dark:bg-dark-accent/10'}`}>
                            {React.cloneElement(prompt.icon, {className: `w-5 h-5 transition-colors ${i % 2 === 0 ? 'text-light-secondary dark:text-dark-secondary group-hover:text-light-primary dark:group-hover:text-dark-primary' : 'text-light-accent dark:text-dark-accent group-hover:text-light-primary dark:group-hover:text-dark-primary'}`})}
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-card-foreground dark:text-dark-card-foreground group-hover:text-light-primary dark:group-hover:text-dark-primary transition-colors">{prompt.title}</p>
                            <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-0.5">{prompt.desc}</p>
                        </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id || `msg-${index}`}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: {duration: 0.2} }}
                transition={{ type: "spring", stiffness: 200, damping: 25, duration: 0.3 }}
                className={`flex items-start gap-3 w-full ${msg.isUser ? "justify-end" : "justify-start"}`}
              >
                {!msg.isUser && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-card dark:bg-dark-card flex items-center justify-center mt-0.5 shadow-md border-2 border-light-primary/30 dark:border-dark-primary/30">
                    <Bot size={22} className="text-light-primary dark:text-dark-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] sm:max-w-[70%] p-3.5 rounded-2xl shadow-card-light dark:shadow-card-dark ${
                    msg.isUser
                      ? "bg-gradient-to-br from-light-primary to-light-primary-dark dark:from-dark-primary dark:to-dark-primary-dark text-white rounded-br-lg"
                      : "bg-card dark:bg-dark-card text-card-foreground dark:text-dark-card-foreground rounded-bl-lg border border-border dark:border-dark-border"
                  }`}
                >
                  {renderMessageContent(msg)}
                </div>
                {msg.isUser && (
                   <div className="flex-shrink-0 w-10 h-10 rounded-full bg-light-accent dark:bg-dark-accent text-white flex items-center justify-center mt-0.5 shadow-md">
                    <User size={20} />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {isLoading && messages.length === 0 && (
             <div className="flex justify-center items-center py-10">
                <motion.div className="w-8 h-8 border-4 border-light-primary dark:border-dark-primary border-t-transparent rounded-full animate-spin" />
                <p className="ml-3 text-muted-foreground dark:text-dark-muted-foreground">Loading chat...</p>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatDisplay;
