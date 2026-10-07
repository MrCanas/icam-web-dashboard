import { fmtInt } from "@/lib/formatters";

/** «1 correo», «2 correos». */
export function cuantos(n: number, uno: string, varios: string): string {
  return `${fmtInt(n)} ${n === 1 ? uno : varios}`;
}
