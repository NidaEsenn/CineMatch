'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimText += transcript;
        }
      }

      setInterimTranscript(interimText);

      if (finalTranscript) {
        onTranscript(finalTranscript.trim());
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please enable microphone permissions.');
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Try again.');
      } else {
        setError('Voice input error. Please try again.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setError(null);
      setInterimTranscript('');
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setError('Failed to start voice input. Please try again.');
      }
    }
  }, [isListening]);

  if (!isSupported) {
    return (
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center gap-3 text-gray-400">
          <MicOff className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium text-white">Voice input not supported</p>
            <p className="text-xs">Your browser doesn&apos;t support speech recognition. Try Chrome or Edge.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Recording button */}
      <div className="flex flex-col items-center gap-4">
        <motion.button
          onClick={toggleListening}
          disabled={disabled}
          whileTap={{ scale: 0.95 }}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            isListening
              ? 'bg-red-500 shadow-lg shadow-red-500/30'
              : 'bg-gray-700 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {/* Pulsing animation when listening */}
          <AnimatePresence>
            {isListening && (
              <>
                <motion.div
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-red-500"
                />
                <motion.div
                  initial={{ scale: 1, opacity: 0.3 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
                  className="absolute inset-0 rounded-full bg-red-500"
                />
              </>
            )}
          </AnimatePresence>

          <Mic className={`w-8 h-8 ${isListening ? 'text-white' : 'text-gray-300'}`} />
        </motion.button>

        <p className="text-sm text-gray-400">
          {isListening ? 'Listening... Tap to stop' : 'Tap to speak'}
        </p>
      </div>

      {/* Interim transcript */}
      <AnimatePresence>
        {interimTranscript && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 bg-gray-800/50 rounded-xl border border-gray-700"
          >
            <p className="text-sm text-gray-400 italic">&quot;{interimTranscript}&quot;</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
          >
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
