"use client";

import { useSyncExternalStore } from "react";

export type CartLine = { id: string; qty: number };

const KEY = "cart:v1";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: CartLine[] } = { raw: null, value: EMPTY };

function isLine(x: unknown): x is CartLine {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as CartLine).id === "string" &&
    Number.isInteger((x as CartLine).qty) &&
    (x as CartLine).qty > 0
  );
}

function getSnapshot(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {}
  if (raw === cache.raw) return cache.value;
  let value = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) value = parsed.filter(isLine);
    } catch {}
  }
  cache = { raw, value };
  return value;
}

function emit() {
  listeners.forEach((l) => l());
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {}
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    add(id: string, qty = 1, max = 20) {
      const current = getSnapshot();
      const existing = current.find((l) => l.id === id);
      const next = existing
        ? current.map((l) => (l.id === id ? { ...l, qty: Math.min(max, l.qty + qty) } : l))
        : [...current, { id, qty: Math.min(max, qty) }];
      write(next);
    },
    setQty(id: string, qty: number) {
      const current = getSnapshot();
      write(
        qty <= 0
          ? current.filter((l) => l.id !== id)
          : current.map((l) => (l.id === id ? { ...l, qty } : l)),
      );
    },
    remove(id: string) {
      write(getSnapshot().filter((l) => l.id !== id));
    },
    clear() {
      write([]);
    },
  };
}
