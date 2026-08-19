"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { searchLogEntries } from "@/modules/pm/actas/actions/search-log-entries";
import { actasProjectElementHistoricoPath } from "@/modules/pm/actas/logic/actas-paths";
import { formatActaEntryDateTime } from "@/modules/pm/actas/logic/actas-time";
import type { ActasLogSearchResult } from "@/modules/pm/actas/types";
import { useActasBasePath } from "@/modules/pm/actas/ui/ActasBasePathContext";

import { ActasSearchHeadline } from "./ActasSearchHeadline";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;
const FETCH_LIMIT = 50;

interface ActasProjectSearchProps {
  projectId: string;
  projectCode: string;
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-subtle/60 border-t-icam-900"
      aria-hidden
    />
  );
}

export function ActasProjectSearch({
  projectId,
  projectCode,
}: ActasProjectSearchProps) {
  const basePath = useActasBasePath();
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ActasLogSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < MIN_CHARS) {
        setResults([]);
        setLoading(false);
        setError(null);
        setOpen(false);
        return;
      }

      setLoading(true);
      setError(null);
      const res = await searchLogEntries({
        projectId,
        query: trimmed,
        limit: FETCH_LIMIT,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setResults([]);
        setOpen(true);
        return;
      }
      setResults(res.results);
      setOpen(true);
      setActiveIndex(-1);
    },
    [projectId],
  );

  useEffect(() => {
    if (query.trim().length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        if (query.trim().length >= MIN_CHARS) setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const navigateToResult = (result: ActasLogSearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(
      actasProjectElementHistoricoPath(projectCode, result.elementId, {
        logEntryId: result.logEntryId,
        basePath,
      }),
    );
  };

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_CHARS;
  const showDropdown = open && canSearch;

  const showEmpty = showDropdown && !loading && !error && results.length === 0;

  return (
    <div ref={containerRef} className="relative mt-3">
      <label htmlFor={inputId} className="sr-only">
        Buscar en este proyecto
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
          {loading ? <Spinner /> : <SearchIcon />}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          placeholder="Buscar en este proyecto…"
          autoComplete="off"
          className="w-full min-h-10 rounded-md border border-subtle/60 bg-page py-2 pl-10 pr-20 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= MIN_CHARS) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!showDropdown || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              const hit = results[activeIndex];
              if (hit) navigateToResult(hit);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-subtle/50 bg-card px-1.5 py-0.5 text-[10px] text-text-muted sm:inline">
          ⌘K
        </kbd>
      </div>

      {showDropdown ? (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-[min(22rem,70vh)] w-full overflow-y-auto rounded-md border border-subtle/60 bg-card py-1 shadow-lg"
        >
          {error ? (
            <p className="px-3 py-2 text-sm text-red-600">{error}</p>
          ) : null}

          {showEmpty ? (
            <p className="px-3 py-4 text-sm text-text-muted text-center">
              Sin coincidencias para &apos;{trimmedQuery}&apos;.
            </p>
          ) : null}

          {results.map((result, index) => (
            <button
              key={result.logEntryId}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`w-full px-3 py-2.5 text-left border-b border-subtle/30 last:border-0 hover:bg-page ${
                index === activeIndex ? "bg-page" : ""
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => navigateToResult(result)}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-text-primary truncate">
                  {result.elementName}
                </span>
                <time
                  dateTime={result.entryDate}
                  className="shrink-0 text-[10px] text-text-muted"
                >
                  {formatActaEntryDateTime(result.entryDate)}
                </time>
              </div>
              <span className="block text-xs text-text-muted truncate">
                {result.categoryName}
              </span>
              <div className="mt-1">
                <ActasSearchHeadline headline={result.headline} />
              </div>
              <span className="mt-1 block text-[10px] text-text-muted">
                {result.authorLabel}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
