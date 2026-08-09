import type { UIMessage } from "ai";

const isImage = (part: unknown): boolean => {
  const p = part as { type?: string; mediaType?: string };
  return p.type === "file" && !!p.mediaType?.startsWith("image/");
};

/** Image pixels are useful for this request, not for every future turn. */
export function stripImageData(parts: UIMessage["parts"]): UIMessage["parts"] {
  return parts.map((part) => (isImage(part) ? { ...part, url: "" } : part));
}

/** Do not replay an empty image placeholder into the model. */
export function withoutImages(parts: UIMessage["parts"]): UIMessage["parts"] {
  return parts.filter((part) => !isImage(part));
}
