'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Users,
  FileText,
  CheckCircle,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Shield,
  Cpu,
  Lock,
  Server,
} from 'lucide-react';

const PAGE_SIZE = 5;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', PENDING: 'En attente', IN_PROGRESS: 'En cours',
  AWAITING_DOCS: 'Docs requis', COMPLETED: 'Terminé', CANCELLED: 'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  DRAFT: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  AWAITING_DOCS: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  COMPLETED: 'bg-green-500/10 text-green-400 border border-green-500/20',
  CANCELLED: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

export default function AdminDashboard() {
  useAuth(['ADMIN']);
  const [users, setUsers] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(0);

  useEffect(() => { 
    loadData(false);
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [uRes, aRes, sRes] = await Promise.all([
        apiFetch('/api/users?size=1'),
        apiFetch('/api/audits?size=200&sort=createdAt,desc'),
        apiFetch('/api/system/status'),
      ]);
      setUsers({ total: uRes?.totalElements || 0 } as any);
      setSystemStatus(sRes);
      const raw = aRes?.content ?? (Array.isArray(aRes) ? aRes : []);
      // Sort newest first
      const sorted = [...raw].sort((a, b) =>
        new Date(b.createdAt || b.deadline || 0).getTime() -
        new Date(a.createdAt || a.deadline || 0).getTime()
      );
      setAudits(sorted);
    } catch (e: any) { 
      if (!isBackground) toast.error(e.message); 
    }
    finally { if (!isBackground) setLoading(false); }
  };

  const stats = [
    { label: 'Comptes actifs', value: (users as any).total || 0, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Missions référencées', value: audits.length, icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10' },
    { label: 'Missions en cours', value: audits.filter((a) => a.status === 'IN_PROGRESS').length, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Missions clôturées', value: audits.filter((a) => a.status === 'COMPLETED').length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-slate-900/90 via-indigo-950/80 to-slate-900/90 p-6 sm:p-8 text-white shadow-xl shadow-indigo-900/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_55%)] pointer-events-none" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-indigo-200/90">Autorité centrale</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Centre de supervision &amp; gouvernance</h1>
            <p className="text-sm text-indigo-100/85 leading-relaxed">
              Vous ne conduisez pas les missions d&apos;audit : vous garantissez la stabilité, la sécurité et la conformité
              de la plateforme. Tableaux analytiques en temps réel, contrôle des accès, journaux d&apos;activité et
              vision globale des performances.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { icon: Shield, t: 'Sécurité & conformité' },
                { icon: Lock, t: 'Contrôle des accès' },
                { icon: Server, t: 'Résilience plateforme' },
              ].map(({ icon: I, t }) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-indigo-50/95"
                >
                  <I className="h-3.5 w-3.5 text-indigo-200" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:flex-col lg:items-end">
            <Link
              href="/dashboard/users"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 hover:bg-indigo-50 transition-colors"
            >
              <Users className="h-4 w-4" />
              Comptes &amp; habilitations
            </Link>
            <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-indigo-100/90">
              <Cpu className="h-4 w-4 text-emerald-300 shrink-0" />
              <span>
                Actualisation automatique des indicateurs toutes les <strong className="text-white">10 s</strong>.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`h-6 w-6 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{loading && !systemStatus ? '—' : s.value}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Global Mission Progress */}
      <div className="glass rounded-2xl p-6 border border-[var(--border)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            Synthèse analytique des missions
          </h2>
          <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest font-bold">Temps réel</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {[
            { name: 'En Attente / Brouillon', keys: ['PENDING', 'DRAFT'], color: 'bg-yellow-400' },
            { name: 'En Cours d\'Analyse', key: 'IN_PROGRESS', color: 'bg-blue-500' },
            { name: 'Documents Requis', key: 'AWAITING_DOCS', color: 'bg-orange-400' },
            { name: 'Missions Terminées', key: 'COMPLETED', color: 'bg-green-500' },
          ].map(d => {
            const count = d.keys 
              ? d.keys.reduce((acc, k) => acc + (systemStatus?.auditStats?.[k] || 0), 0)
              : (systemStatus?.auditStats?.[d.key!] || 0);
            
            const totalAudits = Object.values(systemStatus?.auditStats || {}).reduce((a: any, b: any) => a + b, 0) || 1;
            const percentage = Math.round((count / (totalAudits as number)) * 100);
            
            return (
              <div key={d.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[var(--foreground)]">{d.name}</span>
                  <span className="text-[var(--muted-foreground)] font-mono text-xs font-bold">{count}</span>
                </div>
                <div className="w-full h-2.5 bg-[var(--muted)] rounded-full overflow-hidden shadow-inner">
                  <div className={`h-full ${d.color} rounded-full shadow-lg transition-all duration-1000`} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Statistics & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Distribution Card */}
        <div className="glass rounded-2xl p-6 border border-[var(--border)] space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Répartition des Utilisateurs
            </h2>
            <span className="text-xs text-[var(--muted-foreground)]">
              Total:{' '}
              {systemStatus?.userStats
                ? (Object.values(systemStatus.userStats as Record<string, number>).reduce((a, b) => a + b, 0) as number)
                : '—'}
            </span>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Administrateurs', key: 'ADMIN', color: 'bg-purple-500' },
              { label: 'Managers', key: 'MANAGER', color: 'bg-blue-500' },
              { label: 'Auditeurs', key: 'AUDITOR', color: 'bg-indigo-500' },
              { label: 'Clients', key: 'CLIENT', color: 'bg-teal-500' },
            ].map(role => {
              const count = systemStatus?.userStats?.[role.key] || 0;
              const totalUsers = Object.values(systemStatus?.userStats || {}).reduce((a: any, b: any) => a + b, 0) || 1;
              const percentage = Math.round((count / (totalUsers as number)) * 100);
              
              return (
                <div key={role.key} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[var(--foreground)]">{role.label}</span>
                    <span className="text-[var(--muted-foreground)]">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className={`h-full ${role.color} rounded-full transition-all duration-1000`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="pt-2 grid grid-cols-2 gap-2">
            <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-center">
              <p className="text-xl font-bold text-blue-400">{systemStatus?.userStats?.['CLIENT'] || 0}</p>
              <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Clients Actifs</p>
            </div>
            <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-center">
              <p className="text-xl font-bold text-indigo-400">{systemStatus?.userStats?.['AUDITOR'] || 0}</p>
              <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Équipe Audit</p>
            </div>
          </div>
        </div>

        {/* Activity Feed Card */}
        <div className="glass rounded-2xl p-6 border border-[var(--border)] flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-400" />
              Journal d&apos;activité &amp; traçabilité
            </h2>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">En direct</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {systemStatus?.recentLogs?.length > 0 ? (
              systemStatus.recentLogs.map((log: any, i: number) => (
                <div key={i} className="flex gap-3 group">
                  <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${log.action.includes('FAILED') || log.action.includes('DELETE') ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0 border-l border-[var(--border)] pl-3 pb-4 last:pb-0">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-semibold text-[var(--foreground)] group-hover:text-blue-400 transition-colors">
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                        {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 truncate">
                      {log.userEmail} • {log.ipAddress}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)] italic text-sm">
                Aucune activité récente détectée
              </div>
            )}
          </div>
          
          <div className="mt-4 text-center py-2 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest border-t border-[var(--border)] pt-4">
            Fin du journal d&apos;activité
          </div>
        </div>
      </div>


      {/* Audits Monitoring Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--foreground)]">Supervision transversale des dossiers</h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            Page {auditPage + 1} / {Math.max(1, Math.ceil(audits.length / PAGE_SIZE))} &nbsp;·&nbsp; {audits.length} audit(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                {['#', 'Titre', 'Client', 'Auditeur', 'Statut', 'Échéance', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-[var(--muted-foreground)]">
                  <div className="h-6 w-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : audits.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[var(--muted-foreground)]">Aucun audit trouvé</td></tr>
              ) : audits.slice(auditPage * PAGE_SIZE, (auditPage + 1) * PAGE_SIZE).map((a, idx) => (
                <tr key={a.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--muted)]/30 transition-colors group">
                  <td className="px-6 py-4 text-xs text-[var(--muted-foreground)] w-8">{auditPage * PAGE_SIZE + idx + 1}</td>
                  <td className="px-6 py-4 font-semibold text-[var(--foreground)] max-w-[160px]">
                    <span className="truncate block">{a.title}</span>
                  </td>
                  <td className="px-6 py-4 text-[var(--muted-foreground)]">{a.clientName}</td>
                  <td className="px-6 py-4 text-[var(--muted-foreground)]">{a.auditorName ?? <span className="italic opacity-40">—</span>}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${STATUS_COLORS[a.status] || ''}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[var(--muted-foreground)] text-xs whitespace-nowrap">
                    {a.deadline ? new Date(a.deadline).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/audit/${a.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium transition-colors border border-blue-500/20 opacity-0 group-hover:opacity-100">
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {Math.ceil(audits.length / PAGE_SIZE) > 1 && (
          <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
            <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="h-4 w-4" /> Précédent
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(audits.length / PAGE_SIZE) }, (_, i) => (
                <button key={i} onClick={() => setAuditPage(i)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all ${
                    i === auditPage
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => setAuditPage(p => Math.min(Math.ceil(audits.length / PAGE_SIZE) - 1, p + 1))} disabled={auditPage >= Math.ceil(audits.length / PAGE_SIZE) - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
