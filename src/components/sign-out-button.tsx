"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-300 transition hover:border-brand-500 hover:text-white"
    >
      Sign out
    </button>
  );
}
