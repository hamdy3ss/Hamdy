import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Mic, Send, BookOpen, User, Bot, Loader2, Volume2, Square, Phone, PhoneOff, Radio, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TeacherAvatar from './TeacherAvatar';
import RocketGame from './RocketGame';

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

const VOICES = [
  { id: 'Zephyr', name: 'أستاذ زفير (عصبي جداً)' },
  { id: 'Puck', name: 'أستاذ بك (ساخر ومستفز)' },
  { id: 'Charon', name: 'أستاذ شارون (جد وحازم)' },
  { id: 'Kore', name: 'أبلة كوري (شديدة بس حنينة)' },
  { id: 'Fenrir', name: 'أستاذ فنرير (صوته عالي)' }
];

type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  isAudio?: boolean;
  isPlaying?: boolean;
};

export default function LanguageTutor() {
  const [nativeLang, setNativeLang] = useState('Arabic (Egyptian)');
  const [targetLang, setTargetLang] = useState('English');
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isGameMode, setIsGameMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live Call Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextPlayTimeRef = useRef<number>(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (isLiveActive) stopLiveCall();
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    };
  }, [isLiveActive]);

  // Initialize Chat Session
  useEffect(() => {
    const systemInstruction = `أنت معلم لغات خبير وحازم جداً، وتتحدث دائماً بـ "اللهجة المصرية العامية" الأصيلة. تفقد أعصابك وتتعصب بطريقة كوميدية ومضحكة (زي المدرسين المصريين بتوع زمان) لما الطالب يغلط.
المستخدم يتحدث بـ "${nativeLang}" ويريد تعلم "${targetLang}".
مهمتك هي:
1. شرح القواعد والأساسيات للغة "${targetLang}" بوضوح باستخدام اللهجة المصرية العامية.
2. التحدث مع المستخدم وممارسة المحادثة.
3. لو المستخدم غلط، اتعصب عليه ووبخه بطريقة مصرية ساخرة ومضحكة (مثلاً: "إيه يا ابني اللي بتقوله ده؟"، "ركز معايا الله يكرمك!"، "يا حبيبي ركز شوية!")، وبعدين اشرح له القاعدة الصح بجدية.
4. استخدم "${targetLang}" للأمثلة والتدريب.
5. ابدأ المحادثة بترحيب حازم ومصري جداً، واسأله تحب نتعلم إيه النهاردة.`;

    try {
      chatRef.current = getAI().chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });
    } catch (error) {
      console.error("Failed to initialize chat:", error);
    }

    // Initial greeting
    setMessages([{
      id: Date.now().toString(),
      role: 'model',
      text: `أهلاً بيك يا سيدي. أنا مدرس الـ ${targetLang} بتاعك. ياريت تكون جاي تذاكر بجد، عشان أنا مابحبش تضييع الوقت ولا المياصة، ومابستحملش الأخطاء الساذجة! 🧐 ركز معايا كده وفتح مخك.. تحب نبدأ بإيه النهاردة؟`
    }]);
  }, [nativeLang, targetLang]);

  const handleSendText = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      if (!chatRef.current) {
        throw new Error("Chat not initialized");
      }
      const response = await chatRef.current.sendMessage({ message: userMsg.text });
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || ''
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleSendAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('تعذر الوصول إلى الميكروفون. يرجى التحقق من الصلاحيات.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    setIsLoading(true);
    
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      text: '🎤 رسالة صوتية...',
      isAudio: true
    }]);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          
          const response = await getAI().models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: {
              parts: [
                { text: "هذه رسالة صوتية مني. يرجى الرد عليها وتصحيح أي أخطاء لغوية أو نطقية إن وجدت، ثم متابعة الدرس." },
                { inlineData: { data: base64data, mimeType: 'audio/webm' } }
              ]
            },
            config: {
              systemInstruction: chatRef.current?.config?.systemInstruction
            }
          });

          const replyText = response.text || '';
          
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, text: '🎤 [تم إرسال رسالة صوتية]' } : msg
          ));

          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: replyText
          }]);
        } catch (error) {
          console.error('Error processing audio inner:', error);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: 'عذراً، حدث خطأ في معالجة الصوت. يرجى المحاولة مرة أخرى.'
          }]);
        } finally {
          setIsLoading(false);
        }
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: 'عذراً، حدث خطأ في معالجة الصوت. يرجى المحاولة مرة أخرى.'
      }]);
      setIsLoading(false);
    }
  };

  const stopLiveCall = () => {
    setIsLiveActive(false);
    setLiveStatus('');
    setIsModelSpeaking(false);
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.then((session: any) => {
        try { session.close(); } catch(e) {}
      });
      liveSessionRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  };

  const playAudioChunk = (base64Audio: string) => {
    if (!audioContextRef.current) return;
    try {
      const binary = window.atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      const currentTime = audioContextRef.current.currentTime;
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime;
      }
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
    } catch (e) {
      console.error("Error playing audio chunk", e);
    }
  };

  const startLiveCall = async () => {
    setIsLiveActive(true);
    setLiveStatus('جاري طلب صلاحية الميكروفون...');
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContextClass({ sampleRate: 16000 });
      } catch (e) {
        audioCtx = new AudioContextClass();
      }
      audioContextRef.current = audioCtx;
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: {
          echoCancellation: true,
          noiseSuppression: true
        } });
      } catch (micError) {
        throw new Error("لم نتمكن من الوصول للميكروفون. يرجى التأكد من إعطاء الصلاحيات للمتصفح.");
      }
      streamRef.current = stream;

      setLiveStatus('جاري الاتصال بالخادم...');

      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const systemInstruction = `أنت معلم لغات خبير وحازم، وتتحدث دائماً بـ "اللهجة المصرية العامية" الأصيلة. تفقد أعصابك وتتعصب بطريقة كوميدية ومضحكة جداً (زي المدرس المصري العصبي بتاع زمان) لما الطالب يغلط! 😤
المستخدم يتحدث بـ "${nativeLang}" ويريد تعلم "${targetLang}".
تحدث معه مباشرة، ولو قال حاجة غلط أو نطق وحش، انفعل عليه ووبخه بأسلوب مصري ساخر ومضحك (مثلاً: "يا ابني ركز!"، "إيه النطق العجيب ده؟"، "أنت بتخترع لغة جديدة؟")، وبعدين صحح له الخطأ فوراً واشرح له الصح.
قم بإجراء محادثة تفاعلية. ابدأ بالترحيب به بجدية مصطنعة واسأله تحب نتكلم في إيه النهاردة.
اجعل جو التعلم مزيجاً بين الجدية والعصبية الكوميدية المصرية اللي بتضحك!`;

      let sessionPromise;
      try {
        sessionPromise = getAI().live.connect({
          model: "gemini-2.5-flash-native-audio-preview-12-2025",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
            },
            systemInstruction: systemInstruction,
          },
          callbacks: {
            onopen: () => {
              setLiveStatus('متصل - تحدث الآن 🎤');
              processorRef.current!.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const actualSampleRate = audioContextRef.current!.sampleRate;
                
                const targetRate = 16000;
                let downsampledData = inputData;
                
                if (actualSampleRate !== targetRate) {
                  const ratio = actualSampleRate / targetRate;
                  const newLength = Math.round(inputData.length / ratio);
                  downsampledData = new Float32Array(newLength);
                  let offsetResult = 0;
                  let offsetBuffer = 0;
                  while (offsetResult < downsampledData.length) {
                    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
                    let accum = 0, count = 0;
                    for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputData.length; i++) {
                      accum += inputData[i];
                      count++;
                    }
                    downsampledData[offsetResult] = accum / count;
                    offsetResult++;
                    offsetBuffer = nextOffsetBuffer;
                  }
                }

                const pcm16 = new Int16Array(downsampledData.length);
                for (let i = 0; i < downsampledData.length; i++) {
                  const s = Math.max(-1, Math.min(1, downsampledData[i]));
                  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                let binary = '';
                const bytes = new Uint8Array(pcm16.buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                const base64 = window.btoa(binary);

                sessionPromise.then(session => {
                  session.sendRealtimeInput({
                    audio: { data: base64, mimeType: `audio/pcm;rate=${targetRate}` }
                  });
                }).catch(err => {
                  console.error("Error sending audio:", err);
                });
              };
              source.connect(processorRef.current!);
              processorRef.current!.connect(audioContextRef.current!.destination);
            },
            onmessage: (message: LiveServerMessage) => {
              const parts = message.serverContent?.modelTurn?.parts;
              if (parts) {
                let hasAudio = false;
                for (const part of parts) {
                  if (part.inlineData && part.inlineData.data) {
                    playAudioChunk(part.inlineData.data);
                    hasAudio = true;
                  }
                }
                if (hasAudio) {
                  setIsModelSpeaking(true);
                  if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
                  speakingTimeoutRef.current = setTimeout(() => {
                    setIsModelSpeaking(false);
                  }, 800);
                }
              }
              if (message.serverContent?.interrupted || message.serverContent?.turnComplete) {
                setIsModelSpeaking(false);
                if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
              }
              if (message.serverContent?.interrupted) {
                nextPlayTimeRef.current = audioContextRef.current?.currentTime || 0;
              }
            },
            onclose: () => {
              stopLiveCall();
            },
            onerror: (err: any) => {
              console.error("Live API Error:", err);
              setLiveStatus(`انقطع الاتصال: ${err?.message || 'خطأ غير معروف'}`);
              setTimeout(() => stopLiveCall(), 4000);
            }
          }
        });
      } catch (err: any) {
        console.error("Live API Sync Error:", err);
        setLiveStatus(`فشل الاتصال: ${err?.message || 'تأكد من اتصالك بالإنترنت'}`);
        setTimeout(() => stopLiveCall(), 4000);
        return;
      }
      
      liveSessionRef.current = sessionPromise;
      
      sessionPromise.catch(err => {
        console.error("Live API Connect Error:", err);
        setLiveStatus(`فشل الاتصال: ${err?.message || 'تأكد من اتصالك بالإنترنت'}`);
        setTimeout(() => stopLiveCall(), 4000);
      });
      
    } catch (err: any) {
      console.error("Failed to start live call:", err);
      setLiveStatus(`خطأ: ${err?.message || 'حدث خطأ غير متوقع'}`);
      setTimeout(() => stopLiveCall(), 4000);
    }
  };

  const playAudio = async (messageId: string, text: string) => {
    // Stop currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: true } : m));

    try {
      const response = await getAI().models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // The TTS model returns raw PCM or WAV data usually encoded in base64.
        // We can play it using the Web Audio API or an Audio element.
        const audioSrc = `data:audio/wav;base64,${base64Audio}`;
        const audio = new Audio(audioSrc);
        currentAudioRef.current = audio;
        
        audio.onended = () => {
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: false } : m));
          currentAudioRef.current = null;
        };
        
        audio.onerror = () => {
          console.error("Audio playback error");
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: false } : m));
          currentAudioRef.current = null;
        };

        await audio.play();
      } else {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: false } : m));
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: false } : m));
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 md:p-6 relative">
      <AnimatePresence>
        {isGameMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-50 rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(192,38,211,0.3)]"
          >
            <RocketGame targetLang={targetLang} onClose={() => setIsGameMode(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(192,38,211,0.3)]">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400">معلم اللغات الذكي</h1>
            <p className="text-xs md:text-sm text-fuchsia-500/70 font-semibold mt-1">تعلم، تحدث، وصحح أخطاءك بسهولة</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] uppercase tracking-wider text-fuchsia-500/70 mb-1 font-bold">صوت المعلم</label>
            <select 
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full bg-[#0a1120] border border-fuchsia-500/30 rounded-xl px-3 py-2 text-sm text-fuchsia-100 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all"
            >
              {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] uppercase tracking-wider text-fuchsia-500/70 mb-1 font-bold">لغتك / لهجتك</label>
            <select 
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              className="w-full bg-[#0a1120] border border-fuchsia-500/30 rounded-xl px-3 py-2 text-sm text-fuchsia-100 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] uppercase tracking-wider text-fuchsia-500/70 mb-1 font-bold">اللغة المراد تعلمها</label>
            <select 
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full bg-[#0a1120] border border-fuchsia-500/30 rounded-xl px-3 py-2 text-sm text-fuchsia-100 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button
            onClick={() => setIsGameMode(true)}
            className="mt-5 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white rounded-xl font-bold shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center gap-2"
            title="العب لعبة الصاروخ"
          >
            <Rocket className="w-5 h-5" />
            <span className="hidden md:inline">العب وتعلم</span>
          </button>
        </div>
      </header>

      <div className="flex-1 glass-panel rounded-2xl md:rounded-3xl border border-fuchsia-500/20 shadow-[0_0_30px_rgba(192,38,211,0.05)] flex flex-col overflow-hidden">
        {isLiveActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 bg-gradient-to-b from-fuchsia-900/20 to-[#050b14]">
            <div className="relative">
              {isModelSpeaking && <div className="absolute inset-0 bg-fuchsia-500/20 rounded-full animate-ping scale-110" />}
              <TeacherAvatar isSpeaking={isModelSpeaking} voiceId={selectedVoice} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-fuchsia-100">مكالمة مباشرة</h3>
              <p className="text-fuchsia-400 font-medium">{liveStatus}</p>
              <p className="text-sm text-fuchsia-500/70 max-w-md mx-auto mt-4">
                تحدث بحرية. سيستمع المعلم إليك ويرد عليك صوتياً لتصحيح أخطائك وممارسة المحادثة.
              </p>
            </div>

            <button
              onClick={stopLiveCall}
              className="mt-8 px-8 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-2xl flex items-center gap-3 transition-all"
            >
              <PhoneOff className="w-6 h-6" />
              <span className="font-bold text-lg">إنهاء المكالمة</span>
            </button>
          </div>
        ) : (
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-cyan-900/50 border border-cyan-500/30 text-cyan-400' 
                    : 'bg-fuchsia-900/50 border border-fuchsia-500/30 text-fuchsia-400'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 md:w-5 md:h-5" /> : <Bot className="w-4 h-4 md:w-5 md:h-5" />}
                </div>
                
                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-3 md:p-4 relative group ${
                  msg.role === 'user'
                    ? 'bg-cyan-950/30 border border-cyan-500/20 text-cyan-50 rounded-tr-none'
                    : 'bg-fuchsia-950/30 border border-fuchsia-500/20 text-fuchsia-50 rounded-tl-none'
                }`}>
                  <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap" dir="auto">
                    {msg.text}
                  </div>
                  
                  {msg.role === 'model' && (
                    <button
                      onClick={() => playAudio(msg.id, msg.text)}
                      disabled={msg.isPlaying}
                      className={`absolute -bottom-3 rtl:-left-3 ltr:-right-3 p-2 rounded-full border transition-all ${
                        msg.isPlaying 
                          ? 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_0_10px_rgba(192,38,211,0.5)]' 
                          : 'bg-[#0a1120] border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-900/50 opacity-0 group-hover:opacity-100'
                      }`}
                      title="استمع للرد"
                    >
                      {msg.isPlaying ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <Volume2 className="w-3 h-3 md:w-4 md:h-4" />}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-fuchsia-900/50 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="bg-fuchsia-950/30 border border-fuchsia-500/20 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-[#050b14]/80 border-t border-fuchsia-500/20 backdrop-blur-md">
          <div className="flex items-end gap-2 md:gap-3">
            <button
              onClick={startLiveCall}
              disabled={isLoading || isRecording}
              className="p-3 md:p-4 rounded-xl bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-800/50 transition-all flex items-center justify-center"
              title="مكالمة صوتية مباشرة"
            >
              <Phone className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isLoading}
              className={`p-3 md:p-4 rounded-xl flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-105' 
                  : 'bg-fuchsia-950/50 text-fuchsia-400 border border-fuchsia-500/30 hover:bg-fuchsia-900/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="اضغط مع الاستمرار للتحدث"
            >
              {isRecording ? <Square className="w-5 h-5 md:w-6 md:h-6 fill-current" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
            </button>
            
            <div className="flex-1 relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                placeholder="اكتب رسالتك هنا... أو اضغط مع الاستمرار على الميكروفون للتحدث"
                className="w-full bg-[#0a1120] border border-fuchsia-500/30 rounded-xl px-4 py-3 md:py-4 text-sm md:text-base text-fuchsia-50 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all resize-none min-h-[50px] md:min-h-[60px] max-h-[120px]"
                rows={1}
                dir="auto"
                disabled={isLoading || isRecording}
              />
            </div>

            <button
              onClick={handleSendText}
              disabled={!inputText.trim() || isLoading || isRecording}
              className="p-3 md:p-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.4)] hover:shadow-[0_0_25px_rgba(192,38,211,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="w-5 h-5 md:w-6 md:h-6 rtl:-scale-x-100" />
            </button>
          </div>
          <p className="text-center text-[10px] md:text-xs text-fuchsia-500/50 mt-2">
            يمكنك الكتابة أو إرسال رسالة صوتية ليقوم المعلم بتصحيح نطقك وقواعدك.
          </p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
