'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Brain,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  BookOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AuditLog, type AuditLogStep } from '@/components/audit/AuditLog';
import { ExecutiveSummary } from '@/components/audit/ExecutiveSummary';
import { LegalCitation, type CitationPayload } from '@/components/audit/LegalCitation';

const RAG_API = '/api/rag';

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: 'CRITIQUE', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  HIGH: { label: 'ÉLEVÉ', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  MEDIUM: { label: 'MODÉRÉ', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  LOW: { label: 'FAIBLE', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
};

const SEV_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CRITICAL: { label: 'Critique', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-400' },
  HIGH: { label: 'Élevé', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-orange-400' },
  MEDIUM: { label: 'Modéré', icon: <Clock className="h-4 w-4" />, color: 'text-yellow-400' },
  LOW: { label: 'Faible', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-400' },
};

const SEVERITY_BADGES: Record<string, { color: string; icon: string }> = {
  CRITIQUE: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '🔴' },
  ÉLEVÉ: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: '🟠' },
  MOYEN: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '🟡' },
  FAIBLE: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '🟢' },
};

function phaseToStepId(phase: string | undefined): number {
  switch (phase) {
    case 'queued':
      return 1;
    case 'index_ready':
      return 1;
    case 'downloading':
      return 2;
    case 'retrieving':
      return 3;
    case 'llm':
    case 'parsing':
      return 4;
    case 'report':
    case 'done':
      return 5;
    default:
      return 1;
  }
}

