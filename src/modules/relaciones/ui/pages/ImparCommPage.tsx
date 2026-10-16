/** URL de ImparComm; NEXT_PUBLIC_IMPARCOMM_URL permite apuntar a un dominio propio. */
const IMPARCOMM_URL =
  process.env.NEXT_PUBLIC_IMPARCOMM_URL ?? "https://impar-comm.vercel.app";

/**
 * ImparComm a pantalla completa. Su cookie de sesión es SameSite=None +
 * Partitioned, así que dentro del iframe se inicia sesión una vez con la misma
 * contraseña de icam.
 */
export default function ImparCommPage() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <a
          href={IMPARCOMM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          Abrir en pestaña nueva
        </a>
      </div>
      <iframe
        src={IMPARCOMM_URL}
        title="ImparComm"
        allow="clipboard-write"
        className="w-full h-[calc(100dvh-12rem)] min-h-[600px] rounded-lg border border-gray-200 bg-white"
      />
    </div>
  );
}
