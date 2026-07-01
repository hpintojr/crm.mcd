"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  async function handleClick() {
    await fetch("/api/auth/logout-audit", { method: "POST" });
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-300 transition hover:border-brand-500 hover:text-white"
    >
      Sign out
    </button>
  );
}
