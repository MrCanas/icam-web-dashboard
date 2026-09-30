"use client";

import { useRef, useState, type ReactNode } from "react";

/** Zona para arrastrar ficheros o pulsar y elegirlos. */
export function ZonaSoltar({
  acepta,
  multiple,
  onFicheros,
  deshabilitado,
  children,
  pequena,
}: {
  acepta: string;
  multiple?: boolean;
  onFicheros: (files: File[]) => void;
  deshabilitado?: boolean;
  children: ReactNode;
  pequena?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        if (!deshabilitado) onFicheros(Array.from(e.dataTransfer.files ?? []));
      }}
      className={`block cursor-pointer rounded-md border border-dashed text-center text-sm ${pequena ? "p-2.5" : "p-4"} ${
        encima ? "border-icam-900 text-icam-900" : "border-[#cfd1d7] text-text-muted hover:border-icam-900 hover:text-icam-900"
      } ${deshabilitado ? "pointer-events-none opacity-50" : ""} bg-page`}
    >
      {children}
      <input
        ref={input}
        type="file"
        accept={acepta}
        multiple={multiple}
        className="sr-only"
        disabled={deshabilitado}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          onFicheros(files);
        }}
      />
    </label>
  );
}
