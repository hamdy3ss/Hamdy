import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AudioRecorder, AudioPlayer } from '../lib/audio';
import { Mic, MicOff, Globe, Volume2, MessageSquare, Loader2, Activity, ExternalLink, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import zoomSdk from '@zoom/appssdk';

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Message = {
  id: string;
  sender: 'user' | 'translator';
  text: string;
};

const LANGUAGES = [
  'Arabic (Modern Standard)',
  'Arabic (Egyptian)',
  'Arabic (Saudi/Gulf)',
  'Arabic (Levantine/Syrian/Lebanese)',
  'Arabic (Moroccan/Maghrebi)',
  'Arabic (Iraqi)',
  'Arabic (Sudanese)',
  'English',
  'French',
  'Spanish',
  'German',
  'Chinese (Mandarin)',
  'Japanese',
  'Russian',
  'Hindi',
  'Italian',
  'Turkish'
];

export default function MeetingTranslator() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lang1, setLang1] = useState('Arabic (Egyptian)');
  const [lang2, setLang2] = useState('English');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isZoomApp, setIsZoomApp] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Attempt to initialize Zoom SDK
    const initZoom = async () => {
      try {
        await zoomSdk.config({
          capabilities: [
            'getRunningContext',
            'onMessage'
          ]
        });
        const context = await zoomSdk.getRunningContext();
        if (context) {
          setIsZoomApp(true);
        }
      } catch (err) {
        // Not running inside Zoom or config failed
        console.log('Not running inside Zoom client.');
      }
    };
    initZoom();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startMeeting = async () => {
    try {
      setError(null);
      setIsConnecting(true);
      
      playerRef.current = new AudioPlayer();
      playerRef.current.start();

      recorderRef.current = new AudioRecorder((base64, sampleRate) => {
        if (sessionRef.current) {
          sessionRef.current.then((session: any) => {
            session.sendRealtimeInput({
              audio: {
                mimeType: `audio/pcm;rate=${sampleRate}`,
                data: base64
              }
            });
          }).catch(() => {});
        }
      });
      await recorderRef.current.start();

      let sessionPromise;
      try {
        sessionPromise = getAI().live.connect({
          model: "gemini-2.5-flash-native-audio-preview-12-2025",
          callbacks: {
            onmessage: async (message: LiveServerMessage) => {
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio && playerRef.current) {
                playerRef.current.playBase64(base64Audio);
              }

              const parts = message.serverContent?.modelTurn?.parts;
              if (parts) {
                let textContent = '';
                for (const part of parts) {
                  if (part.text) {
                    textContent += part.text;
                  }
                }
                if (textContent.trim()) {
                  setMessages(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    sender: 'translator',
                    text: textContent.trim()
                  }]);
                }
              }
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
              setError("حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.");
              stopMeeting();
            },
            onclose: () => {
              stopMeeting();
            }
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
            },
            systemInstruction: `You are a highly skilled simultaneous interpreter for a meeting. Translate the conversation between ${lang1} and ${lang2}. If you hear ${lang1}, translate it to ${lang2}. If you hear ${lang2}, translate it to ${lang1}. Pay special attention to the specific Arabic dialect selected (e.g., Egyptian, Levantine, Gulf, Maghrebi, Iraqi, etc.) and translate it accurately. Do not answer questions, do not add conversational filler, ONLY output the translation.`
          }
        });
      } catch (err: any) {
        console.error("Live API Sync Error:", err);
        setError(`فشل الاتصال: ${err?.message || 'تأكد من اتصالك بالإنترنت'}`);
        stopMeeting();
        return;
      }

      sessionRef.current = sessionPromise;

      sessionPromise.catch(err => {
        console.error("Live API Connect Error:", err);
        setError(`فشل الاتصال: ${err?.message || 'تأكد من اتصالك بالإنترنت'}`);
        stopMeeting();
      });

      await sessionPromise;
      setIsRecording(true);
      setIsConnecting(false);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "فشل بدء الترجمة. يرجى التحقق من صلاحيات الميكروفون.");
      stopMeeting();
    }
  };

  const stopMeeting = () => {
    setIsRecording(false);
    setIsConnecting(false);
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(() => {});
      sessionRef.current = null;
    }
  };

  const openZoomSidebar = () => {
    // Opens the app in a compact popup window suitable for placing next to Zoom
    window.open(
      window.location.href,
      'ZoomTranslator',
      'width=400,height=800,menubar=no,toolbar=no,location=no,status=no'
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-3 md:p-8 h-screen flex flex-col relative z-10">
      <header className="flex items-center justify-between mb-6 md:mb-8">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center neon-border-active shrink-0">
            <Globe className="w-5 h-5 md:w-7 md:h-7 text-[#00f0ff]" />
          </div>
          <div>
            <h1 className="text-xl md:text-4xl font-extrabold tracking-tight neon-text">المترجم الفوري</h1>
            <p className="text-xs md:text-base text-cyan-500/70 font-semibold mt-1 hidden sm:block">
              ترجمة اجتماعات مباشرة مدعومة بالذكاء الاصطناعي
              {isZoomApp && <span className="ml-2 inline-flex items-center gap-1 text-emerald-400"><Video className="w-3 h-3" /> متصل بـ Zoom</span>}
            </p>
          </div>
        </div>
        
        {!isZoomApp && (
          <button 
            onClick={openZoomSidebar}
            className="flex items-center gap-2 text-xs md:text-sm font-bold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border border-cyan-500/30 transition-all shadow-[0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            title="فتح كنافذة جانبية لبرنامج Zoom"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">نافذة لـ Zoom</span>
          </button>
        )}
      </header>

      <div className="glass-panel rounded-2xl md:rounded-3xl p-4 md:p-6 mb-4 md:mb-6 flex flex-col md:flex-row gap-4 md:gap-5 items-center justify-between neon-border">
        <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full md:w-auto">
          <select 
            value={lang1}
            onChange={(e) => setLang1(e.target.value)}
            disabled={isRecording || isConnecting}
            className="w-full sm:w-auto md:w-64 bg-[#050b14]/80 border border-cyan-500/30 rounded-xl px-3 py-2.5 md:px-4 md:py-3.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:opacity-50 transition-all shadow-inner"
            dir="ltr"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.1)] shrink-0 rotate-90 sm:rotate-0">
            <span className="text-cyan-400 font-bold text-base md:text-lg">↔</span>
          </div>

          <select 
            value={lang2}
            onChange={(e) => setLang2(e.target.value)}
            disabled={isRecording || isConnecting}
            className="w-full sm:w-auto md:w-64 bg-[#050b14]/80 border border-cyan-500/30 rounded-xl px-3 py-2.5 md:px-4 md:py-3.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:opacity-50 transition-all shadow-inner"
            dir="ltr"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <button
          onClick={isRecording ? stopMeeting : startMeeting}
          disabled={isConnecting}
          className={`flex items-center justify-center gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-base transition-all duration-300 w-full md:w-auto ${
            isRecording 
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/50 hover:bg-rose-500/20 hover:shadow-[0_0_25px_rgba(244,63,94,0.4)]' 
              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/20 hover:shadow-[0_0_25px_rgba(0,240,255,0.4)]'
          } disabled:opacity-50 disabled:hover:shadow-none`}
        >
          {isConnecting ? (
            <><Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> جاري الاتصال...</>
          ) : isRecording ? (
            <><MicOff className="w-4 h-4 md:w-5 md:h-5" /> إيقاف الترجمة</>
          ) : (
            <><Mic className="w-4 h-4 md:w-5 md:h-5" /> بدء الترجمة</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 text-rose-400 p-3 md:p-4 rounded-xl md:rounded-2xl mb-4 md:mb-6 text-xs md:text-sm font-bold border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 glass-panel rounded-2xl md:rounded-3xl overflow-hidden flex flex-col neon-border relative">
        <div className="p-3 md:p-5 border-b border-cyan-500/20 bg-[#050b14]/60 flex items-center justify-between z-10 backdrop-blur-xl">
          <h2 className="text-xs md:text-sm font-bold text-cyan-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" /> النص المترجم
          </h2>
          {isRecording && (
            <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold text-cyan-300 bg-cyan-950/60 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <Activity className="w-3 h-3 md:w-4 md:h-4 animate-pulse text-cyan-400" />
              <span className="hidden sm:inline">جاري الاستماع والترجمة...</span>
              <span className="sm:hidden">جاري الترجمة...</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 z-10 relative">
          {messages.length === 0 && !isRecording && (
            <div className="h-full flex flex-col items-center justify-center text-cyan-500/40 space-y-4 md:space-y-6">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full neon-border flex items-center justify-center bg-[#050b14]/50 shadow-[0_0_30px_rgba(0,240,255,0.05)]">
                <Volume2 className="w-8 h-8 md:w-10 md:h-10 text-cyan-500/50" />
              </div>
              <p className="text-sm md:text-base font-bold tracking-wide text-center px-4">ابدأ الترجمة وتحدث الآن...</p>
            </div>
          )}
          
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id}
                className="flex flex-col gap-1.5 md:gap-2"
              >
                <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                  <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                    <Globe className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-[10px] md:text-[12px] font-bold text-cyan-500/80 uppercase tracking-wider">ترجمة</span>
                </div>
                <div className="bg-[#0a1224]/90 border border-cyan-500/30 rounded-xl md:rounded-2xl rounded-tr-none p-3 md:p-5 text-cyan-50 text-sm md:text-base leading-relaxed shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-md">
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
        
        {/* Decorative background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-cyan-500/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
      </div>
    </div>
  );
}
