'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, MessageSquare, Mic, Sparkles, Send } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PreferenceChatMessage, MoodTag, InputMode } from '@/lib/types';
import { MOOD_OPTIONS } from '@/data/genres';
import { cn } from '@/lib/utils';
import ChatMessage from './ChatMessage';
import VoiceInput from './VoiceInput';

interface PreferenceChatProps {
  participantId: string;
  participantName: string;
  messages: PreferenceChatMessage[];
  onAddMessage: (message: PreferenceChatMessage) => void;
  selectedMoods: MoodTag[];
  onMoodsChange: (moods: MoodTag[]) => void;
  maxMoodSelections?: number;
  showMockParticipants?: boolean;
}

// Mock messages from other participants for demo
const MOCK_MESSAGES: PreferenceChatMessage[] = [
  {
    id: 'mock-1',
    participantId: 'ayse-123',
    participantName: 'Ayşe',
    type: 'voice',
    text: 'Something light and fun for tonight, maybe a comedy?',
    timestamp: new Date(Date.now() - 45000),
  },
  {
    id: 'mock-2',
    participantId: 'can-456',
    participantName: 'Can',
    type: 'moods',
    moods: ['funny', 'relaxed'],
    timestamp: new Date(Date.now() - 30000),
  },
];

const AI_WELCOME_MESSAGE: PreferenceChatMessage = {
  id: 'ai-welcome',
  participantId: 'ai',
  participantName: 'AI',
  type: 'ai',
  text: "What kind of movie are you all in the mood for tonight? Select moods, type, or speak your preferences!",
  timestamp: new Date(Date.now() - 60000),
};

export default function PreferenceChat({
  participantId,
  participantName,
  messages,
  onAddMessage,
  selectedMoods,
  onMoodsChange,
  maxMoodSelections = 3,
  showMockParticipants = true,
}: PreferenceChatProps) {
  const [inputMode, setInputMode] = useState<InputMode>('quick');
  const [textInput, setTextInput] = useState('');
  const [allMessages, setAllMessages] = useState<PreferenceChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Combine AI welcome, mock messages, and real messages
  useEffect(() => {
    const combinedMessages = [
      AI_WELCOME_MESSAGE,
      ...(showMockParticipants ? MOCK_MESSAGES : []),
      ...messages,
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setAllMessages(combinedMessages);
  }, [messages, showMockParticipants]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  // Handle mood selection
  const toggleMood = (moodId: MoodTag) => {
    let newMoods: MoodTag[];
    if (selectedMoods.includes(moodId)) {
      newMoods = selectedMoods.filter((m) => m !== moodId);
    } else if (selectedMoods.length < maxMoodSelections) {
      newMoods = [...selectedMoods, moodId];
    } else {
      return;
    }

    onMoodsChange(newMoods);

    // Add message to chat if moods changed
    if (newMoods.length > 0) {
      // Remove any existing mood message from this user and add new one
      const newMessage: PreferenceChatMessage = {
        id: nanoid(),
        participantId,
        participantName,
        type: 'moods',
        moods: newMoods,
        timestamp: new Date(),
      };
      onAddMessage(newMessage);
    }
  };

  // Handle text submission
  const handleTextSubmit = () => {
    if (!textInput.trim()) return;

    const newMessage: PreferenceChatMessage = {
      id: nanoid(),
      participantId,
      participantName,
      type: 'text',
      text: textInput.trim(),
      timestamp: new Date(),
    };
    onAddMessage(newMessage);
    setTextInput('');
  };

  // Handle voice transcript
  const handleVoiceTranscript = (text: string) => {
    if (!text.trim()) return;

    const newMessage: PreferenceChatMessage = {
      id: nanoid(),
      participantId,
      participantName,
      type: 'voice',
      text: text.trim(),
      timestamp: new Date(),
    };
    onAddMessage(newMessage);
  };

  const inputModes: { id: InputMode; label: string; icon: React.ReactNode }[] = [
    { id: 'quick', label: 'Quick Pick', icon: <Zap className="w-4 h-4" /> },
    { id: 'type', label: 'Type', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'voice', label: 'Voice', icon: <Mic className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary-400" />
        <h3 className="text-lg font-semibold text-white">
          What&apos;s the vibe tonight?
        </h3>
      </div>

      {/* Chat Feed */}
      <div className="flex-1 min-h-0 mb-4">
        <div className="h-64 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {allMessages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isCurrentUser={message.participantId === participantId}
            />
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="mb-4">
        <div className="flex items-center justify-center gap-1 p-1 bg-gray-800/50 rounded-xl border border-gray-700">
          {inputModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setInputMode(mode.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                inputMode === mode.id
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              )}
            >
              {mode.icon}
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Content */}
      <AnimatePresence mode="wait">
        {inputMode === 'quick' && (
          <motion.div
            key="quick"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <p className="text-gray-400 text-sm">
              Select up to {maxMoodSelections} moods ({selectedMoods.length}/{maxMoodSelections})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MOOD_OPTIONS.map((mood) => {
                const isSelected = selectedMoods.includes(mood.id as MoodTag);
                const isDisabled = !isSelected && selectedMoods.length >= maxMoodSelections;

                return (
                  <motion.button
                    key={mood.id}
                    onClick={() => toggleMood(mood.id as MoodTag)}
                    disabled={isDisabled}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all text-left',
                      isSelected
                        ? 'border-primary-500 bg-primary-500/20'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{mood.emoji}</span>
                      <span className="font-medium text-white text-sm">{mood.label}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {inputMode === 'type' && (
          <motion.div
            key="type"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <p className="text-gray-400 text-sm">
              Describe what you&apos;re in the mood for
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                placeholder="e.g., Something light and fun, no horror..."
                className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className="px-4 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {inputMode === 'voice' && (
          <motion.div
            key="voice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <VoiceInput onTranscript={handleVoiceTranscript} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Summary Preview */}
      {(selectedMoods.length > 0 || messages.some((m) => m.type === 'text' || m.type === 'voice')) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/30 rounded-xl"
        >
          <p className="text-sm text-gray-300">
            <span className="text-primary-400 font-medium">AI Preview: </span>
            {generateAISummary(selectedMoods, messages.filter((m) => m.participantId === participantId))}
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Helper function to generate AI summary
function generateAISummary(moods: MoodTag[], userMessages: PreferenceChatMessage[]): string {
  const parts: string[] = [];

  if (moods.length > 0) {
    const moodLabels = moods.map((m) => {
      const mood = MOOD_OPTIONS.find((opt) => opt.id === m);
      return mood?.label.toLowerCase() || m;
    });
    parts.push(`Looking for ${moodLabels.join(' and ')} vibes`);
  }

  const textMessages = userMessages.filter((m) => m.type === 'text' || m.type === 'voice');
  if (textMessages.length > 0) {
    const lastText = textMessages[textMessages.length - 1].text;
    if (lastText) {
      parts.push(`with preference for "${lastText}"`);
    }
  }

  if (parts.length === 0) {
    return 'Share your preferences above!';
  }

  return parts.join(', ') + '. Great choice!';
}
