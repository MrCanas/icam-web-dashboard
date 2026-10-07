/**
 * Direcciones de correo, una a una y bien visibles. Es lo que hay que leer
 * antes de enviar, así que nunca va dentro de un desplegable.
 */
export function ListaDeDirecciones({
  direcciones,
  vacio = "ninguna",
  compacta,
  tono = "neutro",
}: {
  direcciones: readonly string[];
  vacio?: string;
  compacta?: boolean;
  tono?: "neutro" | "marca";
}) {
  if (direcciones.length === 0) return <span className="text-sm text-text-muted">{vacio}</span>;
  const clase =
    tono === "marca"
      ? "rounded border border-icam-gold/40 bg-icam-gold/10 text-icam-900"
      : "rounded border border-subtle bg-page text-text-body";
  return (
    <ul className={`flex flex-wrap gap-1 ${compacta ? "" : "max-h-40 overflow-auto"}`}>
      {direcciones.map((d) => (
        <li key={d} className={`${clase} px-1.5 py-0.5 font-mono text-xs`}>
          {d}
        </li>
      ))}
    </ul>
  );
}
