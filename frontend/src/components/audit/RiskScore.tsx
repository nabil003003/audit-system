'use client';

import { motion, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

type Props = {
  riskScore: number;
  className?: string;
};

export function RiskScore({ riskScore, className = '' }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, Math.min(100, Math.max(0, riskScore)), {
      duration: 1.5,
      ease: 'easeOut',
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [riskScore]);

  const barColor =
    riskScore > 75 ? 'bg-red-500' : riskScore > 50 ? 'bg-orange-500' : riskScore > 25 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-[var(--foreground)] tabular-nums">{Math.round(display)}</span>
        <span className="text-sm text-[var(--muted-foreground)]">/ 100</span>
      </div>
      <div className="h-3 w-full rounded-full bg-[var(--muted)] overflow-hidden">
        <motion.div
          className={`h-3 rounded-full ${barColor}`}
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(100, Math.max(0, riskScore))}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
