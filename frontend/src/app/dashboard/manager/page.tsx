'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FileText,
  Clock,
  CheckCircle,
  Activity,
  Users,
  UserCheck,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Timer,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  AWAITING_DOCS: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  COMPLETED: 'bg-green-500/10 text-green-400 border border-green-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  IN_PROGRESS: 'En cours',
  AWAITING_DOCS: 'Docs manquants',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

const PROGRESS_STEPS = [
  { key: 'DRAFT', label: 'Soumis', step: 1 },
  { key: 'PENDING', label: 'En attente', step: 2 },
  { key: 'IN_PROGRESS', label: 'En cours', step: 3 },
  { key: 'COMPLETED', label: 'Terminé', step: 4 },
];

function ProgressBar({ status }: { status: string }) {
  const current = PROGRESS_STEPS.find(s => s.key === status)?.step ?? 1;
  return (
    <div className="flex items-center gap-1 mt-2">
      {PROGRESS_STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 flex-1">
          <div className={`h-1.5 flex-1 rounded-full transition-all ${s.step <= current ? 'bg-blue-500' : 'bg-[var(--border)]'}`} />
          {i < PROGRESS_STEPS.length - 1 && <div className={`h-1.5 w-1.5 rounded-full ${s.step < current ? 'bg-blue-500' : 'bg-[var(--border)]'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function ManagerDashboard() {
  useAuth(['MANAGER', 'ADMIN']);
  const [audits, setAudits] = useState<any[]>([]);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attribution' | 'suivi' | 'temps'>('attribution');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [timeStats, setTimeStats] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, audRes, tRes] = await Promise.all([
        apiFetch('/api/audits?size=100'),
        apiFetch('/api/users?role=AUDITOR&size=100'),
        apiFetch('/api/audits/time/all-stats'),
      ]);
      setAudits(aRes?.content ?? (Array.isArray(aRes) ? aRes : []));
      setAuditors(audRes?.content ?? (Array.isArray(audRes) ? audRes : []));
      setTimeStats(tRes || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const assignAuditor = async (auditId: string, auditorId: string) => {
    if (!auditorId) return;
    setAssigning(auditId);
    try {
      await apiFetch(`/api/audits/${auditId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ auditorId }),
      });
      toast.success('Auditeur assigné avec succès');
      loadData();
    } catch (e: any) { toast.error(e.message); }
    finally { setAssigning(null); }
  };

  const changeStatus = async (auditId: string, newStatus: string) => {
    try {
      await apiFetch(`/api/audits/${auditId}/status/${newStatus}`, { method: 'PATCH' });
      toast.success('Statut mis à jour');
      loadData();
    } catch (e: any) { toast.error(e.message); }
  };

  const unassigned = audits.filter(a => !a.auditorName);
  const inProgress = audits.filter(a => a.status === 'IN_PROGRESS');
  const completed = audits.filter(a => a.status === 'COMPLETED');

  const stats = [
    { label: 'Dossiers suivis', value: audits.length, icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Sans auditeur', value: unassigned.length, icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'En production', value: inProgress.length, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Livrés / clos', value: completed.length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  // Group audits by auditor for the suivi tab
  const byAuditor: Record<string, { auditor: string; audits: any[] }> = {};
  audits.forEach(a => {
    const key = a.auditorName || '__unassigned__';
    if (!byAuditor[key]) byAuditor[key] = { auditor: a.auditorName || 'Non assigné', audits: [] };
    byAuditor[key].audits.push(a);
  });

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-950/85 via-orange-950/75 to-slate-950/90 p-6 sm:p-8 text-white shadow-xl shadow-amber-900/25">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,0.2),transparent_50%)] pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-200/90">Pilotage opérationnel</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Centre de pilotage des missions d&apos;audit</h1>
            <p className="text-sm text-amber-50/85 leading-relaxed">
              Attribution des dossiers, suivi des équipes, lecture de la charge et <strong>contrôle qualité</strong> avant
              livraison officielle. Votre périmètre couvre l&apos;organisation du cabinet — pas l&apos;infrastructure
              ni les mécanismes internes de l&apos;IA juridique, réservés à l&apos;administration et aux auditeurs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-amber-50/95">
              <ClipboardCheck className="h-4 w-4 text-amber-200" />
              Validation qualitative des rapports
            </span>
            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-amber-50/95">
              <Sparkles className="h-4 w-4 text-amber-200" />
              Coordination &amp; productivité
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm glass px-3 py-2 rounded-xl transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
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

      {/* Tabs */}
      <div className="flex gap-1 glass rounded-xl p-1 w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('attribution')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'attribution'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Attribution
        </button>
        <button
          onClick={() => setActiveTab('suivi')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'suivi'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Suivi &amp; charge
        </button>
        <button
          onClick={() => setActiveTab('temps')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'temps'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Timer className="h-4 w-4" />
          Temps &amp; productivité
        </button>
      </div>

      {/* Tab: Attribution */}
      {activeTab === 'attribution' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Attribution Auditeur ↔ Client</h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Assignez un auditeur à chaque dossier client</p>
            </div>
            <span className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-lg">
              {unassigned.length} dossier(s) sans auditeur
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                  {['Dossier', 'Client', 'Statut', 'Auditeur actuel', 'Affecter un auditeur', 'Actions'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">Chargement...</td></tr>
                ) : audits.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">Aucun audit trouvé</td></tr>
                ) : audits.map(a => (
                  <tr key={a.id} className={`border-b border-[var(--border)]/50 hover:bg-[var(--muted)]/30 transition-colors ${!a.auditorName ? 'bg-orange-500/5' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-[var(--foreground)]">{a.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {a.deadline ? new Date(a.deadline).toLocaleDateString('fr-FR') : 'Sans échéance'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                          {a.clientName?.[0] || '?'}
                        </div>
                        <span className="text-[var(--foreground)] text-sm">{a.clientName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${STATUS_COLORS[a.status] || ''}`}>
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {a.auditorName ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">
                            {a.auditorName[0]}
                          </div>
                          <span className="text-[var(--foreground)] text-sm">{a.auditorName}</span>
                        </div>
                      ) : (
                        <span className="text-orange-400 text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Non assigné
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue=""
                          onChange={e => assignAuditor(a.id, e.target.value)}
                          disabled={assigning === a.id}
                          className="bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 transition-all min-w-[140px]">
                          <option value="">{a.auditorName ? 'Changer…' : 'Choisir…'}</option>
                          {auditors.map(aud => (
                            <option key={aud.id} value={aud.id}>{aud.fullName}</option>
                          ))}
                        </select>
                        {assigning === a.id && <span className="h-4 w-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/audit/${a.id}`} className="text-blue-400 hover:text-blue-300 text-xs font-medium hover:underline inline-flex items-center gap-1">
                        Ouvrir <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'suivi' && (
        <div className="space-y-6">
          {audits.length === 0 && !loading ? (
            <div className="glass rounded-2xl py-16 text-center text-[var(--muted-foreground)] text-sm">
              Aucun dossier à suivre pour le moment.
            </div>
          ) : (
            <>
          <div className="glass rounded-2xl p-5 border border-amber-500/15 bg-amber-500/[0.03]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-400" />
                  Vision équipe &amp; charge opérationnelle
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-2xl">
                  Regroupement des dossiers par auditeur pour suivre l&apos;avancement, identifier les tensions de charge
                  et préparer la <strong className="text-[var(--foreground)]">revue qualité</strong> avant envoi au
                  client.
                </p>
              </div>
              <Link
                href="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-200 hover:bg-amber-500/20 transition-colors"
              >
                <Activity className="h-4 w-4" />
                Coordonner sur la messagerie
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {Object.values(byAuditor).map((group) => (
              <div key={group.auditor} className="glass rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--muted)]/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold shrink-0">
                      {group.auditor === 'Non assigné' ? '?' : group.auditor[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--foreground)] truncate">{group.auditor}</p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {group.audits.length} dossier{group.audits.length > 1 ? 's' : ''} —{' '}
                        {group.audits.filter((x) => x.status === 'IN_PROGRESS').length} en production
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] shrink-0">
                    Revue
                  </span>
                </div>
                <div className="divide-y divide-[var(--border)]/60 max-h-[420px] overflow-y-auto">
                  {group.audits.map((a) => (
                    <div key={a.id} className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--muted)]/25 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--foreground)] text-sm truncate">{a.title}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                          Client : {a.clientName}
                          {a.deadline ? ` · Échéance ${new Date(a.deadline).toLocaleDateString('fr-FR')}` : ''}
                        </p>
                        <ProgressBar status={a.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${STATUS_COLORS[a.status] || ''}`}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                        <Link
                          href={`/audit/${a.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-3 py-1.5 text-[11px] font-semibold hover:bg-amber-500/15 transition-colors"
                        >
                          Qualité / livrable
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border border-[var(--border)]">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">Contrôle qualité &amp; validation</p>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  Ouvrez chaque dossier pour relire les livrables, consolider les retours client et verrouiller la version
                  officielle avant clôture. Les analyses RAG et les moteurs juridiques restent du ressort des auditeurs
                  et de l&apos;administration technique.
                </p>
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Temps de Travail */}
      {activeTab === 'temps' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 border border-[var(--border)]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-semibold text-[var(--foreground)] text-lg flex items-center gap-2">
                  <Timer className="h-5 w-5 text-indigo-400" />
                  Analyse du temps par Dossier
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">Temps cumulé des auditeurs sur chaque mission (en direct)</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Live Monitoring</span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {timeStats.length === 0 ? (
                <div className="text-center py-12 text-[var(--muted-foreground)] italic">
                   Aucune donnée de temps enregistrée pour le moment.
                </div>
              ) : timeStats.map((stat: any) => {
                const maxSeconds = Math.max(...timeStats.map((s: any) => s.totalSeconds || 1));
                const totalPercent = Math.round((stat.totalSeconds / maxSeconds) * 100);
                
                const formatTime = (sec: number) => {
                  const h = Math.floor(sec / 3600);
                  const m = Math.floor((sec % 3600) / 60);
                  const s = sec % 60;
                  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
                };

                return (
                  <div key={stat.auditId} className="group">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--foreground)] group-hover:text-blue-400 transition-colors truncate">{stat.auditTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {stat.auditors?.map((aud: any, idx: number) => (
                             <span key={idx} className="text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                               {aud.name}: {formatTime(aud.seconds)}
                             </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-blue-400 font-mono">{formatTime(stat.totalSeconds)}</p>
                      </div>
                    </div>
                    
                    <div className="relative h-4 w-full bg-[var(--muted)] rounded-full overflow-hidden shadow-inner border border-[var(--border)]">
                      {/* Bar segments for each auditor if multiple */}
                      <div className="flex h-full w-full">
                        {stat.auditors?.map((aud: any, idx: number) => {
                          const width = (aud.seconds / maxSeconds) * 100;
                          const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-teal-500'];
                          return (
                            <div 
                              key={idx} 
                              className={`h-full ${colors[idx % colors.length]} transition-all duration-1000 group-hover:brightness-110 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]`} 
                              style={{ width: `${width}%` }} 
                              title={`${aud.name}: ${formatTime(aud.seconds)}`}
                            />
                          );
                        })}
                        {stat.totalSeconds === 0 && <div className="w-0" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Auditor List */}
          <div className="glass rounded-2xl overflow-hidden border border-[var(--border)]">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h3 className="font-semibold text-[var(--foreground)] text-sm">Disponibilité des Auditeurs</h3>
            </div>
            <div className="p-0">
              {auditors.map(aud => {
                const audTotal = timeStats.reduce((acc, stat) => {
                  const match = stat.auditors?.find((a: any) => a.name === aud.fullName);
                  return acc + (match?.seconds || 0);
                }, 0);
                
                return (
                  <div key={aud.id} className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--muted)]/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                        {aud.fullName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-[var(--foreground)]">{aud.fullName}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{aud.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-[var(--foreground)]">
                         {Math.floor(audTotal / 3600)}h {Math.floor((audTotal % 3600) / 60)}m
                       </p>
                       <p className="text-[10px] text-[var(--muted-foreground)]">Temps total cumulé</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
