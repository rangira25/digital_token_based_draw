'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Token {
  id: string;
  count: number;
  limit: number;
}

interface TokenSetupProps {
  onSetup: (tokens: Token[]) => void;
}

export function TokenSetup({ onSetup }: TokenSetupProps) {
  const [tokens, setTokens] = useState<Token[]>([
    { id: 'A', count: 50, limit: 20 },
    { id: 'B', count: 30, limit: 15 },
    { id: 'C', count: 20, limit: 25 },
  ]);

  const updateToken = (index: number, field: keyof Token, value: number | string) => {
    const updated = [...tokens];
    if (field === 'id') {
      updated[index].id = String(value).toUpperCase();
    } else {
      updated[index][field] = Number(value);
    }
    setTokens(updated);
  };

  const addToken = () => {
    setTokens([
      ...tokens,
      { id: String.fromCharCode(65 + tokens.length), count: 0, limit: 10 },
    ]);
  };

  const removeToken = (index: number) => {
    setTokens(tokens.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-mono font-bold text-slate-700 mb-2">Token Configuration</h2>
        <p className="text-sm text-muted-foreground">Set up your tokens before entering the draw grid</p>
      </div>

      <div className="space-y-3">
        {tokens.map((token, idx) => (
          <div key={idx} className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs uppercase tracking-wider text-primary">ID</Label>
              <Input
                value={token.id}
                onChange={(e) => updateToken(idx, 'id', e.target.value)}
                className="bg-input border-border focus:border-slate-400 focus:font-mono text-sm"
                maxLength={2}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs uppercase tracking-wider text-primary">Count</Label>
              <Input
                type="number"
                value={token.count}
                onChange={(e) => updateToken(idx, 'count', e.target.value)}
                className="bg-input border-border focus:border-slate-400 focus:font-mono text-sm"
                min="0"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs uppercase tracking-wider text-primary">Limit/Draw</Label>
              <Input
                type="number"
                value={token.limit}
                onChange={(e) => updateToken(idx, 'limit', e.target.value)}
                className="bg-input border-border focus:border-slate-400 focus:font-mono text-sm"
                min="1"
              />
            </div>
            <Button
              onClick={() => removeToken(idx)}
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={addToken}
          variant="outline"
          className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          + Add Token
        </Button>
        <Button
          onClick={() => onSetup(tokens)}
          className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
        >
          Initialize System
        </Button>
      </div>
    </div>
  );
}
