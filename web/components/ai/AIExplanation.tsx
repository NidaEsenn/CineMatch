'use client';

import { Sparkles, AlertTriangle } from 'lucide-react';
import { PreferenceConflict } from '@/lib/types';
import Card from '@/components/ui/Card';

interface AIExplanationProps {
  explanation: string;
  conflicts?: PreferenceConflict[];
}

export default function AIExplanation({
  explanation,
  conflicts = [],
}: AIExplanationProps) {
  return (
    <div className="space-y-3">
      {/* Main explanation */}
      <Card variant="glass" padding="md">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-500/20 rounded-lg flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-primary-400 mb-1">
              AI Recommendation
            </h4>
            <p className="text-gray-300 text-sm">{explanation}</p>
          </div>
        </div>
      </Card>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card variant="default" padding="md" className="border-yellow-500/30">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-yellow-400 mb-2">
                Preference Conflicts Detected
              </h4>
              <ul className="space-y-2">
                {conflicts.map((conflict, index) => (
                  <li key={index} className="text-sm">
                    <p className="text-gray-300">{conflict.description}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Resolution: {conflict.resolution}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
