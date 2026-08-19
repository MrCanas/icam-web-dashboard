import { createInterface } from "node:readline";

/** ¿Se puede preguntar? En un pipe o en CI no hay a quién. */
export function hayTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Pregunta por consola. Con `oculto`, no muestra lo que se teclea.
 *
 * Existe para que el client secret no tenga que ir como argumento: en la línea
 * de comandos queda en el historial del shell y, en Windows, además obliga a
 * pelearse con las comillas.
 */
export function preguntar(etiqueta: string, oculto = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  return new Promise((resolve) => {
    if (!oculto) {
      rl.question(etiqueta, (v) => {
        rl.close();
        resolve(v.trim());
      });
      return;
    }

    // readline no trae entrada oculta: se intercepta la escritura del propio
    // readline mientras dura la pregunta y se pintan asteriscos.
    const rlAny = rl as unknown as { _writeToOutput?: (s: string) => void };
    const original = rlAny._writeToOutput;
    let capturando = false;

    rlAny._writeToOutput = (s: string) => {
      if (!capturando) {
        process.stdout.write(s);
        return;
      }
      // La primera escritura tras la pregunta repinta la línea entera.
      if (s.includes(etiqueta)) process.stdout.write(etiqueta + "*".repeat(rl.line.length));
      else if (s !== "\r\n" && s !== "\n") process.stdout.write("*");
      else process.stdout.write(s);
    };

    capturando = true;
    rl.question(etiqueta, (v) => {
      capturando = false;
      rlAny._writeToOutput = original;
      process.stdout.write("\n");
      rl.close();
      resolve(v.trim());
    });
  });
}
