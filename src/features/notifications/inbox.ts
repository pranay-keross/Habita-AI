import {
  addNotification,
  loadNotifications,
  markRead,
  markSectionRead,
  saveNotifications,
  type StoredNotification,
} from './notificationStore';
import type { PushPayload, PushSection } from './types';

/**
 * The inbox as a single module-level store, subscribed to with
 * `useSyncExternalStore`.
 *
 * This exists because the inbox is mounted in more than one place — the Medicine
 * screen, the Resources screen, and the root for tap routing. Giving each mount
 * its own `useState` would mean three copies of the same list, three loads, and
 * three writers racing on one AsyncStorage key: marking an alert read on one
 * screen would be silently undone by the next write from another. One store with
 * many subscribers is the only version of this that is correct.
 *
 * Same shape as the theme singleton (`docs/DECISIONS.md` D-004) and the i18n
 * language store — a mutable value outside React plus a subscribe function,
 * which is exactly what `useSyncExternalStore` is for.
 */

let items: StoredNotification[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/**
 * The snapshot must be reference-stable between changes: `useSyncExternalStore`
 * compares by identity and re-renders forever if handed a new array each call.
 */
export function getSnapshot(): StoredNotification[] {
  return items;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: StoredNotification[]): void {
  items = next;
  listeners.forEach((l) => l());
}

/** Reads the persisted inbox once per app run; concurrent callers share it. */
export function hydrate(): Promise<void> {
  if (loaded) {
    return Promise.resolve();
  }
  if (loading === null) {
    loading = loadNotifications().then((stored) => {
      loaded = true;
      loading = null;
      if (stored.length > 0) {
        emit(stored);
      }
    });
  }
  return loading;
}

export function isHydrated(): boolean {
  return loaded;
}

/** Records an arrival. No-ops on a duplicate, so no write and no re-render. */
export function receive(payload: PushPayload, at: number = Date.now()): void {
  const next = addNotification(items, payload, at);
  if (next !== items) {
    emit(next);
    void saveNotifications(next);
  }
}

export function readOne(id: string): void {
  const next = markRead(items, id);
  if (next.some((n, i) => n !== items[i])) {
    emit(next);
    void saveNotifications(next);
  }
}

export function readSection(section: PushSection): void {
  const next = markSectionRead(items, section);
  if (next.some((n, i) => n !== items[i])) {
    emit(next);
    void saveNotifications(next);
  }
}

/** Test seam — resets module state between cases. */
export function resetForTests(): void {
  items = [];
  loaded = false;
  loading = null;
  listeners.clear();
}
