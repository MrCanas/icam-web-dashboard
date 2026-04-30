"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Credenciales incorrectas");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <section className="min-h-screen bg-[#1c2e69] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] bg-card rounded-lg border border-subtle/50 shadow-sm p-6">
        <div className="flex justify-center mb-6">
          <Image
            src="/IMPAR_CAPITAL_blue.png"
            alt="ICAM Asset Manager"
            width={220}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-semibold text-icam-900 text-center mb-5">Acceso al Dashboard</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Usuario"
            className="w-full h-11 rounded-md border border-subtle px-3 text-sm focus:outline-none focus:ring-2 focus:ring-icam-900/20"
            autoComplete="username"
            required
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Contraseña"
            className="w-full h-11 rounded-md border border-subtle px-3 text-sm focus:outline-none focus:ring-2 focus:ring-icam-900/20"
            autoComplete="current-password"
            required
          />
          <button
            type="submit"
            className="w-full h-11 rounded-md bg-icam-900 hover:bg-icam-800 text-white text-sm font-medium transition disabled:opacity-70"
            disabled={loading}
          >
            {loading ? "Validando..." : "Acceder"}
          </button>
          {error ? <p className="text-xs text-red-600 text-center">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
