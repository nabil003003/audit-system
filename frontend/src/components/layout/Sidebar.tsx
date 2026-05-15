'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  ShieldCheck,
  Bell,
  MessageSquare,
  Activity,
  Scale,
  FolderOpen,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: string[];
};

const ROLE_HOME: Record<string, { href: string; label: string; tagline: string }> = {
  ADMIN: {
    href: '/dashboard/admin',
    label: 'Supervision',
    tagline: 'Autorité centrale & stabilité du système',
  },
  MANAGER: {
    href: '/dashboard/manager',
    label: 'Pilotage',
    tagline: 'Centre opérationnel & qualité des missions',
  },
  AUDITOR: {
    href: '/dashboard/auditor',
    label: 'Laboratoire',
    tagline: 'Expertise, conformité & IA métier',
  },
  CLIENT: {
    href: '/dashboard/client',
    label: 'Espace client',
    tagline: 'Dépôt sécurisé & suivi de mission',
  },
};

const getNavLinks = (role: string | undefined): NavItem[] => {
  const r = role || '';
  const home = ROLE_HOME[r]?.href || '/dashboard';

  const links: NavItem[] = [
    {
      name: ROLE_HOME[r]?.label || 'Tableau de bord',
      href: home,
      icon: LayoutDashboard,
      roles: ['ADMIN', 'MANAGER', 'AUDITOR', 'CLIENT'],
    },
    {
      name: 'Comptes & accès',
      href: '/dashboard/users',
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      name: 'Vue transversale missions',
      href: '/dashboard/audits',
      icon: Activity,
      roles: ['ADMIN'],
    },
    {
      name: 'Portefeuille missions',
      href: '/dashboard/audits',
      icon: FolderOpen,
      roles: ['MANAGER'],
    },
    {
      name: 'Dossiers assignés',
      href: '/dashboard/audits',
      icon: FileText,
      roles: ['AUDITOR'],
    },
    {
      name: 'Corpus juridique (RAG)',
      href: '/dashboard/admin/rag',
      icon: Scale,
      roles: ['ADMIN'],
    },
    {
      name: 'Échanges équipe',
      href: '/chat',
      icon: MessageSquare,
      roles: ['ADMIN', 'MANAGER', 'AUDITOR', 'CLIENT'],
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      roles: ['ADMIN', 'MANAGER', 'AUDITOR', 'CLIENT'],
    },
    {
      name: 'Paramètres',
      href: '/dashboard/settings',
      icon: Settings,
      roles: ['ADMIN', 'MANAGER', 'CLIENT', 'AUDITOR'],
    },
  ];

  return links.filter((l) => !role || l.roles.includes(role));
};

const roleShell = (role: string | undefined) => {
  switch (role) {
    case 'ADMIN':
      return {
        accent: 'from-slate-600 to-indigo-700',
        ring: 'ring-indigo-500/30',
        navActive: 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20',
        iconActive: 'text-indigo-400',
        badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
        brand: 'text-indigo-400',
      };
    case 'MANAGER':
      return {
        accent: 'from-amber-600 to-orange-700',
        ring: 'ring-amber-500/30',
        navActive: 'bg-amber-600/15 text-amber-400 border border-amber-500/20',
        iconActive: 'text-amber-400',
        badge: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
        brand: 'text-amber-400',
      };
    case 'AUDITOR':
      return {
        accent: 'from-cyan-600 to-blue-800',
        ring: 'ring-cyan-500/30',
        navActive: 'bg-cyan-600/15 text-cyan-400 border border-cyan-500/20',
        iconActive: 'text-cyan-400',
        badge: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/25',
        brand: 'text-cyan-400',
      };
    case 'CLIENT':
      return {
        accent: 'from-emerald-600 to-teal-700',
        ring: 'ring-emerald-500/30',
        navActive: 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20',
        iconActive: 'text-emerald-400',
        badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
        brand: 'text-emerald-400',
      };
    default:
      return {
        accent: 'from-blue-600 to-indigo-700',
        ring: 'ring-blue-500/30',
        navActive: 'bg-blue-600/10 text-blue-500 border border-blue-500/15',
        iconActive: 'text-blue-500',
        badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        brand: 'text-blue-500',
      };
  }
};

const roleLabelFr = (role: string | undefined) => {
  switch (role) {
    case 'ADMIN':
      return 'Administrateur';
    case 'MANAGER':
      return 'Manager';
    case 'AUDITOR':
      return 'Auditeur';
    case 'CLIENT':
      return 'Client';
    default:
      return 'Invité';
  }
};

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const links = getNavLinks(user?.role);
  const shell = roleShell(user?.role);
  const identity = ROLE_HOME[user?.role || ''] || {
    href: '/dashboard',
    label: 'Tableau de bord',
    tagline: 'Plateforme intelligente d’audit',
  };

  return (
    <div className="w-72 h-screen border-r border-[var(--border)] bg-[var(--background-card)]/95 backdrop-blur-3xl hidden md:flex flex-col sticky top-0 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]">
      <div className="h-[4.5rem] flex flex-col justify-center px-5 border-b border-[var(--border)] gap-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg ring-2',
              shell.accent,
              shell.ring
            )}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
              Audit<span className={shell.brand}>Pro</span>
            </span>
            <p className="text-[10px] text-[var(--muted-foreground)] leading-tight truncate">
              {identity.tagline}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-2">
        <div
          className={cn(
            'rounded-2xl px-3 py-2.5 border text-[11px] leading-snug text-[var(--muted-foreground)]',
            shell.badge
          )}
        >
          <span className="font-semibold text-[var(--foreground)]">{roleLabelFr(user?.role)}</span>
          <span className="mx-1.5 opacity-40">·</span>
          Identité fonctionnelle dédiée : permissions, périmètre et outils adaptés à votre rôle dans le cabinet.
        </div>
      </div>

      <nav className="flex-1 py-2 px-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-[0.2em] mb-3 px-3">
          Navigation
        </div>
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== '/dashboard' && pathname.startsWith(`${link.href}/`));
          const Icon = link.icon;
          return (
            <Link
              key={`${link.name}-${link.href}`}
              href={link.href}
              className={cn(
                'group flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? shell.navActive
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] border border-transparent'
              )}
            >
              <Icon
                className={cn(
                  'mr-3 h-5 w-5 transition-transform group-hover:scale-105',
                  isActive ? shell.iconActive : 'text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]'
                )}
              />
              <span className="truncate">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 bg-[var(--muted)]/40 p-3 rounded-2xl border border-[var(--border)]">
          <div
            className={cn(
              'h-10 w-10 rounded-full bg-gradient-to-tr flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white/10',
              shell.accent
            )}
          >
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-[var(--foreground)]">{user?.fullName || 'Utilisateur'}</p>
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">{roleLabelFr(user?.role)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
