import type { ExampleItem } from "@/modules/_template/types";

/** Lógica de dominio pura — sin Supabase ni React. */
export function countExampleItems(items: ExampleItem[]): number {
  return items.length;
}

export function sortExampleItemsByName(items: ExampleItem[]): ExampleItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "es"));
}
