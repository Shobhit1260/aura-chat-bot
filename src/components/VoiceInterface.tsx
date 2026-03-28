import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';
import { connectLive } from '../lib/gemini';
import { cn } from '../lib/utils';

export const VoiceInterface: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputTranscription, setInputTranscription] = useState<string>('');
  const [outputTranscription, setOutputTranscription] = useState<string>('');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlaying = useRef(false);

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Setup Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const callbacks = {
        onopen: () => {
          setIsConnected(true);
          setIsConnecting(false);
          startMic();
        },
        onmessage: async (message: any) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
            const base64Data = message.serverContent.modelTurn.parts[0].inlineData.data;
            const binary = atob(base64Data);
            const buffer = new Int16Array(binary.length / 2);
            for (let i = 0; i < buffer.length; i++) {
              buffer[i] = (binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8));
            }
            audioQueue.current.push(buffer);
            if (!isPlaying.current) playNextInQueue();
          }
          
          if (message.serverContent?.interrupted) {
            audioQueue.current = [];
            isPlaying.current = false;
            setOutputTranscription('');
          }

          if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
            // This might be text if responseModalities included TEXT, 
            // but we use AUDIO only. However, transcriptions come in separate fields.
          }

          if (message.serverContent?.outputAudioTranscription) {
            setOutputTranscription(message.serverContent.outputAudioTranscription.text);
          }

          if (message.serverContent?.inputAudioTranscription) {
            setInputTranscription(message.serverContent.inputAudioTranscription.text);
          }
        },
        onerror: (err: any) => {
          console.error('Live error:', err);
          setError('Connection error. Please try again.');
          stopSession();
        },
        onclose: () => {
          setIsConnected(false);
          stopSession();
        }
      };

      sessionRef.current = await connectLive(callbacks);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Could not connect to voice service.');
      setIsConnecting(false);
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(audioContextRef.current!.destination);
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      setError('Microphone access denied.');
    }
  };

  const playNextInQueue = async () => {
    if (audioQueue.current.length === 0 || !audioContextRef.current) {
      isPlaying.current = false;
      return;
    }

    isPlaying.current = true;
    const pcmData = audioQueue.current.shift()!;
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }

    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => playNextInQueue();
    source.start();
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsConnecting(false);
    setInputTranscription('');
    setOutputTranscription('');
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8 bg-white shadow-sm rounded-2xl border border-stone-100">
      <div className="relative">
        <div className={cn(
          "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
          isConnected ? "bg-primary shadow-lg shadow-primary/20 scale-110" : "bg-stone-100",
          isRecording && isConnected && "animate-pulse"
        )}>
          {isConnected ? (
            <Volume2 className="w-12 h-12 text-white" />
          ) : (
            <Mic className="w-12 h-12 text-stone-300" />
          )}
        </div>
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-40 h-40 text-primary animate-spin opacity-20" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="serif text-2xl font-medium">
          {isConnected ? "Listening..." : "Voice Consultation"}
        </h2>
        <p className="text-stone-500 text-sm max-w-xs mx-auto">
          {isConnected 
            ? "Speak naturally. I can understand your health concerns in your local language." 
            : "Connect to start a real-time voice conversation with our health consultant."}
        </p>
      </div>

      {isConnected && (inputTranscription || outputTranscription) && (
        <div className="w-full max-w-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-100 text-left space-y-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-stone-400">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Real-time Translation
            </div>
            
            {inputTranscription && (
              <div className="space-y-1">
                <p className="text-[10px] text-stone-400 uppercase font-bold">You</p>
                <p className="text-sm text-stone-600 italic">"{inputTranscription}"</p>
              </div>
            )}
            
            {outputTranscription && (
              <div className="space-y-1">
                <p className="text-[10px] text-primary uppercase font-bold">HealthSync</p>
                <p className="text-sm text-stone-800 font-medium leading-relaxed">{outputTranscription}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 px-4 py-2 rounded-full">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <button
        onClick={isConnected ? stopSession : startSession}
        disabled={isConnecting}
        className={cn(
          "px-8 py-3 rounded-full font-medium transition-all shadow-md flex items-center gap-2",
          isConnected 
            ? "bg-stone-100 text-stone-600 hover:bg-stone-200" 
            : "bg-primary text-white hover:opacity-90 active:scale-95"
        )}
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : isConnected ? (
          <>
            <MicOff size={18} />
            End Session
          </>
        ) : (
          <>
            <Mic size={18} />
            Start Voice Chat
          </>
        )}
      </button>

      <div className="pt-4">
        <div className="flex items-center justify-center gap-4 text-stone-300">
          <div className={cn("w-1 h-1 rounded-full bg-current", isRecording && "bg-primary")} />
          <div className={cn("w-1 h-1 rounded-full bg-current", isRecording && "bg-primary animate-bounce delay-75")} />
          <div className={cn("w-1 h-1 rounded-full bg-current", isRecording && "bg-primary animate-bounce delay-150")} />
        </div>
      </div>
    </div>
  );
};
