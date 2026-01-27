'use client';

import { motion } from 'framer-motion';
import { Bot, Mic, User } from 'lucide-react';
import { PreferenceChatMessage, MoodTag } from '@/lib/types';
import { MOOD_OPTIONS } from '@/data/genres';

interface ChatMessageProps {
  message: PreferenceChatMessage;
  isCurrentUser?: boolean;
}

function getMoodInfo(moodId: MoodTag) {
  return MOOD_OPTIONS.find((m) => m.id === moodId);
}

export default function ChatMessage({ message, isCurrentUser = false }: ChatMessageProps) {
  const isAI = message.type === 'ai';
  const isVoice = message.type === 'voice';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isAI ? 'items-start' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isAI
            ? 'bg-gradient-to-br from-primary-500 to-accent-500'
            : isCurrentUser
            ? 'bg-primary-500/20 border border-primary-500/50'
            : 'bg-gray-700'
        }`}
      >
        {isAI ? (
          <Bot className="w-4 h-4 text-white" />
        ) : isVoice ? (
          <Mic className="w-4 h-4 text-primary-400" />
        ) : (
          <User className="w-4 h-4 text-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name and timestamp */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-sm font-medium ${
              isAI ? 'text-primary-400' : isCurrentUser ? 'text-white' : 'text-gray-300'
            }`}
          >
            {isAI ? 'AI' : message.participantName}
            {isCurrentUser && !isAI && (
              <span className="text-gray-500 font-normal ml-1">(you)</span>
            )}
          </span>
          {isVoice && (
            <span className="text-xs text-primary-400 flex items-center gap-1">
              <Mic className="w-3 h-3" /> voice
            </span>
          )}
        </div>

        {/* Message content */}
        <div
          className={`rounded-xl p-3 ${
            isAI
              ? 'bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/30'
              : 'bg-gray-800/50 border border-gray-700'
          }`}
        >
          {/* Mood tags */}
          {message.type === 'moods' && message.moods && (
            <div className="flex flex-wrap gap-2">
              {message.moods.map((moodId) => {
                const mood = getMoodInfo(moodId);
                if (!mood) return null;
                return (
                  <span
                    key={moodId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 rounded-full text-sm"
                  >
                    <span>{mood.emoji}</span>
                    <span className="text-white font-medium">{mood.label}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Text message */}
          {(message.type === 'text' || message.type === 'voice' || message.type === 'ai') &&
            message.text && (
              <p
                className={`text-sm ${
                  isAI ? 'text-gray-200' : 'text-gray-300'
                } ${message.type === 'voice' ? 'italic' : ''}`}
              >
                {message.type === 'voice' && '"'}
                {message.text}
                {message.type === 'voice' && '"'}
              </p>
            )}
        </div>
      </div>
    </motion.div>
  );
}
