function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convierte headline de ts_headline (<<mark>>…<</mark>>) a HTML seguro con <mark>. */
export function parseSearchHeadline(headline: string): string {
  const parts = headline.split(/(<<mark>>|<\/mark>>)/);
  return parts
    .map((part) => {
      if (part === "<<mark>>") return "<mark>";
      if (part === "<</mark>>") return "</mark>";
      return escapeHtml(part);
    })
    .join("");
}
