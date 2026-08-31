'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

interface DrawSimulatorProps {
  selectedToken: Token;
  tokens: Token[];
  onDrawComplete: (result: DrawResult, updatedTokens: Token[]) => void;
}

export function DrawSimulator({ selectedToken, tokens, onDrawComplete }: DrawSimulatorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    if (!isDrawing) return;

    const totalTokens = tokens.reduce((sum, t) => sum + t.count, 0);

    if (totalTokens === 0) {
      setIsDrawing(false);
      return;
    }

    const animationDuration = 1000;
    const startTime = Date.now();
    let particleCount = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      setDisplayAmount(Math.floor(progress * selectedToken.count));

      if (particleCount < 15 && progress < 0.8) {
        setParticles((prev) => [
          ...prev,
          {
            id: Date.now() + particleCount,
            x: Math.random() * 100,
            y: Math.random() * 100,
          },
        ]);
        particleCount++;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const drawnAmount = Math.min(
          selectedToken.limit,
          Math.floor(Math.random() * selectedToken.limit) + 1
        );

        const updatedTokens = tokens.map((t) =>
          t.id === selectedToken.id
            ? { ...t, count: Math.max(0, t.count - drawnAmount) }
            : t
        );

        onDrawComplete(
          {
            tokenId: selectedToken.id,
            amount: drawnAmount,
            timestamp: Date.now(),
          },
          updatedTokens
        );

        setIsDrawing(false);
        setParticles([]);
        setDisplayAmount(0);
      }
    };

    requestAnimationFrame(animate);
  }, [isDrawing, selectedToken, tokens, onDrawComplete]);

  return (
    <div className="relative w-full aspect-video bg-gradient-to-br from-card to-card/50 border border-primary/30 rounded-lg overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />

      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-1 h-1 bg-slate-300 rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animation: `float-up 1s ease-out forwards`,
          }}
        />
      ))}

      <style>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px);
          }
        }
      `}</style>

      <motion.div
        className="text-center space-y-4 z-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="text-5xl font-mono font-bold text-slate-900">
          {displayAmount}
        </div>
        <div className="text-sm text-primary uppercase tracking-widest">
          {isDrawing ? 'Processing Draw...' : 'Draw Complete'}
        </div>
        <div className="text-xs text-muted-foreground">
          Token: <span className="text-slate-700 font-mono">{selectedToken.id}</span>
        </div>
      </motion.div>
    </div>
  );
}
