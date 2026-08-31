'use client';

import { motion } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  IconLayoutGrid,
  IconDiamond,
  IconTicket,
  IconUsers,
  IconStar,
  IconSpeakerphone,
  IconChartBar,
  IconClipboardList,
  IconShieldLock,
  IconShield,
  IconSettings,
  IconUser,
  IconTool,
  IconTrophy,
  IconBell,
  IconBuilding,
  IconPlayerPlay,
  type TablerIconsProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const iconMap: Record<string, ComponentType<TablerIconsProps>> = {
  'layout-grid': IconLayoutGrid,
  diamond: IconDiamond,
  ticket: IconTicket,
  users: IconUsers,
  star: IconStar,
  speakerphone: IconSpeakerphone,
  'chart-bar': IconChartBar,
  'clipboard-list': IconClipboardList,
  'shield-lock': IconShieldLock,
  shield: IconShield,
  settings: IconSettings,
  user: IconUser,
  wrench: IconTool,
  trophy: IconTrophy,
  bell: IconBell,
  'player-play': IconPlayerPlay,
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isOrganizer = user?.role === 'organizer';
  const isAdmin = user?.role === 'admin';
  const isParticipant = user?.role === 'participant';

  const organizerBaseNav: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard/organizer', icon: 'layout-grid' },
    { label: 'Draws', href: '/dashboard/organizer/draws', icon: 'diamond' },
    { label: 'Tokens', href: '/dashboard/organizer/tokens', icon: 'ticket' },
    { label: 'Participants', href: '/dashboard/organizer/participants', icon: 'users' },
    { label: 'Winners', href: '/dashboard/organizer/winners', icon: 'star' },
    { label: 'Communications', href: '/dashboard/organizer/communications', icon: 'speakerphone' },
    { label: 'Analytics', href: '/dashboard/organizer/analytics', icon: 'chart-bar' },
    { label: 'Audit Log', href: '/dashboard/organizer/audit', icon: 'clipboard-list' },
    { label: 'Two-Factor Auth', href: '/dashboard/organizer/2fa', icon: 'shield-lock' },
    { label: 'Security & Audit', href: '/dashboard/organizer/security', icon: 'shield' },
    { label: 'Simulate Draw', href: '/dashboard/organizer/simulate', icon: 'player-play' },
  ];

  const adminOnlyNav: NavItem[] = [
    { label: 'Admin Panel', href: '/dashboard/organizer/admin', icon: 'settings' },
    { label: 'User Management', href: '/dashboard/organizer/users', icon: 'user' },
    { label: 'System Settings', href: '/dashboard/organizer/settings', icon: 'wrench' },
  ];

  const participantNav: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard/participant', icon: 'layout-grid' },
    { label: 'Available Draws', href: '/dashboard/participant/draws', icon: 'diamond' },
    { label: 'My Tokens', href: '/dashboard/participant/tokens', icon: 'ticket' },
    { label: 'My Entries', href: '/dashboard/participant/entries', icon: 'clipboard-list' },
    { label: 'My Profile', href: '/dashboard/participant/profile', icon: 'user' },
    { label: 'Results', href: '/dashboard/participant/results', icon: 'trophy' },
    { label: 'Notifications', href: '/dashboard/participant/notifications', icon: 'bell' },
  ];

  const navItems: NavItem[] = isAdmin
    ? [...organizerBaseNav, ...adminOnlyNav]
    : isOrganizer
      ? organizerBaseNav
      : participantNav;

  const handleLogout = () => {
    logout();
    router.push('/auth');
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-primary/20 flex flex-col p-6 space-y-8"
    >
      {/* Logo */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-primary">Draw</h2>
        <p className="text-xs text-muted-foreground">v2.1 System</p>
      </div>

      {/* User Info */}
      {user && (
        <motion.div
          className={`border rounded-lg p-4 space-y-2 ${
            isAdmin
              ? 'bg-destructive/10 border-destructive/30'
              : isOrganizer
                ? 'bg-primary/10 border-primary/20'
                : 'bg-muted/50 border-muted'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full border border-primary/40"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">
                {user.name}
              </p>
              <div className="flex items-center gap-1">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                  isAdmin
                    ? 'bg-destructive/20 text-destructive'
                    : isOrganizer
                      ? 'bg-primary/20 text-primary'
                      : 'bg-primary/20 text-primary'
                }`}>
                  {isAdmin ? <><IconSettings size={12} stroke={2} /> Admin</> : isOrganizer ? <><IconBuilding size={12} stroke={2} /> Organizer</> : <><IconUser size={12} stroke={2} /> Participant</>}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-2 scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent">
        {/* Admin-only section header */}
        {isAdmin && (
          <>
            <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 pb-1 pt-2">
              Organizer Tools
            </p>
            {organizerBaseNav.map((item, idx) => (
              <NavButton key={item.href} item={item} idx={idx} pathname={pathname} router={router} />
            ))}
            <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 pb-1 pt-3">
              Admin Controls
            </p>
            {adminOnlyNav.map((item, idx) => (
              <NavButton key={item.href} item={item} idx={idx + organizerBaseNav.length} pathname={pathname} router={router} isAdmin />
            ))}
          </>
        )}

        {/* Organizer or Participant nav */}
        {!isAdmin && navItems.map((item, idx) => (
          <NavButton key={item.href} item={item} idx={idx} pathname={pathname} router={router} />
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="space-y-3 border-t border-primary/10 pt-4">
        {isParticipant && (
          <Button
            onClick={() => router.push('/dashboard/participant/draws')}
            className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40"
            variant="outline"
          >
            Find Draws
          </Button>
        )}
        {(isOrganizer || isAdmin) && (
          <Button
            onClick={() => router.push('/dashboard/organizer/draws')}
            className="w-full bg-primary/20 text-primary hover:bg-primary/30"
            variant="outline"
          >
            + New Draw
          </Button>
        )}
        <Button
          onClick={handleLogout}
          className="w-full bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/40"
          variant="outline"
        >
          Sign Out
        </Button>
      </div>
    </motion.aside>
  );
}

// Extracted nav button to avoid repetition
function NavButton({
  item,
  idx,
  pathname,
  router,
  isAdmin = false,
}: {
  item: NavItem;
  idx: number;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  isAdmin?: boolean;
}) {
  const isActive = pathname === item.href;
  const IconComponent = iconMap[item.icon];
  return (
    <motion.button
      key={item.href}
      onClick={() => router.push(item.href)}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-3 border ${
        isActive
          ? isAdmin
            ? 'bg-destructive/20 text-destructive border-destructive/40'
            : 'bg-primary text-primary-foreground border-primary/40'
          : 'text-foreground hover:bg-primary/10 border-transparent hover:border-primary/20'
      }`}
    >
      <span className="text-lg">{IconComponent ? <IconComponent size={18} stroke={1.5} /> : null}</span>
      <span className="font-medium text-sm">{item.label}</span>
    </motion.button>
  );
}
