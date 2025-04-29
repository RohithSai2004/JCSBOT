import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { PiUserCircleLight, PiRobotLight } from "react-icons/pi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

const colorStyles = {
  sky: {
    bg: "bg-sky-100/40",
    text: "text-sky-900",
  },
  emerald: {
    bg: "bg-emerald-100/40",
    text: "text-emerald-900",
  },
  violet: {
    bg: "bg-violet-100/40",
    text: "text-violet-900",
  },
  amber: {
    bg: "bg-amber-100/40",
    text: "text-amber-900",
  },
};

const ChatDisplay = ({ messages, isLoading }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-50 to-white font-['Inter']">
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.length === 0 ? (
          <div className="text-center mt-24">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block p-10 bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-200"
            >
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to JCS Assistant
              </h3>
              <p className="text-gray-600 mb-6 text-base">
                Upload your documents or ask questions to get started.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { color: "sky", title: "Summarize Docs", desc: "Quick summaries with insights" },
                  { color: "emerald", title: "Ask Questions", desc: "Instant answers from docs" },
                  { color: "violet", title: "Compare Files", desc: "Smart multi-doc analysis" },
                  { color: "amber", title: "General Knowledge", desc: "Beyond document Q&A" },
                ].map((box, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl font-semibold shadow-md ${colorStyles[box.color].bg} ${colorStyles[box.color].text}`}
                  >
                    <p>{box.title}</p>
                    <p className="text-xs mt-1 text-gray-700 font-normal">{box.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex max-w-[80%] ${msg.isUser ? "flex-row-reverse" : "flex-row"} items-end gap-3`}>
                <div
                  className={`rounded-full p-2 ${
                    msg.isUser ? "bg-sky-100 text-sky-600" : "bg-violet-100 text-violet-600"
                  }`}
                >
                  {msg.isUser ? <PiUserCircleLight size={24} /> : <PiRobotLight size={24} />}
                </div>

                <div
                  className={`p-5 rounded-3xl backdrop-blur-lg ${
                    msg.isUser
                      ? "bg-sky-500/90 text-white rounded-br-none"
                      : "bg-white/90 border border-gray-200 text-gray-800 rounded-bl-none shadow-md"
                  } text-[16px] leading-relaxed`}
                >
                  <ReactMarkdown
                    children={msg.text}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold mt-4 mb-2 flex items-center space-x-2" {...props}>
                          <span>{props.children}</span>
                        </h1>
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-semibold mt-3 mb-2 flex items-center space-x-2" {...props}>
                          <span>{props.children}</span>
                        </h2>
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-medium mt-2 mb-1 flex items-center space-x-2" {...props}>
                          <span>{props.children}</span>
                        </h3>
                      ),
                      p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                      code: ({ node, inline, className, children, ...props }) =>
                        inline ? (
                          <code className="bg-gray-100 px-1.5 py-1 rounded-md text-[14px]" {...props}>
                            {children}
                          </code>
                        ) : (
                          <pre className="bg-gray-900 text-white text-[14px] p-4 rounded-xl overflow-x-auto my-3">
                            <code {...props}>{children}</code>
                          </pre>
                        ),
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 pl-4" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-outside mb-2 pl-6" {...props} />,
                      li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    }}
                  />
                  <div
                    className={`text-[11px] mt-2 ${
                      msg.isUser ? "text-sky-100" : "text-gray-500"
                    } text-right`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex items-end gap-3">
              <div className="rounded-full p-2 bg-violet-100 text-violet-600">
                <PiRobotLight size={24} />
              </div>
              <div className="p-5 bg-white/90 backdrop-blur-lg border border-gray-200 rounded-3xl rounded-bl-none shadow-md">
                <div className="flex space-x-1">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <motion.div
                      key={i}
                      className="w-2.5 h-2.5 bg-gray-400 rounded-full"
                      animate={{ y: [0, -6, 0] }}
                      transition={{
                        duration: 0.7,
                        repeat: Infinity,
                        repeatDelay: 0.2,
                        delay,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatDisplay;
