'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Check, Loader2, Copy, Share2, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { FirebaseSession, FirebaseParticipant } from '@/lib/firebase';
import { formatSessionCode } from '@/lib/utils';

interface WaitingRoomProps {
  session: FirebaseSession;
  currentUserId: string;
  onAllReady: () => void;
  isLoading: boolean;
}

export default function WaitingRoom({
  session,
  currentUserId,
  onAllReady,
  isLoading
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const participants = Object.values(session.participants || {});
  const allReady = participants.length > 0 && participants.every(p => p.ready);
  const readyCount = participants.filter(p => p.ready).length;

  // Auto-trigger when all ready
  useEffect(() => {
    if (allReady && !isLoading) {
      onAllReady();
    }
  }, [allReady, isLoading, onAllReady]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(session.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my CineMatch session!',
          text: `Join my movie night! Use code: ${formatSessionCode(session.code)}`,
          url: `${window.location.origin}/session/join?code=${session.code}`,
        });
      } catch (err) {
        handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          AI is thinking...
        </h2>
        <p className="text-gray-400">
          Finding perfect movies for your group
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Session Code */}
      <Card variant="glass" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-400" />
            <span className="text-gray-400">Session Code</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xl text-white">
              {formatSessionCode(session.code)}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={handleShare}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share with Friends
        </Button>
      </Card>

      {/* Participants List */}
      <Card variant="glass" padding="lg">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Participants ({readyCount}/{participants.length} ready)
        </h3>

        <div className="space-y-3">
          {participants.map((participant) => (
            <ParticipantRow
              key={participant.id}
              participant={participant}
              isCurrentUser={participant.id === currentUserId}
            />
          ))}
        </div>

        {participants.length < 2 && (
          <p className="text-gray-500 text-sm text-center mt-4">
            Waiting for more friends to join...
          </p>
        )}
      </Card>

      {/* Status Message */}
      <div className="text-center">
        {allReady ? (
          <div className="flex items-center justify-center gap-2 text-green-400">
            <Sparkles className="w-5 h-5" />
            <span>Everyone is ready! Starting...</span>
          </div>
        ) : (
          <p className="text-gray-400">
            Waiting for all participants to be ready...
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ParticipantRow({
  participant,
  isCurrentUser
}: {
  participant: FirebaseParticipant;
  isCurrentUser: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
          {participant.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{participant.name}</span>
            {isCurrentUser && (
              <span className="text-xs text-primary-400 bg-primary-400/20 px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
          {participant.moods && participant.moods.length > 0 && (
            <div className="flex gap-1 mt-1">
              {participant.moods.slice(0, 3).map(mood => (
                <span
                  key={mood}
                  className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded"
                >
                  {mood}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {participant.ready ? (
          <div className="flex items-center gap-1 text-green-400">
            <Check className="w-4 h-4" />
            <span className="text-sm">Ready</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Selecting...</span>
          </div>
        )}
      </div>
    </div>
  );
}
