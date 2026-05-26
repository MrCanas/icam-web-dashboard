import { renderToBuffer } from "@react-pdf/renderer";

import { ActaPdfDocument } from "./ActaPdfDocument";
import type { ActaPdfProps } from "./acta-pdf-types";

export async function renderActaPdfBuffer(props: ActaPdfProps): Promise<Buffer> {
  const buffer = await renderToBuffer(<ActaPdfDocument {...props} />);
  return Buffer.from(buffer);
}
