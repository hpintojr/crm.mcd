import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full rounded-2xl border border-ink-700 bg-ink-900 p-7 shadow-xl">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-gray-400">
          Use your Mercury Call Desk credentials to access the secure partner portal.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
