'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { PreferenceConflict } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface ConflictBannerProps {
  conflicts: PreferenceConflict[];
}

export default function ConflictBanner({ conflicts }: ConflictBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (conflicts.length === 0 || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-400 mb-1">
              Finding common ground...
            </h4>
            <p className="text-sm text-gray-300">
              {conflicts[0].description}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {conflicts[0].resolution}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
