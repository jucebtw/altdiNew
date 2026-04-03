"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl: callbackUrl ?? "/",
    });
    setPending(false);
    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }
    window.location.href = res?.url ?? callbackUrl ?? "/";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-charcoal/80">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-pill border border-black/10 bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-charcoal/80">Пароль</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-pill border border-black/10 bg-cream px-4 py-2.5 text-sm outline-none focus:border-terracotta"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Вход…" : "Войти"}
      </Button>
    </form>
  );
}
