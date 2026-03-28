import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, User, Bot, Loader2, Paperclip, X, FileText, Languages } from 'lucide-react';
import { getGeminiChat } from '../lib/gemini';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'model';
  text: string;
  translation?: string;
  isTranslating?: boolean;
  file?: {
    name: string;
    type: string;
    data: string; // base64 for images, text for text files
  };
}

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('health_chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string, type: string, data: string } | null>(null);
  const [languageSelectorIndex, setLanguageSelectorIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('health_chat_history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      if (file.type.startsWith('image/')) {
        setSelectedFile({
          name: file.name,
          type: file.type,
          data: data.split(',')[1] // base64 part
        });
      } else {
        // Assume text file
        setSelectedFile({
          name: file.name,
          type: file.type,
          data: data // full text
        });
      }
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleTranslate = async (index: number, targetLanguage: string) => {
    const msg = messages[index];
    if (msg.translation || msg.isTranslating) return;

    setLanguageSelectorIndex(null);
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, isTranslating: true } : m));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Translate the following health-related text to ${targetLanguage}. Return ONLY the translation.\n\nText: ${msg.text}`;
      
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      const translation = result.text;
      
      setMessages(prev => prev.map((m, i) => i === index ? { ...m, translation, isTranslating: false } : m));
    } catch (error) {
      console.error('Translation error:', error);
      setMessages(prev => prev.map((m, i) => i === index ? { ...m, isTranslating: false } : m));
    }
  };

  const LANGUAGES = [
    'English', 'Hindi', 'Punjabi', 'Bengali', 'Marathi', 'Telugu', 
    'Tamil', 'Gujarati', 'Urdu', 'Kannada', 'Odia', 'Malayalam'
  ];

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      text: input,
      file: selectedFile || undefined
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        chatRef.current = getGeminiChat();
      }

      let prompt = input;
      if (userMessage.file) {
        if (userMessage.file.type.startsWith('image/')) {
          // Multimodal message
          // Since chat.sendMessage might not support parts directly in this SDK version's docs,
          // we'll use a trick or just send the text if it's an image.
          // Actually, let's check if we can send parts.
          // If not, we'll use generateContent.
          // For now, let's try sending it as a part if the SDK allows, 
          // but the docs only show string for sendMessage.
          
          // Let's assume we need to use generateContent for multimodal
          // But chat session is better for history.
          // I'll try sending it as a string description if I can't do parts.
          // Wait, I'll update gemini.ts to use generateContent with history.
          
          const response = await chatRef.current.sendMessage({ 
            message: [
              { text: input || "Analyze this health report/image." },
              { inlineData: { data: userMessage.file.data, mimeType: userMessage.file.type } }
            ]
          });
          const botMessage: Message = { role: 'model', text: response.text || 'I am sorry, I could not process that.' };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          // Text file context
          const fullMessage = `Context from file (${userMessage.file.name}):\n${userMessage.file.data}\n\nUser Question: ${input}`;
          const response = await chatRef.current.sendMessage({ message: fullMessage });
          const botMessage: Message = { role: 'model', text: response.text || 'I am sorry, I could not process that.' };
          setMessages((prev) => [...prev, botMessage]);
        }
      } else {
        const response = await chatRef.current.sendMessage({ message: input });
        const botMessage: Message = { role: 'model', text: response.text || 'I am sorry, I could not process that.' };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-white shadow-sm rounded-2xl overflow-hidden border border-stone-100">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="text-center py-10 text-stone-400">
            <Bot className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="serif italic text-lg">How can I help you today?</p>
            <p className="text-xs mt-2 px-10">I can answer health questions, explain symptoms, or summarize your health status.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={cn(
              "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "max-w-[85%] p-3 rounded-2xl",
              msg.role === 'user' 
                ? "bg-primary text-primary-foreground rounded-tr-none" 
                : "bg-secondary text-foreground rounded-tl-none border border-stone-200"
            )}>
              <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] uppercase tracking-wider font-bold">
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                {msg.role === 'user' ? 'You' : 'HealthSync'}
              </div>
              <div className="markdown-body">
                {msg.file && (
                  <div className="mb-2 p-2 bg-black/5 rounded flex items-center gap-2 text-xs">
                    {msg.file.type.startsWith('image/') ? (
                      <img 
                        src={`data:${msg.file.type};base64,${msg.file.data}`} 
                        alt="Attached" 
                        className="w-10 h-10 object-cover rounded"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <FileText size={16} />
                    )}
                    <span className="truncate max-w-[150px]">{msg.file.name}</span>
                  </div>
                )}
                <ReactMarkdown>{msg.text}</ReactMarkdown>
                
                {msg.translation && (
                  <div className="mt-2 pt-2 border-t border-current/10 text-xs italic opacity-80 animate-in fade-in duration-500">
                    <p className="font-bold mb-1 uppercase tracking-tighter opacity-50">Translation</p>
                    {msg.translation}
                  </div>
                )}

                {languageSelectorIndex === i ? (
                  <div className="mt-2 p-2 bg-white/50 border border-stone-200 rounded-xl animate-in zoom-in-95 duration-200">
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-stone-400 mb-2 px-1">Select Language</p>
                    <div className="grid grid-cols-3 gap-1">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang}
                          onClick={() => handleTranslate(i, lang)}
                          className="text-[10px] py-1 px-2 rounded-lg hover:bg-primary hover:text-white transition-colors text-stone-600 border border-stone-100 bg-white"
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setLanguageSelectorIndex(null)}
                      className="w-full mt-2 text-[10px] font-bold uppercase tracking-tighter text-stone-400 hover:text-stone-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setLanguageSelectorIndex(i)}
                    disabled={msg.isTranslating}
                    className={cn(
                      "mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter opacity-40 hover:opacity-100 transition-opacity",
                      msg.translation && "hidden"
                    )}
                  >
                    {msg.isTranslating ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Languages size={10} />
                    )}
                    {msg.isTranslating ? 'Translating...' : 'Translate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-secondary p-3 rounded-2xl rounded-tl-none border border-stone-200">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-stone-100 bg-stone-50/50">
        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 bg-white p-2 rounded-lg border border-stone-200 animate-in fade-in slide-in-from-bottom-1">
            <div className="w-8 h-8 bg-stone-100 rounded flex items-center justify-center text-stone-500">
              {selectedFile.type.startsWith('image/') ? (
                <img 
                  src={`data:${selectedFile.type};base64,${selectedFile.data}`} 
                  alt="Preview" 
                  className="w-full h-full object-cover rounded"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <FileText size={16} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-stone-400 uppercase">{selectedFile.type.split('/')[1]}</p>
            </div>
            <button 
              onClick={() => setSelectedFile(null)}
              className="text-stone-400 hover:text-destructive p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.txt,.pdf,.doc,.docx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-stone-400 hover:text-primary p-2 transition-colors"
            title="Upload health report"
          >
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your health concern..."
            className="flex-1 bg-white border border-stone-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedFile)}
            className="bg-primary text-white p-2.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-all shadow-md flex items-center justify-center min-w-[40px] min-h-[40px]"
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-center mt-2 text-stone-400">
          AI-generated advice. Not a substitute for professional medical care.
        </p>
      </div>
    </div>
  );
};
