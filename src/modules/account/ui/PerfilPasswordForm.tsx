"use client";

import { useState } from "react";

export function PerfilPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    setError(null);

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña");
        return;
      }

      setSuccess("Contraseña actualizada correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Error de red al cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <label className="flex flex-col gap-1 text-sm text-text-body">
        Contraseña actual
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="min-h-11 rounded-md border border-subtle px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-body">
        Nueva contraseña
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="min-h-11 rounded-md border border-subtle px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-text-body">
        Confirmar nueva contraseña
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="min-h-11 rounded-md border border-subtle px-3 text-sm"
        />
      </label>

      {success ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="min-h-11 px-4 rounded-md bg-icam-900 text-white text-sm font-medium hover:bg-icam-800 disabled:opacity-70 transition"
      >
        {loading ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
