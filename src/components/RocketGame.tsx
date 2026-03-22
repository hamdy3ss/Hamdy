import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { Heart, X, Rocket, Loader2, Mic } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { saveScore } from '../lib/firebase';

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const LANG_CODES: Record<string, string> = {
  'Arabic (Modern Standard)': 'ar-SA',
  'Arabic (Egyptian)': 'ar-EG',
  'Arabic (Saudi/Gulf)': 'ar-SA',
  'Arabic (Levantine/Syrian/Lebanese)': 'ar-LB',
  'Arabic (Moroccan/Maghrebi)': 'ar-MA',
  'Arabic (Iraqi)': 'ar-IQ',
  'Arabic (Sudanese)': 'ar-SD',
  'English': 'en-US',
  'French': 'fr-FR',
  'Spanish': 'es-ES',
  'German': 'de-DE',
  'Chinese (Mandarin)': 'zh-CN',
  'Japanese': 'ja-JP',
  'Russian': 'ru-RU',
  'Hindi': 'hi-IN',
  'Italian': 'it-IT',
  'Turkish': 'tr-TR'
};

type GameObject = { id: number; emoji: string; word: string; x: number; y: number; speed: number };
type Explosion = { id: number; x: number; y: number; emoji: string };

interface RocketGameProps {
  targetLang: string;
  onClose: () => void;
}

