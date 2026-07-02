"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";

type PortalShellProps = {
  children: ReactNode;
  partnerName: string;
  email: string;
  leadAccessEnabled: boolean;
  isAdmin: boolean;
};

type NavItem = {
  label: string;
  href: string;
  icon: "dashboard" | "tasks" | "inbox" | "leads" | "proposals" | "schedule" | "training" | "resources" | "settings";
};

const mainNavigation: NavItem[] = [
  { label: "Dashboard", href: "/portal", icon: "dashboard" },
  { label: "Tasks", href: "/portal/tasks", icon: "tasks" },
  { label: "Inbox", href: "/portal/inbox", icon: "inbox" },
  { label: "Leads", href: "/portal/leads", icon: "leads" },
  { label: "Proposals", href: "/portal/proposals", icon: "proposals" },
  { label: "Schedule", href: "/portal/schedule", icon: "schedule" },
];

const learningNavigation: NavItem[] = [
  { label: "Training", href: "/portal/training", icon: "training" },
  { label: "Resources", href: "/portal/resources", icon: "resources" },
];

export function PortalShell({ children, partnerName, email, leadAccessEnabled, isAdmin }: PortalShellProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("mcd-portal-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("mcd-portal-theme", nextTheme);
  }

  function itemIsActive(href: string) {
    return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
  }

  return (
    <div className="portal-theme min-h-screen" data-theme={theme}>
      <div className="portal-shell mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="portal-sidebar hidden w-72 shrink-0 flex-col border-r lg:flex">
          <Brand />
          <nav aria-label="Partner portal" className="mt-8 space-y-1 px-3">
            {mainNavigation.map((item) => (
              <PortalLink key={item.href} item={item} active={itemIsActive(item.href)} locked={item.href === "/portal/leads" && !leadAccessEnabled} />
            ))}
          </nav>
          <div className="portal-divider mx-5 my-6" />
          <nav aria-label="Learning and resources" className="space-y-1 px-3">
            {learningNavigation.map((item) => <PortalLink key={item.href} item={item} active={itemIsActive(item.href)} />)}
          </nav>
          <div className="mt-auto border-t p-3 portal-border">
            {isAdmin && <Link className="portal-nav-item mb-1" href="/admin"><Icon name="settings" /><span>Admin review</span></Link>}
            <PortalLink item={{ label: "Settings", href: "/portal/settings", icon: "settings" }} active={itemIsActive("/portal/settings")} />
            <button className="portal-nav-item w-full" type="button" onClick={toggleTheme}>
              <Icon name="dashboard" />
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <button className="portal-nav-item w-full" type="button" onClick={() => signOut({ callbackUrl: "/login" })}>
              <Icon name="signout" />
              <span>Sign Out</span>
            </button>
            <div className="portal-user-card mt-3">
              <p className="truncate text-sm font-medium">{partnerName}</p>
              <p className="truncate text-xs portal-muted">{email}</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="portal-mobile-header flex items-center justify-between border-b px-5 py-4 lg:hidden">
            <Brand compact />
            <button className="portal-theme-toggle" type="button" onClick={toggleTheme}>{theme === "dark" ? "Light" : "Dark"}</button>
          </header>
          <nav aria-label="Partner portal mobile" className="portal-mobile-nav flex gap-2 overflow-x-auto border-b px-4 py-3 lg:hidden">
            {mainNavigation.map((item) => <PortalLink key={item.href} item={item} active={itemIsActive(item.href)} compact locked={item.href === "/portal/leads" && !leadAccessEnabled} />)}
            {learningNavigation.map((item) => <PortalLink key={item.href} item={item} active={itemIsActive(item.href)} compact />)}
            <PortalLink item={{ label: "Settings", href: "/portal/settings", icon: "settings" }} active={itemIsActive("/portal/settings")} compact />
          </nav>
          <main className="px-5 py-7 md:px-8 lg:px-10 lg:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "flex items-center gap-2" : "px-6 pt-7"}>
      <div className="portal-brand-mark">M</div>
      <div>
        <p className="text-sm font-semibold tracking-wide">Mercury Call Desk</p>
        {!compact && <p className="mt-1 text-xs portal-muted">Partner workspace</p>}
      </div>
    </div>
  );
}

function PortalLink({ item, active, compact = false, locked = false }: { item: NavItem; active: boolean; compact?: boolean; locked?: boolean }) {
  return (
    <Link className={`${compact ? "portal-mobile-link" : "portal-nav-item"} ${active ? "portal-nav-active" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>
      {!compact && <Icon name={item.icon} />}
      <span>{item.label}</span>
      {locked && !compact && <span className="portal-lock-label">Locked</span>}
    </Link>
  );
}

function Icon({ name }: { name: NavItem["icon"] | "signout" }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    tasks: <><path d="M9 11l2 2 4-4" /><path d="M5 4h14v16H5z" /></>,
    inbox: <><path d="M4 5h16v14H4z" /><path d="M4 15h5l2 2h2l2-2h5" /></>,
    leads: <><circle cx="12" cy="8" r="3" /><path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6" /></>,
    proposals: <><path d="M6 3h9l3 3v15H6z" /><path d="M9 11h6M9 15h6" /></>,
    schedule: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    training: <><path d="M3 6l9-3 9 3-9 3z" /><path d="M7 11v4c2.7 2 7.3 2 10 0v-4" /></>,
    resources: <><path d="M4 5a3 3 0 013-3h4v18H7a3 3 0 00-3 2z" /><path d="M20 5a3 3 0 00-3-3h-4v18h4a3 3 0 013 2z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2h-2.8v-.2a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H5.7v-2.8h.2a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9L7 8.2l2-2 .1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5V4.9h2.8v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.2V14h-.2a1.7 1.7 0 00-1.5 1z" /></>,
    signout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 00-2-2h-5" /></>,
  };
  return <svg aria-hidden="true" className="portal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
