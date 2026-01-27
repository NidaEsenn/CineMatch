'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageSquare } from 'lucide-react';
import { MoodTag } from '@/lib/types';
import { MOOD_OPTIONS } from '@/data/genres';
import { cn } from '@/lib/utils';

interface MoodSelectorProps {
  selectedMoods: MoodTag[];
  onMoodsChange: (moods: MoodTag[]) => void;
  maxSelections?: number;
  preferenceNote?: string;
  onPreferenceNoteChange?: (note: string) => void;
}

export default function MoodSelector({
  selectedMoods,
  onMoodsChange,
  maxSelections = 3,
  preferenceNote = '',
  onPreferenceNoteChange,
}: MoodSelectorProps) {
  const [showTextInput, setShowTextInput] = useState(!!preferenceNote);

  const toggleMood = (moodId: MoodTag) => {
    if (selectedMoods.includes(moodId)) {
      onMoodsChange(selectedMoods.filter((m) => m !== moodId));
    } else if (selectedMoods.length < maxSelections) {
      onMoodsChange([...selectedMoods, moodId]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary-400" />
        <h3 className="text-lg font-semibold text-white">
          What&apos;s the vibe tonight?
        </h3>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Select up to {maxSelections} moods ({selectedMoods.length}/{maxSelections} selected)
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {MOOD_OPTIONS.map((mood, index) => {
          const isSelected = selectedMoods.includes(mood.id as MoodTag);
          const isDisabled = !isSelected && selectedMoods.length >= maxSelections;

          return (
            <motion.button
              key={mood.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => toggleMood(mood.id as MoodTag)}
              disabled={isDisabled}
              className={cn(
                'relative p-4 rounded-xl border-2 transition-all text-left',
                'hover:scale-[1.02] active:scale-[0.98]',
                isSelected
                  ? 'border-primary-500 bg-primary-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600',
                isDisabled && 'opacity-50 cursor-not-allowed hover:scale-100'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{mood.emoji}</span>
                <span className="font-medium text-white">{mood.label}</span>
              </div>
              <p className="text-xs text-gray-400">{mood.description}</p>

              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center"
                >
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Optional Text Input - Always visible */}
      {onPreferenceNoteChange && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/30 rounded-xl"
        >
          <label className="flex items-center gap-2 text-sm font-medium text-white mb-3">
            <MessageSquare className="w-5 h-5 text-primary-400" />
            Anything else? <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={preferenceNote}
            onChange={(e) => onPreferenceNoteChange(e.target.value)}
            placeholder="e.g., Nothing too scary... or Something with a great soundtrack... or No subtitles tonight!"
            className="w-full p-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white text-sm
              placeholder:text-gray-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
              resize-none transition-all"
            rows={2}
            maxLength={200}
          />
          <p className="text-xs text-gray-500 text-right mt-1">
            {preferenceNote.length}/200
          </p>
        </motion.div>
      )}

      {/* AI Preview */}
      {(selectedMoods.length > 0 || preferenceNote) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700"
        >
          <p className="text-sm text-gray-300">
            <span className="text-primary-400 font-medium">AI says: </span>
            {selectedMoods.length > 0 ? (
              <>
                Looking for{' '}
                {selectedMoods.map((mood, i) => (
                  <span key={mood}>
                    {i > 0 && (i === selectedMoods.length - 1 ? ' and ' : ', ')}
                    <span className="text-white font-medium">{mood}</span>
                  </span>
                ))}{' '}
                vibes
                {preferenceNote && (
                  <span className="text-gray-400">
                    , with preference for{' '}
                    <span className="text-white italic">&quot;{preferenceNote}&quot;</span>
                  </span>
                )}
                . Let&apos;s find something perfect!
              </>
            ) : (
              <>
                Got it! Looking for{' '}
                <span className="text-white italic">&quot;{preferenceNote}&quot;</span>
              </>
            )}
          </p>
        </motion.div>
      )}
    </div>
  );
}
