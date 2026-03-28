import React, { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { VoiceInterface } from './components/VoiceInterface';
import { MessageSquare, Mic, Heart, ClipboardList, Info } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'chat' | 'voice' | 'summary';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <div className="min-h-screen bg-[#fdfcfb] flex flex-col max-w-md mx-auto relative shadow-2xl">
      {/* Header */}
      <header className="p-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Heart size={18} fill="currentColor" />
            </div>
            <h1 className="serif text-2xl font-semibold tracking-tight">HealthSync</h1>
          </div>
          <button className="text-stone-400 hover:text-primary transition-colors">
            <Info size={20} />
          </button>
        </div>
        <p className="text-xs text-stone-500 font-medium uppercase tracking-widest">General AI Consultant</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-4 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'chat' && <ChatInterface />}
            {activeTab === 'voice' && <VoiceInterface />}
            {activeTab === 'summary' && (
              <div className="h-full bg-white rounded-2xl p-6 border border-stone-100 shadow-sm overflow-y-auto">
                <h2 className="serif text-xl font-medium mb-4">Doctor Summary</h2>
                <div className="space-y-4 text-sm text-stone-600">
                  <p>This feature generates a concise summary of your recent health discussions to share with your healthcare provider.</p>
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 italic">
                    "Patient discussed mild fatigue and requested information about vitamin D levels. No acute symptoms reported."
                  </div>
                  <button 
                    onClick={() => alert('Summary generated based on local history.')}
                    className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:opacity-90 transition-all"
                  >
                    Generate Full Summary
                  </button>
                  <p className="text-[10px] text-stone-400 text-center">
                    Summaries are generated from your local chat history only.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-stone-100 p-4 pb-8 flex justify-around items-center">
        <NavButton 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')}
          icon={<MessageSquare size={20} />}
          label="Chat"
        />
        <NavButton 
          active={activeTab === 'voice'} 
          onClick={() => setActiveTab('voice')}
          icon={<Mic size={20} />}
          label="Voice"
        />
        <NavButton 
          active={activeTab === 'summary'} 
          onClick={() => setActiveTab('summary')}
          icon={<ClipboardList size={20} />}
          label="Doctor"
        />
      </nav>

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300",
        active ? "text-primary scale-110" : "text-stone-400 hover:text-stone-600"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all",
        active ? "bg-primary/10" : "bg-transparent"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
