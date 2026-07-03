import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

type AdminShellProps = {
  children: ReactNode;
  email: string;
  role: string;
  canReviewApplicants: boolean;
};

function roleLabel(role: string) {
  return role.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function AdminShell({ children, email, role, canReviewApplicants }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-ink-950 text-gray-100">
      <header className="border-b border-ink-700 bg-ink-900/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
            <p className="mt-1 text-lg font-semibold text-white">Admin workspace</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full border border-ink-700 px-3 py-1.5 text-gray-300">{roleLabel(role)}</span>
            <span className="max-w-[16rem] truncate text-gray-400">{email}</span>
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Admin workspace" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 pb-4 text-sm">
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-gray-200 transition hover:border-brand-500 hover:text-white" href="/admin">Overview</Link>
          {canReviewApplicants && <Link className="rounded-lg border border-ink-700 px-3 py-2 text-gray-200 transition hover:border-brand-500 hover:text-white" href="/admin/applicants">Applicant review</Link>}
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-gray-200 transition hover:border-brand-500 hover:text-white" href="/portal">Partner portal</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
