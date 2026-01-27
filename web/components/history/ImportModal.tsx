'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { WatchHistoryEntry } from '@/lib/types';
import { mockMovies } from '@/data/mockMovies';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: WatchHistoryEntry[]) => void;
}

type ImportSource = 'netflix' | 'prime' | 'disney' | 'letterboxd';

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
}: ImportModalProps) {
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const sources = [
    {
      id: 'netflix' as ImportSource,
      name: 'Netflix',
      icon: '🎬',
      description: 'Export from Account > Profile > Viewing Activity',
    },
    {
      id: 'prime' as ImportSource,
      name: 'Prime Video',
      icon: '📺',
      description: 'Export from Watch History settings',
    },
    {
      id: 'disney' as ImportSource,
      name: 'Disney+',
      icon: '✨',
      description: 'Export from Continue Watching',
    },
    {
      id: 'letterboxd' as ImportSource,
      name: 'Letterboxd',
      icon: '🎞️',
      description: 'Export from Settings > Import & Export',
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const processFile = useCallback(async () => {
    if (!file || !selectedSource) return;

    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();

      // Parse CSV (simplified - real implementation would be more robust)
      const lines = text.split('\n').slice(1); // Skip header
      const entries: WatchHistoryEntry[] = [];
      let skipped = 0;

      for (const line of lines) {
        if (!line.trim()) continue;

        // Try to match title with our mock movies
        const parts = line.split(',');
        const title = parts[0]?.replace(/"/g, '').toLowerCase().trim();

        if (!title) {
          skipped++;
          continue;
        }

        // Find matching movie (fuzzy match)
        const movie = mockMovies.find(
          (m) =>
            m.title.toLowerCase().includes(title) ||
            title.includes(m.title.toLowerCase())
        );

        if (movie) {
          entries.push({
            movieId: movie.id,
            watchedAt: new Date(),
            source: selectedSource,
          });
        } else {
          skipped++;
        }
      }

      if (entries.length === 0) {
        setError('No matching movies found in the file. Make sure you exported the correct format.');
      } else {
        setResult({ imported: entries.length, skipped });
        onImport(entries);
      }
    } catch (err) {
      setError('Failed to process file. Please make sure it\'s a valid CSV file.');
    } finally {
      setIsProcessing(false);
    }
  }, [file, selectedSource, onImport]);

  const handleDemoImport = () => {
    // Import some random movies as demo
    const demoEntries: WatchHistoryEntry[] = mockMovies
      .slice(0, 10)
      .map((movie) => ({
        movieId: movie.id,
        watchedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        source: 'manual' as const,
      }));

    onImport(demoEntries);
    setResult({ imported: demoEntries.length, skipped: 0 });
  };

  const reset = () => {
    setSelectedSource(null);
    setFile(null);
    setError(null);
    setResult(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Watch History" size="lg">
      {!selectedSource && !result && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm mb-4">
            Import your watch history to help AI avoid recommending movies you&apos;ve already seen.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {sources.map((source) => (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id)}
                className="p-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-left transition-colors"
              >
                <div className="text-2xl mb-2">{source.icon}</div>
                <h4 className="font-medium text-white">{source.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{source.description}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <Button variant="secondary" className="w-full" onClick={handleDemoImport}>
              Try Demo Import (10 random movies)
            </Button>
          </div>
        </div>
      )}

      {selectedSource && !result && (
        <div className="space-y-4">
          <button
            onClick={reset}
            className="flex items-center gap-1 text-gray-400 hover:text-white text-sm"
          >
            <X className="w-4 h-4" />
            Change source
          </button>

          <Card variant="glass" padding="lg">
            <label className="block cursor-pointer">
              <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-600 rounded-xl hover:border-gray-500 transition-colors">
                {file ? (
                  <>
                    <FileText className="w-10 h-10 text-primary-400 mb-3" />
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-gray-500 text-sm">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-500 mb-3" />
                    <p className="text-gray-300">Click to upload CSV file</p>
                    <p className="text-gray-500 text-sm mt-1">
                      or drag and drop
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </Card>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={processFile}
            disabled={!file || isProcessing}
            isLoading={isProcessing}
          >
            Import Watch History
          </Button>
        </div>
      )}

      {result && (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Import Complete!</h3>
          <p className="text-gray-400 mb-4">
            {result.imported} movie{result.imported !== 1 ? 's' : ''} imported
            {result.skipped > 0 && `, ${result.skipped} skipped`}
          </p>
          <Button onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}
