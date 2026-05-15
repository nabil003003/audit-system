'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FileText, Clock, CheckCircle, Plus, X, ArrowRight, Upload, Paperclip, AlertCircle, Activity, Calendar as CalendarIcon, Shield, MessageCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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

export default function ClientDashboard() {
  useAuth(['CLIENT']);
  const { user } = useAuthStore();
  const [audits, setAudits] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', deadline: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAudits(); }, []);

  const loadAudits = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/audits/mine?size=100');
      setAudits(data?.content ?? (Array.isArray(data) ? data : []));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const createAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Create audit
      const audit = await apiFetch('/api/audits', {
        method: 'POST',
        body: JSON.stringify({ ...formData }),
      });

      // 2. Upload documents if any
      if (files.length > 0 && audit?.id) {
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          await apiFetch(`/api/documents/upload?auditId=${audit.id}`, {
            method: 'POST',
            body: fd,
            isFormData: true,
          }).catch((err) => toast.error(`Document "${file.name}" : ${err.message}`));
        }
      }

      toast.success(`Demande soumise avec ${files.length} document(s) joint(s) !`);
      setFormData({ title: '', description: '', deadline: '' });
      setFiles([]);
      setShowForm(false);
      loadAudits();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const stats = [
    { label: 'Demandes', value: audits.length, icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: "En file d'étude", value: audits.filter((a) => a.status === 'PENDING' || a.status === 'DRAFT').length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'En traitement cabinet', value: audits.filter((a) => a.status === 'IN_PROGRESS').length, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Rapports disponibles', value: audits.filter((a) => a.status === 'COMPLETED').length, icon: CheckCircle, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/90 via-teal-950/80 to-slate-950/90 p-6 sm:p-8 text-white shadow-xl shadow-emerald-900/25">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.22),transparent_55%)] pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-200/90">Espace client sécurisé</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Bonjour, {user?.fullName?.split(' ')[0] || 'Client'}
            </h1>
            <p className="text-sm text-emerald-50/85 leading-relaxed">
              Déposez vos pièces en toute confidentialité, suivez les étapes de traitement par le cabinet et récupérez
              vos rapports certifiés. Vous n&apos;accédez pas aux analyses internes ni aux outils décisionnels réservés
              aux équipes d&apos;audit.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-emerald-50/95">
                <Shield className="h-3.5 w-3.5 text-emerald-200" />
                Chaîne de dépôt sécurisée
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-emerald-50/95">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-200" />
                Échanges avec l&apos;équipe
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-emerald-950 shadow-lg hover:bg-emerald-50 transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Fermer le formulaire' : 'Nouvelle demande'}
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 border border-[var(--border)]">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">Parcours transparent</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { step: '1', title: 'Dépôt', desc: 'Pièces & formulaire' },
            { step: '2', title: 'Prise en charge', desc: 'Attribution cabinet' },
            { step: '3', title: 'Mission', desc: 'Traitement & contrôles' },
            { step: '4', title: 'Livrable', desc: 'Rapport certifié' },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Étape {s.step}</p>
              <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">{s.title}</p>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {showForm && (
            <div className="glass rounded-2xl p-6 space-y-5 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Nouvelle demande auprès du cabinet</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">Décrivez votre besoin et joignez les pièces demandées</p>
                </div>
              </div>

              <form onSubmit={createAudit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Titre de la mission *</label>
                    <input type="text" required placeholder="ex: Audit comptable exercice 2025"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Échéance souhaitée (Calendrier)</label>
                    <div className="relative">
                      <DatePicker
                        selected={formData.deadline ? new Date(formData.deadline) : null}
                        onChange={(date: Date | null) => {
                          if (date) {
                            const localDateString = date.toLocaleDateString('en-CA'); // format YYYY-MM-DD
                            setFormData({ ...formData, deadline: `${localDateString}T23:59:59` });
                          } else {
                            setFormData({ ...formData, deadline: '' });
                          }
                        }}
                        minDate={new Date()}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="🗓️ Sélectionner une date au calendrier"
                        className="w-full bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer font-medium pr-10"
                        wrapperClassName="w-full"
                      />
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Description & objectifs *</label>
                  <textarea required placeholder="Décrivez le périmètre de l'audit, les exercices concernés, les problématiques…"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-all resize-none h-24" />
                </div>

                {/* Document Upload Section */}
                <div>
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                    Documents financiers (Obligatoire) *
                  </label>

                  {/* Instructions & Templates */}
                  <div className="mb-4 bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-orange-400 mb-1">Standard d&apos;Audit Exigé</h3>
                        <p className="text-xs text-[var(--muted-foreground)] mb-3">
                          Pour une analyse fiable, vous <strong>devez obligatoirement</strong> fournir : 
                          <span className="block mt-1.5 font-medium text-[var(--foreground)]">
                            • Bilan & Compte de résultat<br/>
                            • Grand Livre & Balance Générale
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[var(--border)] hover:border-blue-500/50 hover:bg-[var(--muted)]/50'
                    }`}>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-[var(--muted-foreground)]" />
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Glissez vos fichiers ici ou <span className="text-blue-400 font-medium">cliquez pour sélectionner</span>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.txt"
                      className="hidden"
                      onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[var(--muted)] rounded-xl px-3 py-2.5">
                          <Paperclip className="h-4 w-4 text-blue-400 flex-shrink-0" />
                          <span className="text-sm text-[var(--foreground)] flex-1 truncate">{f.name}</span>
                          <button type="button" onClick={() => removeFile(i)}
                            className="text-[var(--muted-foreground)] hover:text-red-400 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button type="submit" disabled={submitting}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2">
                    {submitting ? 'Envoi...' : 'Soumettre la demande'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--foreground)]">Mes missions</h2>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Statut visible — le détail technique reste côté cabinet</p>
            </div>
            {loading ? (
              <div className="py-20 text-center text-[var(--muted-foreground)]">Chargement...</div>
            ) : audits.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <FileText className="h-12 w-12 mx-auto text-[var(--muted-foreground)]/40" />
                <p className="text-[var(--muted-foreground)]">Aucun audit soumis</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]/50">
                {audits.map(a => (
                  <div key={a.id} className="px-6 py-5 hover:bg-[var(--muted)]/30 transition-colors flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--foreground)] truncate">{a.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        Auditeur: {a.auditorName ?? 'En attente d\'assignation'}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${STATUS_COLORS[a.status] || ''}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                    <Link href={`/audit/${a.id}`}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 text-xs font-medium transition-colors">
                      Suivre ma mission <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Requested Documents Box */}
          <div className="glass rounded-2xl p-6 border border-orange-500/20">
            <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-2">
              <Paperclip className="h-5 w-5 text-orange-400" />
              Pièces complémentaires
            </h3>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-4">
              Le cabinet peut solliciter des documents additionnels : vous les déposez ici sans accéder aux analyses internes.
            </p>
            <div className="space-y-3">
              {[
                { name: 'Balance Générale 2024', status: 'Requis', color: 'text-orange-400' },
                { name: 'Grand Livre', status: 'Validé', color: 'text-green-400' },
              ].map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[var(--muted)]/50 rounded-xl border border-[var(--border)]">
                  <span className="text-xs font-medium text-[var(--foreground)]">{doc.name}</span>
                  <span className={`text-[10px] font-bold uppercase ${doc.color}`}>{doc.status}</span>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 bg-orange-500/10 text-orange-400 rounded-xl text-xs font-bold border border-orange-500/20 hover:bg-orange-500/20 transition-all">
              Uploader les pièces manquantes
            </button>
          </div>

          {/* Activity Feed */}
          <div className="glass rounded-2xl p-6 border border-[var(--border)]">
            <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-emerald-400" />
              Fil de votre mission
            </h3>
            <div className="space-y-4">
              {[
                { text: 'Rapport intermédiaire disponible', time: 'Il y a 2h', icon: CheckCircle, iconColor: 'text-green-400' },
                { text: 'Auditeur assigné: M. Benzakour', time: 'Hier', icon: Clock, iconColor: 'text-blue-400' },
              ].map((act, i) => (
                <div key={i} className="flex gap-3">
                  <act.icon className={`h-4 w-4 mt-0.5 ${act.iconColor}`} />
                  <div>
                    <p className="text-xs font-medium text-[var(--foreground)]">{act.text}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">{act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
