'use client';

import { motion, AnimatePresence } from 'framer-motion';

export type CitationPayload = {
  title: string;
  excerpt: string;
  source?: string;
  externalUrl?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  citation: CitationPayload | null;
};

export function LegalCitation({ open, onClose, citation }: Props) {
  return (
    <AnimatePresence>
      {open && citation && (
        <>
          <motion.button
            type="button"
            aria-label="Fermer le panneau"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-[var(--border)] glass-card p-6 shadow-2xl overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">{citation.title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap border-l-2 border-indigo-500/40 pl-3">
              {citation.excerpt}
            </p>
            {citation.source && (
              <p className="mt-4 text-xs text-[var(--muted-foreground)]">Source : {citation.source}</p>
            )}
            {citation.externalUrl && (
              <a
                href={citation.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-indigo-400 underline"
              >
                Ouvrir la référence externe
              </a>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
