'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FileText,
  Clock,
  CheckCircle,
  Brain,
  ArrowRight,
  ChevronRight,
  Circle,
  Loader2,
  RefreshCw,
  AlertCircle,
  BookOpen,
  Gavel,
  FlaskConical,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  AWAITING_DOCS: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  COMPLETED: 'bg-green-500/10 text-green-400 border border-green-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

// Auditor progress stages  
const WORK_STAGES = [
  { id: 'DRAFT', label: 'Début', description: 'Dossier reçu, en attente de démarrage', color: 'text-gray-400', dotColor: 'bg-gray-400', next: 'IN_PROGRESS' },
  { id: 'IN_PROGRESS', label: 'En cours', description: 'Analyse en cours', color: 'text-blue-400', dotColor: 'bg-blue-400', next: 'PENDING' },
  { id: 'PENDING', label: 'En révision', description: 'En révision par le responsable', color: 'text-yellow-400', dotColor: 'bg-yellow-400', next: 'COMPLETED' },
  { id: 'COMPLETED', label: 'Terminé', description: 'Audit finalisé et rapport remis', color: 'text-green-400', dotColor: 'bg-green-500', next: null },
];

function StageProgress({ status, auditId, onUpdate }: { status: string; auditId: string; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false);
  const currentIdx = WORK_STAGES.findIndex(s => s.id === status);
  const current = WORK_STAGES[currentIdx];
  const next = current?.next ? WORK_STAGES.find(s => s.id === current.next) : null;

  const advance = async () => {
    if (!next) return;
    setUpdating(true);
    try {
      await apiFetch(`/api/audits/${auditId}/status/${next.id}`, { method: 'PATCH' });
      toast.success(`Avancement → ${next.label}`);
      onUpdate();
    } catch (e: any) { toast.error(e.message); }
    finally { setUpdating(false); }
  };

  return (
    <div className="space-y-3">
      {/* Progress dots */}
      <div className="flex items-center gap-0">
        {WORK_STAGES.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 transition-all ${done ? s.dotColor : 'bg-[var(--border)]'} ${active ? 'ring-2 ring-offset-2 ring-offset-[var(--card)] ' + s.dotColor : ''}`} />
              {i < WORK_STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 transition-all ${i < currentIdx ? 'bg-blue-500' : 'bg-[var(--border)]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage labels */}
      <div className="flex justify-between">
        {WORK_STAGES.map((s, i) => (
          <span key={s.id} className={`text-xs ${i === currentIdx ? s.color + ' font-semibold' : 'text-[var(--muted-foreground)]'}`} style={{ width: '25%', textAlign: i === 0 ? 'left' : i === WORK_STAGES.length - 1 ? 'right' : 'center' }}>
            {s.label}
          </span>
        ))}
      </div>

      {/* Advance button */}
      {next && (
        <button
          onClick={advance}
          disabled={updating}
          className="flex items-center gap-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50">
          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3 w-3" />}
          Passer à : {next.label}
        </button>
      )}
    </div>
  );
}

export default function AuditorDashboard() {
  useAuth(['AUDITOR']);
  const { user } = useAuthStore();
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const loadAudits = () => {
    setLoading(true);
    apiFetch('/api/audits/mine?size=100')
      .then((data) => setAudits(data?.content ?? (Array.isArray(data) ? data : [])))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const loadAiAnalysis = async (auditId: string) => {
    setLoadingAi(true);
    setAiAnalysis(null);
    try {
      const res = await apiFetch(`/api/ai/result/${auditId}`);
      if (res && res.summary) {
        setAiAnalysis(res.summary);
      } else {
        setAiAnalysis(
          "Aucune analyse IA disponible pour le moment. Vérifiez que des documents ont été uploadés et générez l'analyse."
        );
      }
    } catch (e: any) {
      setAiAnalysis("Aucune analyse IA disponible. Lancez une analyse complète depuis le panneau ci-dessous.");
    } finally {
      setLoadingAi(false);
    }
  };

  const triggerAi = async (auditId: string) => {
    setLoadingAi(true);
    let attempts = 0;
    try {
      await apiFetch(`/api/ai/analyze/${auditId}`, { method: 'POST' });
      toast.success("Analyse lancée ! L'IA lit les documents (cela prend quelques secondes)...");

      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await apiFetch(`/api/ai/result/${auditId}`);
          if (res && res.summary) {
            setAiAnalysis(res.summary);
            setLoadingAi(false);
            clearInterval(interval);
            toast.success('Analyse terminée !');
          }
        } catch (e) {
          /* ignore during polling */
        }

        if (attempts > 12) {
          clearInterval(interval);
          setLoadingAi(false);
          toast.error("Analyse très longue. Les résultats s'afficheront plus tard.");
        }
      }, 3000);
    } catch (e: any) {
      toast.error(e.message);
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    loadAudits();
  }, []);

  useEffect(() => {
    if (selectedAudit?.id) {
      void loadAiAnalysis(selectedAudit.id);
    } else {
      setAiAnalysis(null);
    }
  }, [selectedAudit?.id]);

  const stats = [
    { label: 'Dossiers confiés', value: audits.length, icon: FileText, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Investigations à ouvrir', value: audits.filter((a) => a.status === 'DRAFT').length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Analyses en cours', value: audits.filter((a) => a.status === 'IN_PROGRESS').length, icon: FlaskConical, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Missions clôturées', value: audits.filter((a) => a.status === 'COMPLETED').length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-slate-950 via-cyan-950/80 to-blue-950/90 p-6 sm:p-8 text-white shadow-xl shadow-cyan-900/25">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.25),transparent_55%)] pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-200/90">Laboratoire d&apos;audit assisté</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Bonjour, {user?.fullName?.split(' ')[0] || 'Auditeur'}
            </h1>
            <p className="text-sm text-cyan-50/85 leading-relaxed">
              Votre espace concentre l&apos;analyse documentaire, la conformité réglementaire et l&apos;exploitation de
              l&apos;assistant IA RAG — rapprochements avec les textes applicables au Maroc, détection d&apos;anomalies
              et production des livrables d&apos;audit.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { icon: BookOpen, t: 'Pièces & écritures' },
                { icon: Gavel, t: 'Cadre juridique MA' },
                { icon: Brain, t: 'RAG & synthèses' },
              ].map(({ icon: I, t }) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-cyan-50/95"
                >
                  <I className="h-3.5 w-3.5 text-cyan-200" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {selectedAudit && (
              <Link
                href={`/audit/${selectedAudit.id}/analyse`}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg hover:bg-cyan-50 transition-colors"
              >
                <FlaskConical className="h-4 w-4" />
                Console d&apos;investigation
              </Link>
            )}
            <button
              onClick={loadAudits}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-cyan-50 hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser les dossiers
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`h-6 w-6 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{loading ? '—' : s.value}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content: dossiers list + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* List */}
        <div className="lg:col-span-5 glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Portefeuille technique</h2>
              <p className="text-[11px] text-[var(--muted-foreground)]">Dossiers confiés — investigation &amp; production des livrables</p>
            </div>
          </div>
          {loading ? (
            <div className="py-20 text-center text-[var(--muted-foreground)]">Chargement...</div>
          ) : audits.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <FileText className="h-12 w-12 mx-auto text-[var(--muted-foreground)]/40" />
              <p className="text-[var(--muted-foreground)]">Aucun dossier assigné</p>
              <p className="text-xs text-[var(--muted-foreground)]/60">Le manager vous assignera bientôt des audits</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]/50">
              {audits.map(a => (
                <div
                  key={a.id}
                  onClick={() => {
                    setSelectedAudit(a);
                  }}
                  className={`px-6 py-4 cursor-pointer transition-colors hover:bg-[var(--muted)]/30 ${selectedAudit?.id === a.id ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--foreground)] text-sm truncate">{a.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Client: {a.clientName}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0 ${STATUS_COLORS[a.status] || ''}`}>
                      {WORK_STAGES.find(s => s.id === a.status)?.label || a.status}
                    </span>
                  </div>
                  <StageProgress status={a.status} auditId={a.id} onUpdate={loadAudits} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-7 space-y-4">
          {!selectedAudit ? (
            <div className="glass rounded-2xl py-20 text-center">
              <Circle className="h-12 w-12 mx-auto text-[var(--muted-foreground)]/40 mb-3" />
              <p className="text-[var(--muted-foreground)]">Sélectionnez un dossier pour voir les détails</p>
            </div>
          ) : (
            <>
              {/* Dossier info */}
              <div className="glass rounded-2xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{selectedAudit.title}</h3>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">Client: <span className="text-[var(--foreground)]">{selectedAudit.clientName}</span></p>
                  </div>
                  <Link href={`/audit/${selectedAudit.id}`}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium glass px-3 py-1.5 rounded-lg transition-all">
                    Ouvrir le dossier <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[var(--muted-foreground)] text-xs mb-1">Statut actuel</p>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[selectedAudit.status] || ''}`}>
                      {WORK_STAGES.find(s => s.id === selectedAudit.status)?.label || selectedAudit.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)] text-xs mb-1">Échéance</p>
                    <p className="text-[var(--foreground)] text-xs">
                      {selectedAudit.deadline ? new Date(selectedAudit.deadline).toLocaleDateString('fr-FR') : 'Non définie'}
                    </p>
                  </div>
                </div>

                {selectedAudit.description && (
                  <div>
                    <p className="text-[var(--muted-foreground)] text-xs mb-1">Description</p>
                    <p className="text-sm text-[var(--foreground)]">{selectedAudit.description}</p>
                  </div>
                )}

                {/* Stage advancement */}
                <div className="bg-[var(--muted)]/50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Avancement du dossier</p>
                  <StageProgress status={selectedAudit.status} auditId={selectedAudit.id} onUpdate={() => {
                    loadAudits();
                    // Update selected audit status locally
                    const stage = WORK_STAGES.find(s => s.id === selectedAudit.status);
                    if (stage?.next) setSelectedAudit((prev: any) => ({ ...prev, status: stage.next }));
                  }} />
                  <div className="mt-3 space-y-2">
                    {WORK_STAGES.map((s, i) => {
                      const currentIdx = WORK_STAGES.findIndex(x => x.id === selectedAudit.status);
                      const done = i <= currentIdx;
                      return (
                        <div key={s.id} className={`flex items-center gap-3 text-xs ${done ? '' : 'opacity-50'}`}>
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${done ? s.dotColor : 'bg-[var(--border)]'}`} />
                          <span className={done ? s.color : 'text-[var(--muted-foreground)]'}>{s.label}</span>
                          <span className="text-[var(--muted-foreground)]">—</span>
                          <span className="text-[var(--muted-foreground)]">{s.description}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="glass rounded-2xl p-6 space-y-4 border border-cyan-500/25 shadow-lg shadow-cyan-500/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <Brain className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)]">Assistant IA &amp; RAG juridique (Maroc)</h3>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Lecture des pièces, rapprochements réglementaires et pré-synthèses pour vos rapports.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/audit/${selectedAudit.id}/analyse`}
                    className="inline-flex items-center gap-1.5 self-start rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/15 transition-colors"
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Espace analyse avancée
                  </Link>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
                      Requêtes contextuelles
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        readOnly
                        value=""
                        placeholder="Les interrogations fines sur le dossier se pilotent depuis la console d'investigation."
                        className="w-full cursor-not-allowed bg-[var(--muted)]/40 border border-cyan-500/20 text-[var(--muted-foreground)] rounded-xl px-4 py-3 text-sm pr-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-cyan-600/80 dark:text-cyan-300/80">
                        RAG
                      </span>
                    </div>
                  </div>

                  {loadingAi && (
                    <div className="flex items-center gap-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                      Chargement de l&apos;analyse IA pour ce dossier…
                    </div>
                  )}

                  {aiAnalysis && !loadingAi ? (
                    <div className="space-y-4">
                      <div className="bg-[var(--muted)]/50 rounded-xl p-4 border border-cyan-500/15">
                        <div className="flex items-center gap-2 mb-2 text-cyan-600 dark:text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
                          <Brain className="h-3 w-3" /> Synthèse assistée
                        </div>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">{aiAnalysis}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest px-1">
                          Pistes d&apos;anomalies (exemple)
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] px-1 -mt-1">
                          Affinées automatiquement après génération complète et croisement avec les textes marocains.
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { label: 'Discordance TVA / trésorerie', severity: 'Élevée' },
                            { label: 'Rapprochement bancaire incomplet (période N)', severity: 'Moyenne' },
                          ].map((anom, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10"
                            >
                              <div className="flex items-center gap-3">
                                <AlertCircle
                                  className={`h-4 w-4 ${anom.severity === 'Élevée' ? 'text-red-400' : 'text-orange-400'}`}
                                />
                                <span className="text-xs font-medium text-[var(--foreground)]">{anom.label}</span>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                                  anom.severity === 'Élevée'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-orange-500/20 text-orange-400'
                                }`}
                              >
                                {anom.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => triggerAi(selectedAudit.id)}
                          className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-500 transition-all shadow-md shadow-cyan-500/20"
                        >
                          Relancer une analyse complète
                        </button>
                        <button
                          type="button"
                          onClick={() => void loadAiAnalysis(selectedAudit.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition-colors"
                        >
                          Rafraîchir le résumé
                        </button>
                      </div>
                    </div>
                  ) : !loadingAi ? (
                    <div className="py-10 text-center space-y-4">
                      <div className="h-16 w-16 mx-auto rounded-2xl bg-cyan-500/5 flex items-center justify-center">
                        <Brain className="h-8 w-8 text-cyan-400/30" />
                      </div>
                      <div>
                        <p className="text-[var(--muted-foreground)] text-sm">
                          Lancez une lecture IA des pièces pour obtenir une première carte des risques et citations
                          utiles au rapport.
                        </p>
                        <button
                          type="button"
                          onClick={() => triggerAi(selectedAudit.id)}
                          className="mt-4 px-6 py-2.5 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-500/20"
                        >
                          Générer une analyse complète
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
