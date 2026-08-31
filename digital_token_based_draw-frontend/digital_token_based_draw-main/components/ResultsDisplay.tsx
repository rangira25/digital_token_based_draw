'use client';

import { motion } from 'framer-motion';

interface DrawResult {
  tokenId: string;
  amount: number;
  timestamp: number;
}

interface ResultsDisplayProps {
  results: DrawResult[];
  compact?: boolean;
}

export function ResultsDisplay({ results, compact = false }: ResultsDisplayProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const totalDrawn = results.reduce((sum, r) => sum + r.amount, 0);
  const tokenStats = results.reduce(
    (acc, r) => {
      if (!acc[r.tokenId]) {
        acc[r.tokenId] = { count: 0, total: 0 };
      }
      acc[r.tokenId].count++;
      acc[r.tokenId].total += r.amount;
      return acc;
    },
    {} as Record<string, { count: number; total: number }>
  );

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-primary uppercase tracking-wider">Draws: {results.length}</span>
          <span className="text-xs text-slate-700 font-mono">Total: {totalDrawn}</span>
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {results.slice(-5).map((result, idx) => (
            <div key={idx} className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>
                <span className="text-primary">{result.tokenId}</span> ×{result.amount}
              </span>
              <span className="opacity-75">{formatTime(result.timestamp)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-mono font-bold text-slate-700 mb-2">Draw History</h3>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Total operations: {results.length}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="h-32 flex items-center justify-center border border-primary/20 rounded text-muted-foreground text-sm">
          No draws executed yet
        </div>
      ) : (
        <>
          <motion.div className="grid grid-cols-2 gap-3" layout>
            {Object.entries(tokenStats).map(([tokenId, stats], idx) => (
              <motion.div
                key={tokenId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="p-3 bg-card border border-primary/20 rounded text-center space-y-1"
              >
                <div className="text-primary font-mono font-bold">{tokenId}</div>
                <div className="text-xs text-muted-foreground">
                  <div>Draws: {stats.count}</div>
                  <div className="text-slate-700">Total: {stats.total}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            <div className="text-xs uppercase text-primary tracking-wider font-mono">Recent Operations</div>
            <motion.div layout className="space-y-2">
              {results.slice().reverse().map((result, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-between items-center p-2 bg-card/50 border border-primary/10 rounded text-xs font-mono"
                >
                  <span>
                    <span className="text-slate-700 font-bold">{result.tokenId}</span>
                    <span className="text-primary"> ×{result.amount}</span>
                  </span>
                  <span className="text-muted-foreground">{formatTime(result.timestamp)}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="p-3 bg-primary/10 border border-primary/30 rounded text-center font-mono">
            <div className="text-sm text-primary font-bold">Total Drawn</div>
            <div className="text-2xl text-slate-700">{totalDrawn}</div>
          </div>
        </>
      )}
    </div>
  );
}