export default function RocketGame({ targetLang, onClose }: RocketGameProps) {
  const [gameState, setGameState] = useState<'start' | 'loading' | 'playing' | 'gameover'>('start');
  const [vocab, setVocab] = useState<{emoji: string, word: string}[]>([]);
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [feedback, setFeedback] = useState<{text: string, type: 'correct' | 'wrong' | 'info'} | null>(null);
  const [isListening, setIsListening] = useState(false);
  const { currentUser } = useAuth();

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const startGame = async () => {
    setGameState('loading');
    setScore(0);
    setLives(3);
    setObjects([]);
    setExplosions([]);
    setFeedback(null);
    
    try {
      const prompt = `Generate a JSON array of 20 simple, highly recognizable objects (animals, fruits, vehicles, everyday items). 
      For each object, provide its emoji and its name in ${targetLang}.
      The name MUST be a single, simple word.
      Format exactly as: [{"emoji": "🍎", "word": "apple"}, ...]
      Do not include markdown formatting or any other text, just the JSON array.`;
      
      const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      
      const data = JSON.parse(response.text || '[]');
      setVocab(data);
      setGameState('playing');
    } catch (error) {
      console.error("Error fetching vocab:", error);
      setFeedback({ text: "حدث خطأ في تحميل الكلمات. حاول مرة أخرى.", type: 'wrong' });
      setGameState('gameover');
    }
  };

  const triggerExplosion = (x: number, y: number, emoji: string) => {
    const id = Date.now();
    setExplosions(prev => [...prev, { id, x, y, emoji }]);
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== id));
    }, 800);
  };

  // Speech Recognition
  useEffect(() => {
    if (gameState !== 'playing') {
      setIsListening(false);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setFeedback({ text: "عذراً، متصفحك لا يدعم التعرف على الصوت. استخدم Google Chrome.", type: 'wrong' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = LANG_CODES[targetLang] || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      handleSpokenWord(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setFeedback({ text: "يرجى السماح باستخدام الميكروفون للعب.", type: 'wrong' });
        setGameState('gameover');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (gameStateRef.current === 'playing') {
        try { recognition.start(); } catch(e) {}
      }
    };

    try {
      recognition.start();
    } catch(e) {}

    return () => {
      recognition.stop();
    };
  }, [gameState, targetLang]);

  const handleSpokenWord = (spoken: string) => {
    if (!spoken) return;
    
    setObjects(prev => {
      if (prev.length === 0) return prev;
      // Find lowest object
      const lowest = [...prev].sort((a, b) => b.y - a.y)[0];
      
      const cleanSpoken = spoken.replace(/[.,!?؟،]/g, '').toLowerCase().trim();
      const cleanTarget = lowest.word.toLowerCase().trim();
      
      if (cleanSpoken === '') return prev;

      if (cleanSpoken.includes(cleanTarget) || cleanTarget.includes(cleanSpoken)) {
        // Correct
        triggerExplosion(lowest.x, lowest.y, '💥');
        setScore(s => s + 1);
        setFeedback({ text: `ممتاز! ${lowest.word}`, type: 'correct' });
        return prev.filter(o => o.id !== lowest.id);
      } else {
        // Wrong
        triggerExplosion(lowest.x, lowest.y, '❌');
        setFeedback({ text: `خطأ! قلت "${cleanSpoken}"، الصح هو: ${lowest.word}`, type: 'wrong' });
        setLives(l => {
          const newLives = l - 1;
          if (newLives <= 0) {
            setGameState('gameover');
            if (currentUser) {
              saveScore(currentUser.uid, 'RocketGame', score, targetLang);
            }
          }
          return newLives;
        });
        return prev.filter(o => o.id !== lowest.id);
      }
    });
  };

  // Game Loop (Falling)
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interval = setInterval(() => {
      setObjects(prev => {
        const next = prev.map(obj => ({ ...obj, y: obj.y + obj.speed }));
        const hitBottom = next.filter(obj => obj.y > 85);
        
        if (hitBottom.length > 0) {
          setLives(l => {
            const newLives = l - hitBottom.length;
            if (newLives <= 0) {
              setGameState('gameover');
              if (currentUser) {
                saveScore(currentUser.uid, 'RocketGame', score, targetLang);
              }
            }
            return newLives;
          });
          setFeedback({ text: `سقطت! الكلمة كانت: ${hitBottom[0].word}`, type: 'wrong' });
        }
        
        return next.filter(obj => obj.y <= 85);
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [gameState]);

  // Spawner
  useEffect(() => {
    if (gameState !== 'playing' || vocab.length === 0) return;
    
    const spawnInterval = setInterval(() => {
      const randomVocab = vocab[Math.floor(Math.random() * vocab.length)];
      setObjects(prev => [...prev, {
        id: Date.now(),
        ...randomVocab,
        x: 10 + Math.random() * 70, // 10% to 80% width
        y: -10,
        speed: 0.2 + Math.random() * 0.3 // Adjust speed
      }]);
    }, 4000); // Spawn every 4 seconds
    
    return () => clearInterval(spawnInterval);
  }, [gameState, vocab]);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-b from-[#0a0514] via-[#1a0b2e] to-[#2d1b4e] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-black/30 backdrop-blur-sm border-b border-white/10 z-40">
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <Heart key={i} className={`w-6 h-6 md:w-8 md:h-8 ${i < lives ? 'text-red-500 fill-red-500' : 'text-gray-600 fill-gray-600'}`} />
          ))}
        </div>
        
        <div className="flex items-center gap-4">
          {isListening && (
            <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
              <Mic className="w-4 h-4" />
              <span>يستمع...</span>
            </div>
          )}
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
            <span className="text-white font-bold text-lg md:text-xl">النقاط: {score}</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative">
        {/* Stars Background */}
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div 
              key={i} 
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                width: Math.random() * 3 + 1 + 'px',
                height: Math.random() * 3 + 1 + 'px',
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
                animationDuration: Math.random() * 3 + 1 + 's'
              }}
            />
          ))}
        </div>

        {/* Feedback Toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`absolute top-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-bold text-lg md:text-xl shadow-2xl z-40 border ${
                feedback.type === 'correct' ? 'bg-green-500/90 border-green-400' : 
                feedback.type === 'wrong' ? 'bg-red-500/90 border-red-400' : 'bg-blue-500/90 border-blue-400'
              }`}
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Falling Objects */}
        {objects.map(obj => (
          <div
            key={obj.id}
            className="absolute text-5xl md:text-7xl z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            style={{ left: `${obj.x}%`, top: `${obj.y}%`, transition: 'top 50ms linear' }}
          >
            {obj.emoji}
          </div>
        ))}

        {/* Explosions */}
        <AnimatePresence>
          {explosions.map(exp => (
            <motion.div
              key={exp.id}
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute text-6xl md:text-8xl z-20"
              style={{ left: `${exp.x}%`, top: `${exp.y}%` }}
            >
              {exp.emoji}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Rocket */}
        <motion.div 
          animate={{ y: [0, -15, 0] }} 
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-7xl md:text-9xl z-30 drop-shadow-[0_0_30px_rgba(255,100,0,0.5)]"
        >
          🚀
        </motion.div>

        {/* Overlays */}
        {gameState === 'start' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1a0b2e] p-8 rounded-3xl border border-purple-500/30 text-center max-w-md mx-4 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
              <div className="text-6xl mb-4">🚀</div>
              <h2 className="text-3xl font-bold text-white mb-4">لعبة الصاروخ</h2>
              <p className="text-purple-200 mb-6 leading-relaxed">
                ستسقط أشكال من السماء. انطق اسم الشكل باللغة <span className="font-bold text-fuchsia-400">{targetLang}</span> لتدميره قبل أن يصطدم بالأرض!
                <br/><br/>
                لديك 3 محاولات فقط.
              </p>
              <button 
                onClick={startGame}
                className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-xl font-bold text-xl shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all"
              >
                ابدأ اللعب الآن
              </button>
            </div>
          </div>
        )}

        {gameState === 'loading' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="w-16 h-16 text-fuchsia-500 animate-spin mb-4" />
            <p className="text-xl text-white font-bold animate-pulse">جاري تجهيز الكلمات...</p>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
            <div className="bg-[#1a0b2e] p-8 rounded-3xl border border-red-500/30 text-center max-w-md mx-4 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
              <div className="text-6xl mb-4">💥</div>
              <h2 className="text-4xl font-bold text-white mb-2">انتهت اللعبة!</h2>
              <p className="text-2xl text-fuchsia-400 font-bold mb-8">النقاط: {score}</p>
              <div className="flex gap-4">
                <button 
                  onClick={startGame}
                  className="flex-1 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all"
                >
                  العب مرة أخرى
                </button>
                <button 
                  onClick={onClose}
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-lg transition-all"
                >
                  خروج
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
