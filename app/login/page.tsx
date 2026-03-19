"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("manager@citron-erp.local");
  const [password, setPassword] = useState("ChangeMeManager123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Connexion impossible");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Erreur reseau, reessaie dans quelques secondes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold">Connexion Citron ERP</h1>
        <p className="mt-2 text-sm text-muted">
          Connecte-toi en tant que gestionnaire ou operateur.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-card-secondary px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </label>
          <label className="block text-sm">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-card-secondary px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            className="w-full cursor-pointer rounded-xl bg-accent px-3 py-2 font-medium text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}
