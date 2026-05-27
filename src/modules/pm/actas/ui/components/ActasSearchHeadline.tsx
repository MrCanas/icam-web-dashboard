import { parseSearchHeadline } from "@/modules/pm/actas/logic/parse-search-headline";

interface ActasSearchHeadlineProps {
  headline: string;
  className?: string;
}

export function ActasSearchHeadline({
  headline,
  className = "",
}: ActasSearchHeadlineProps) {
  const html = parseSearchHeadline(headline);
  return (
    <span
      className={`text-sm text-text-primary line-clamp-2 [&_mark]:bg-amber-200 [&_mark]:text-inherit ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
