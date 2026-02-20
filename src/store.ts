import { writable } from 'svelte/store';
import type { DayRecord, YeartraceSettings } from './types';

// We create a global writable store for the records dictionary
export const recordsStore = writable<Record<string, DayRecord>>({});

// Creating a store for settings ensures reactivity across all Svelte views
export const settingsStore = writable<YeartraceSettings | null>(null);
