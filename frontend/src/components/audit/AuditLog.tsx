'use client';

import { motion, AnimatePresence } from 'framer-motion';

export type AuditLogStep = {
  id: number;
  icon: string;
  label: string;
  detail: string;
};

type Props = {
  steps: AuditLogStep[];
  activeStepId: number;
};

export function AuditLog({ steps, activeStepId }: Props) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <p className="text-sm font-semibold text-[var(--foreground)]">Journal d&apos;analyse</p>
      <AnimatePresence initial={false}>
        {steps.map((s) => {
          const active = s.id <= activeStepId;
          if (!active) return null;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2"
            >
              <span className="text-lg leading-none">{s.icon}</span>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">{s.label}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{s.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
