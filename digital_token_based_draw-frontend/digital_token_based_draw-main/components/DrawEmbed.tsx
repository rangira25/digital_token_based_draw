'use client';

import { useState } from 'react';
import { TokenSetup } from '@/components/TokenSetup';
import { TokenGrid } from '@/components/TokenGrid';
import { DrawSimulator } from '@/components/DrawSimulator';
import { ResultsDisplay } from '@/components/ResultsDisplay';

interface Token {
  id: string;
  count: number;
  limit: number;
}

interface DrawResult {
  tokenId: string;
  amount: number;
  timestamp: number;
}

type AppState = 'setup' | 'grid' | 'draw' | null;

export function DrawEmbed({ title = 'Token Draw Simulator' }: { title?: string }) {
  const [state, setState] = useState<AppState>('setup');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [results, setResults] = useState<DrawResult[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSetup = (initialTokens: Token[]) => {
    setTokens(initialTokens);
    setState('grid');
  };

  const handleSelectToken = (token: Token) => {
    setSelectedToken(token);
    setState('draw');
    setIsSimulating(true);
  };

  const handleDrawComplete = (result: DrawResult, updatedTokens: Token[]) => {
    setResults((prev) => [result, ...prev]);
    setTokens(updatedTokens);
    setIsSimulating(false);
    setTimeout(() => {
      setState('grid');
    }, 500);
  };

  const handleReset = () => {
    setState('setup');
    setTokens([]);
    setSelectedToken(null);
    setResults([]);
    setIsSimulating(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Setup & Grid */}
        <div className="space-y-4">
          {state === 'setup' && (
            <TokenSetup onSetup={handleSetup} />
          )}

          {state === 'grid' && tokens.length > 0 && (
            <TokenGrid
              tokens={tokens}
              onDraw={handleSelectToken}
              onBack={() => setState('setup')}
            />
          )}

          {state === 'draw' && selectedToken && (
            <DrawSimulator
              selectedToken={selectedToken}
              tokens={tokens}
              onDrawComplete={handleDrawComplete}
            />
          )}
        </div>

        {/* Right: Results */}
        {state !== 'setup' && (
          <ResultsDisplay results={results} />
        )}
      </div>

      {state !== 'setup' && (
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors text-sm font-medium"
        >
          Reset Simulator
        </button>
      )}
    </div>
  );
}
