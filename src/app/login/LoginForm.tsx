"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

const LOGIN_LOGO_SRC =
  "https://www.imparcapital.com/wp-content/uploads/2026/05/IMPAR_CAPITAL_blue.png";

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
      credentials: "include",
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
    <section className="min-h-screen min-w-0 bg-[#1c2e69] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px] bg-card rounded-lg border border-subtle/50 shadow-sm p-5 sm:p-6">
        <div className="flex justify-center mb-5 sm:mb-6 bg-transparent">
          <Image
            src={LOGIN_LOGO_SRC}
            alt="Impar Capital"
            width={280}
            height={80}
            className="h-12 sm:h-14 w-auto max-w-full object-contain object-center bg-transparent"
            priority
          />
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-icam-900 text-center mb-4 sm:mb-5">
          Acceso al Dashboard
        </h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Usuario"
            className="w-full min-h-11 rounded-md border border-subtle px-3 text-sm focus:outline-none focus:ring-2 focus:ring-icam-900/20"
            autoComplete="username"
            required
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Contraseña"
            className="w-full min-h-11 rounded-md border border-subtle px-3 text-sm focus:outline-none focus:ring-2 focus:ring-icam-900/20"
            autoComplete="current-password"
            required
          />
          <button
            type="submit"
            className="w-full min-h-11 rounded-md bg-icam-900 hover:bg-icam-800 text-white text-sm font-medium transition disabled:opacity-70"
            disabled={loading}
          >
            {loading ? "Validando..." : "Acceder"}
          </button>
          {error ? <p className="text-sm text-red-600 text-center">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
