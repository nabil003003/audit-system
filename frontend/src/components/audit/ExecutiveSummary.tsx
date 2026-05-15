'use client';

import { RiskScore } from '@/components/audit/RiskScore';

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

type Props = {
  riskScore: number;
  violationsCount: number;
  sourcesCount: number;
  modelName: string;
};

export function ExecutiveSummary({ riskScore, violationsCount, sourcesCount, modelName }: Props) {
  return (
    <div className="sticky top-4 z-10 glass-card p-6 mb-8 border-gradient rounded-2xl">
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Résumé exécutif</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="md:col-span-1">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">Score de risque</p>
          <RiskScore riskScore={riskScore} />
        </div>
        <Metric label="Violations" value={violationsCount} />
        <Metric label="Sources analysées" value={sourcesCount} />
        <Metric label="Modèle utilisé" value={modelName} />
      </div>
      <p className="text-xs text-[var(--muted-foreground)] mt-4">
        Analyse indicative — ne constitue pas un avis juridique.
      </p>
    </div>
  );
}
