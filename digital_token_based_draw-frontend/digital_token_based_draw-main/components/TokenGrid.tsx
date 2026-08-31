'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface Token {
  id: string;
  count: number;
  limit: number;
}

interface TokenGridProps {
  tokens: Token[];
  onDraw: (selectedToken: Token) => void;
  onBack: () => void;
}

export function TokenGrid({ tokens, onDraw, onBack }: TokenGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const isTokenAvailable = (token: Token) => token.count > 0;

  const handleTokenClick = (token: Token) => {
    if (isTokenAvailable(token)) {
      setSelectedId(token.id);
    }
  };

  const handleDraw = () => {
    const selected = tokens.find((t) => t.id === selectedId);
    if (selected) {
      onDraw(selected);
      setSelectedId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-mono font-bold text-slate-700 mb-2">Neural Matrix</h2>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Select a token and execute draw command
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 p-4 bg-card border border-primary/20 rounded-lg">
        {tokens.map((token) => {
          const isSelected = token.id === selectedId;
          const isHovered = token.id === hoverId;
          const isAvailable = isTokenAvailable(token);

          return (
            <motion.button
              key={token.id}
              onClick={() => handleTokenClick(token)}
              onMouseEnter={() => setHoverId(token.id)}
              onMouseLeave={() => setHoverId(null)}
              animate={isSelected ? { scale: 1.05 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`
                aspect-square rounded border-2 font-mono font-bold text-sm
                transition-all duration-300 relative overflow-hidden
                ${
                  isSelected
                    ? 'border-slate-300 bg-slate-100'
                    : isHovered && isAvailable
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-primary/20 bg-card'
                }
                ${!isAvailable && 'opacity-30 cursor-not-allowed'}
                ${isAvailable && 'cursor-pointer hover:border-primary/40'}
              `}
              disabled={!isAvailable}
            >
              <div className="flex flex-col items-center justify-center h-full gap-1">
                <span className={isSelected ? 'text-slate-700' : isAvailable ? 'text-primary' : 'text-muted-foreground'}>
                  {token.id}
                </span>
                <span className="text-xs opacity-75">{token.count}</span>
              </div>
              {(isSelected || isHovered) && isAvailable && (
                <div className="absolute inset-0 border-2 border-slate-200 rounded animate-pulse" />
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {tokens.map((token) => (
          <div key={token.id} className="p-2 bg-card border border-primary/20 rounded text-center font-mono">
            <div className="text-primary font-bold">{token.id}</div>
            <div className="text-muted-foreground text-[10px]">
              {token.count} / L:{token.limit}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 border-primary/30 text-primary hover:bg-primary/5"
        >
          ← Back
        </Button>
        <Button
          onClick={handleDraw}
          disabled={!selectedId}
          className={`flex-1 font-mono font-bold uppercase text-xs ${
            selectedId ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-muted opacity-50'
          }`}
        >
          Execute Draw
        </Button>
      </div>
    </div>
  );
}
