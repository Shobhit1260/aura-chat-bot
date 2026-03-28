import { GoogleGenAI, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are HealthSync AI, a professional and compassionate general health consultant. 
Your goal is to provide helpful, accurate, and easy-to-understand health advice. 
Always speak in the user's local language if they address you in it. 
Be empathetic and professional. 
IMPORTANT: Always include a disclaimer that you are an AI and not a substitute for professional medical advice. 
If the user describes an emergency, advise them to call emergency services immediately.
You can summarize conversations for a doctor if requested.`;

export const getGeminiChat = () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const connectLive = (callbacks: any) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai.live.connect({
    model: "gemini-3.1-flash-live-preview",
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};
