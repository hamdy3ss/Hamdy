import React from 'react';
import { motion } from 'motion/react';

interface TeacherAvatarProps {
  isSpeaking: boolean;
  voiceId: string;
}

export default function TeacherAvatar({ isSpeaking, voiceId }: TeacherAvatarProps) {
  const profiles: Record<string, any> = {
    Zephyr: {
      gradient: 'from-red-500 to-orange-600',
      eyebrowL: 'rotate-12',
      eyebrowR: '-rotate-12',
      eyeShape: 'rounded-full',
      mouthIdle: 'h-2 w-12 rounded-full',
      mouthSpeaking: { height: [8, 20, 8], width: [32, 24, 32], borderRadius: ['8px', '16px', '8px'] }
    },
    Puck: {
      gradient: 'from-purple-500 to-pink-600',
      eyebrowL: '-rotate-12',
      eyebrowR: 'rotate-12',
      eyeShape: 'rounded-full',
      mouthIdle: 'h-2 w-8 rounded-full rotate-6',
      mouthSpeaking: { height: [8, 16, 8], width: [24, 20, 24], borderRadius: ['8px', '12px', '8px'], rotate: [6, 0, 6] }
    },
    Charon: {
      gradient: 'from-slate-600 to-slate-800',
      eyebrowL: 'rotate-0',
      eyebrowR: 'rotate-0',
      eyeShape: 'rounded-sm border-4 border-white/20',
      mouthIdle: 'h-1 w-10 rounded-none',
      mouthSpeaking: { height: [4, 12, 4], width: [32, 24, 32], borderRadius: ['0px', '8px', '0px'] }
    },
    Kore: {
      gradient: 'from-emerald-400 to-teal-600',
      eyebrowL: '-rotate-6',
      eyebrowR: 'rotate-6',
      eyeShape: 'rounded-full',
      mouthIdle: 'h-4 w-10 rounded-b-full rounded-t-none',
      mouthSpeaking: { height: [16, 24, 16], width: [32, 24, 32], borderRadius: ['0 0 16px 16px', '12px', '0 0 16px 16px'] }
    },
    Fenrir: {
      gradient: 'from-amber-500 to-red-600',
      eyebrowL: 'rotate-12',
      eyebrowR: '-rotate-12',
      eyeShape: 'rounded-full',
      mouthIdle: 'h-3 w-14 rounded-full',
      mouthSpeaking: { height: [12, 32, 12], width: [40, 32, 40], borderRadius: ['12px', '24px', '12px'] }
    }
  };

  const profile = profiles[voiceId] || profiles['Zephyr'];

  return (
    <motion.div
      animate={{
        scale: isSpeaking ? [1, 1.05, 1] : 1,
        y: isSpeaking ? [0, -5, 0] : 0
      }}
      transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.4 }}
      className={`w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-br ${profile.gradient} flex flex-col items-center justify-center relative overflow-hidden border-4 border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.3)] z-10`}
    >
      {/* Eyebrows */}
      <div className="flex gap-8 mb-1">
        <div className={`w-8 h-2 bg-black/40 rounded-full ${profile.eyebrowL} origin-right`} />
        <div className={`w-8 h-2 bg-black/40 rounded-full ${profile.eyebrowR} origin-left`} />
      </div>

      {/* Eyes */}
      <div className="flex gap-6 mb-6 z-10">
        <div className={`w-6 h-8 bg-white relative overflow-hidden ${profile.eyeShape}`}>
          <motion.div
            animate={{ y: [0, 20, 0] }}
            transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
            className="absolute inset-0 bg-black/10"
            style={{ originY: 0 }}
          />
          <div className="w-3 h-3 bg-gray-900 rounded-full absolute bottom-2 right-1" />
        </div>
        <div className={`w-6 h-8 bg-white relative overflow-hidden ${profile.eyeShape}`}>
          <motion.div
            animate={{ y: [0, 20, 0] }}
            transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
            className="absolute inset-0 bg-black/10"
            style={{ originY: 0 }}
          />
          <div className="w-3 h-3 bg-gray-900 rounded-full absolute bottom-2 left-1" />
        </div>
      </div>

      {/* Mouth */}
      <motion.div
        animate={isSpeaking ? profile.mouthSpeaking : {}}
        transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.2, repeatType: 'reverse' }}
        className={`bg-gray-900 ${profile.mouthIdle}`}
      />
    </motion.div>
  );
}