export default function AnalysePage() {
  useAuth(['AUDITOR']);
  const { id } = useParams() as { id: string };
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [ragHealth, setRagHealth] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'streaming' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState('');
  const [phase, setPhase] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [citationOpen, setCitationOpen] = useState(false);
  const [citation, setCitation] = useState<CitationPayload | null>(null);
  const [streamText, setStreamText] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const auditSteps: AuditLogStep[] = useMemo(
    () => [
      { id: 1, icon: '✅', label: 'Index juridique chargé', detail: `${(ragHealth as { chunks_indexed?: number })?.chunks_indexed ?? '—'} chunks prêts` },
      { id: 2, icon: '📄', label: 'Contrat extrait', detail: `${docs.length} fichier(s) envoyé(s)` },
      { id: 3, icon: '🔍', label: 'Recherche vectorielle MMR', detail: 'k=4, diversité maximale' },
      { id: 4, icon: '🤖', label: 'Mistral analyse les clauses', detail: 'température: 0.1' },
      { id: 5, icon: '📝', label: 'Génération du rapport', detail: 'Word en préparation…' },
    ],
    [ragHealth, docs.length],
  );

  useEffect(() => {
    void loadData();
    void checkRagHealth();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  const loadData = async () => {
    try {
      const [a, d] = await Promise.all([
        apiFetch(`/api/audits/${id}`),
        apiFetch(`/api/documents/audit/${id}`),
      ]);
      setAudit(a as Record<string, unknown>);
      setDocs(Array.isArray(d) ? (d as Record<string, unknown>[]) : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const checkRagHealth = async () => {
    try {
      const res = await fetch(`${RAG_API}/health`);
      if (res.ok) setRagHealth((await res.json()) as Record<string, unknown>);
      else setRagHealth(null);
    } catch {
      setRagHealth(null);
    }
  };

  const startAnalysis = async () => {
    if (!ragHealth) {
      toast.error("Le service RAG n'est pas démarré.");
      return;
    }
    setStatus('streaming');
    setResult(null);
    setErrorMsg('');
    setTaskId(null);
    setStreamText('');

    try {
      setStep('Préparation des documents…');
      const documentUrls = docs.map((doc) => ({
        filename: doc.fileName,
        download_url: doc.downloadUrl,
        doc_id: doc.id,
      }));

      const payload = {
        audit_id: id,
        audit_title: (audit?.title as string) || 'Audit',
        audit_description: (audit?.description as string) || '',
        document_urls: documentUrls,
        document_texts: [],
      };

      setStep('Génération par IA en cours...');
      const res = await fetch(`${RAG_API}/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Erreur RAG : ${res.status}`);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
          
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              const dataStr = line.replace(/^data:\s*/, '').trim();
              if (!dataStr) continue;
              try {
                const data = JSON.parse(dataStr);
                if (data.chunk) {
                  fullText += data.chunk;
                  setStreamText(fullText);
                }
              } catch (e) {}
            }
          }
        }
      }

      setStep('Sauvegarde et génération du rapport...');
      
      const saveRes = await fetch(`${RAG_API}/analyze/save_result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_id: id,
          rag_text: fullText,
          model_used: ragHealth.model || 'mistral',
        }),
      });
      
      if (!saveRes.ok) throw new Error("Erreur lors de la sauvegarde du rapport");
      const savedData = await saveRes.json();
      setTaskId(savedData.task_id);
      
      // Fetch final parsed status
      const statusRes = await fetch(`${RAG_API}/analyze/${savedData.task_id}/status`);
      const data = await statusRes.json();
      if (data.status === 'done') {
        const resultRes = await fetch(`${RAG_API}/analyze/${savedData.task_id}/result`);
        const finalResult = await resultRes.json();
        setResult(finalResult);
        setStatus('done');
        toast.success('Analyse terminée');
      } else {
        setStatus('error');
        setErrorMsg('Erreur lors de la récupération du rapport final');
      }

    } catch (e: unknown) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const downloadReport = () => {
    if (!taskId) {
      toast.error('Identifiant de tâche indisponible — relancez l’analyse.');
      return;
    }
    window.open(`${RAG_API}/report/${taskId}/download`, '_blank');
  };

  const openCitation = (title: string, excerpt: string, source?: string) => {
    setCitation({ title, excerpt, source });
    setCitationOpen(true);
  };

  const risk = result ? (RISK_CONFIG[(result.risk_level as string) || 'LOW'] || RISK_CONFIG.LOW) : null;
  const activeStep = phaseToStepId(phase);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link
          href={`/audit/${id}`}
          className="h-10 w-10 glass rounded-xl flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-400" />
            Analyse RAG juridique marocaine
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {(audit?.title as string) || '…'} — Comparaison avec le droit marocain (base locale)
          </p>
        </div>
      </div>

      <div
        className={`glass rounded-2xl p-4 border flex items-center gap-4 ${
          ragHealth ? 'border-green-500/20' : 'border-red-500/20'
        }`}
      >
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            ragHealth ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}
        >
          <Shield className={`h-5 w-5 ${ragHealth ? 'text-green-400' : 'text-red-400'}`} />
        </div>
        <div className="flex-1">
          <p className={`font-medium text-sm ${ragHealth ? 'text-green-400' : 'text-red-400'}`}>
            {ragHealth ? 'Service RAG connecté' : 'Service RAG non disponible'}
          </p>
          {ragHealth ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              Base : {(ragHealth.chunks_indexed as number)?.toLocaleString?.() ?? ragHealth.chunks_indexed} chunks indexés •
              Modèles : {(ragHealth.models_available as string[])?.join(', ')}
            </p>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              Lancez :{' '}
              <code className="bg-[var(--muted)] px-1 rounded">cd audit_rag_maroc &amp;&amp; uvicorn main:app --port 8000</code>
            </p>
          )}
        </div>
        <button type="button" onClick={() => void checkRagHealth()} className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
          <RefreshCw className="h-4 w-4 text-[var(--muted-foreground)]" />
        </button>
      </div>

      <div className="glass rounded-2xl p-5 border border-[var(--border)]">
        <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-blue-400" /> Documents à analyser ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Aucun document uploadé sur cet audit.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={String(d.id)} className="flex items-center gap-3 px-3 py-2 bg-[var(--muted)]/40 rounded-xl">
                <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <span className="text-sm text-[var(--foreground)] flex-1">{String(d.fileName)}</span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {((d.fileSize as number) / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {status === 'idle' || status === 'error' ? (
        <div className="flex flex-col items-center gap-4 py-4">
          {status === 'error' && (
            <div className="w-full glass rounded-xl p-4 border border-red-500/20 text-red-400 text-sm">Erreur : {errorMsg}</div>
          )}
          <button
            type="button"
            onClick={() => void startAnalysis()}
            disabled={!ragHealth}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-base font-semibold hover:opacity-90 transition-all shadow-xl shadow-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Brain className="h-5 w-5" />
            Lancer l&apos;analyse juridique RAG
          </button>
          <p className="text-xs text-[var(--muted-foreground)] text-center max-w-md">
            L&apos;analyse compare les documents avec la base de droit marocain et génère un rapport Word téléchargeable.
          </p>
        </div>
      ) : status === 'loading' || status === 'running' || status === 'streaming' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass rounded-2xl p-6 flex flex-col gap-4 border border-indigo-500/20 max-h-[600px] overflow-hidden">
            <div className="flex items-center gap-4 border-b border-[var(--border)] pb-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-indigo-400" />
                </div>
                {status !== 'streaming' && <Loader2 className="h-12 w-12 text-indigo-400 absolute inset-0 animate-spin opacity-30" />}
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Analyse en cours…</p>
                <p className="text-xs text-[var(--muted-foreground)]">{step}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {status === 'streaming' ? (
                <div className="text-sm font-mono whitespace-pre-wrap text-[var(--foreground)] leading-relaxed">
                  {streamText || 'Connexion au modèle Mistral en cours...'}
                  <span className="inline-block w-2 h-4 ml-1 bg-indigo-400 animate-pulse" />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[var(--muted-foreground)] text-sm">
                  <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-400/50" />
                  Initialisation du moteur d&apos;IA...
                </div>
              )}
            </div>
          </div>
          <AuditLog steps={auditSteps} activeStepId={activeStep} />
        </div>
      ) : null}

      {status === 'done' && result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="space-y-6">
          {result.no_documents === true && (
            <div className="glass rounded-2xl p-8 border border-orange-500/20 flex flex-col items-center gap-4 text-center">
              <FileText className="h-8 w-8 text-orange-400" />
              <p className="font-semibold text-lg text-orange-400">Documents requis</p>
              <p className="text-sm text-[var(--muted-foreground)] max-w-md">{String(result.summary)}</p>
              <Link
                href={`/audit/${id}`}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4" /> Retour à l&apos;audit pour uploader des documents
              </Link>
            </div>
          )}

          {result.ollama_required === true && (
            <div className="glass rounded-2xl p-8 border border-yellow-500/20 text-center space-y-3">
              <Brain className="h-8 w-8 text-yellow-400 mx-auto" />
              <p className="font-semibold text-lg text-yellow-400">Ollama requis</p>
              <p className="text-sm text-[var(--muted-foreground)]">{String(result.summary)}</p>
              <button
                type="button"
                onClick={() => void startAnalysis()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold"
              >
                <RefreshCw className="h-4 w-4" /> Réessayer
              </button>
            </div>
          )}

          {result.no_documents !== true && result.ollama_required !== true && (
            <>
              <ExecutiveSummary
                riskScore={Number(result.risk_score) || 0}
                violationsCount={Array.isArray(result.violations) ? result.violations.length : 0}
                sourcesCount={Array.isArray(result.sources) ? result.sources.length : 0}
                modelName={String(result.model_used || '—')}
              />

              <div className="glass rounded-2xl p-6 border border-[var(--border)] flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className={`text-5xl font-bold ${risk?.color}`}>{Number(result.risk_score)}</div>
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">Score de risque juridique</p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-lg text-sm font-bold ${risk?.bg} ${risk?.color} border ${risk?.border}`}>
                      {risk?.label}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-40">
                  <div className="h-3 w-full rounded-full bg-[var(--muted)]">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        Number(result.risk_score) > 70
                          ? 'bg-red-500'
                          : Number(result.risk_score) > 40
                            ? 'bg-orange-500'
                            : Number(result.risk_score) > 20
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                      }`}
                      style={{ width: `${Number(result.risk_score)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto flex-wrap">
                  {typeof result.report_filename === 'string' && result.report_filename.length > 0 && (
                    <button
                      type="button"
                      onClick={downloadReport}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-semibold"
                    >
                      <Download className="h-4 w-4" /> Télécharger rapport Word
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void startAnalysis()}
                    className="flex items-center gap-2 px-4 py-2.5 glass border border-[var(--border)] rounded-xl text-sm"
                  >
                    <RefreshCw className="h-4 w-4" /> Relancer
                  </button>
                </div>
              </div>

              <div className="glass rounded-2xl p-5 border border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-3">
                  <Brain className="h-5 w-5 text-indigo-400" /> Résumé de l&apos;analyse
                </h2>
                <p className="text-sm text-[var(--foreground)] leading-relaxed">{String(result.summary)}</p>
              </div>

              {typeof result.analyse_globale === 'string' && result.analyse_globale.trim().length > 0 && (
                <div className="glass rounded-2xl p-5 border border-[var(--border)]">
                  <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-3">
                    <BookOpen className="h-5 w-5 text-indigo-400" /> Analyse Globale Détaillée
                  </h2>
                  <div className="text-sm font-mono whitespace-pre-wrap text-[var(--foreground)] leading-relaxed bg-[var(--muted)]/20 p-4 rounded-xl border border-[var(--border)]">
                    {result.analyse_globale}
                  </div>
                </div>
              )}

              <div className="glass rounded-2xl overflow-hidden border border-[var(--border)]">
                <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                  <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" /> Non-conformités détectées
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  {!Array.isArray(result.violations) || result.violations.length === 0 ? (
                    <div className="flex items-center gap-3 py-6 justify-center text-green-400">
                      <CheckCircle className="h-6 w-6" />
                      <p>Aucune non-conformité détectée</p>
                    </div>
                  ) : (
                    (result.violations as Record<string, unknown>[]).map((v, i: number) => {
                      const sevKey = (v.severite as string) || 'MEDIUM';
                      const sc = SEV_CONFIG[sevKey] || SEV_CONFIG.MEDIUM;
                      const badgeKey =
                        sevKey === 'CRITICAL'
                          ? 'CRITIQUE'
                          : sevKey === 'HIGH'
                            ? 'ÉLEVÉ'
                            : sevKey === 'MEDIUM'
                              ? 'MOYEN'
                              : 'FAIBLE';
                      const bd = SEVERITY_BADGES[badgeKey] || SEVERITY_BADGES.MOYEN;
                      return (
                        <div key={i} className="bg-[var(--muted)]/40 rounded-xl p-4 border border-[var(--border)]/50 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={sc.color}>{sc.icon}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${bd.color}`}>
                              {bd.icon} {badgeKey}
                            </span>
                            <p className="font-semibold text-sm text-[var(--foreground)]">{String(v.titre)}</p>
                          </div>
                          {typeof v.texte_original === 'string' && v.texte_original.length > 0 && (
                            <p className="text-xs text-[var(--muted-foreground)]">
                              <span className="font-medium">Texte : </span>
                              {String(v.texte_original)}
                            </p>
                          )}
                          {typeof v.citation === 'string' && v.citation.length > 0 && (
                            <button
                              type="button"
                              className="text-left w-full text-xs text-indigo-300 italic border-l-2 border-indigo-500/40 pl-2 hover:bg-indigo-500/10 rounded-r"
                              onClick={() =>
                                openCitation('Citation légale', String(v.citation), v.source ? String(v.source) : undefined)
                              }
                            >
                              « {String(v.citation)} »
                            </button>
                          )}
                          {typeof v.source === 'string' && v.source.length > 0 && (
                            <p className="text-xs text-[var(--muted-foreground)]/70">Source : {String(v.source)}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {Array.isArray(result.sources) && result.sources.length > 0 && (
                <div className="glass rounded-2xl p-5 border border-[var(--border)]">
                  <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                    Sources juridiques marocaines ({result.sources.length})
                  </h2>
                  <div className="space-y-3">
                    {(result.sources as Record<string, unknown>[]).map((s, i: number) => (
                      <button
                        type="button"
                        key={i}
                        className="w-full text-left bg-[var(--muted)]/30 rounded-xl p-3 border border-[var(--border)]/40 hover:border-indigo-500/40 transition-colors"
                        onClick={() =>
                          openCitation(
                            String(s.fichier || 'Source'),
                            String(s.extrait || ''),
                            s.categorie ? String(s.categorie) : undefined,
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                          <p className="font-medium text-sm text-[var(--foreground)]">{String(s.fichier)}</p>
                        </div>
                        {typeof s.extrait === 'string' && s.extrait.length > 0 && (
                          <p className="text-xs text-[var(--muted-foreground)] mt-1 ml-6 italic">« {String(s.extrait)} »</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(result.recommandations) && result.recommandations.length > 0 && (
                <div className="glass rounded-2xl p-5 border border-[var(--border)]">
                  <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-400" /> Recommandations
                  </h2>
                  <div className="space-y-3">
                    {(result.recommandations as Record<string, unknown>[]).map((r, i: number) => (
                      <div key={i} className="flex gap-3 bg-[var(--muted)]/30 rounded-xl p-3">
                        <div>
                          <p className="text-sm text-[var(--foreground)]">{String(r.action)}</p>
                          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            Responsable : {String(r.responsable)}
                            {r.reference ? ` • Réf : ${String(r.reference)}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`glass rounded-2xl p-5 border ${risk?.border}`}>
                <h2 className={`font-semibold flex items-center gap-2 mb-2 ${risk?.color}`}>
                  <Shield className="h-5 w-5" /> Conclusion
                </h2>
                <p className="text-sm text-[var(--foreground)] leading-relaxed">{String(result.conclusion)}</p>
              </div>
            </>
          )}
        </motion.div>
      )}

      <LegalCitation open={citationOpen} onClose={() => setCitationOpen(false)} citation={citation} />
    </div>
  );
}
