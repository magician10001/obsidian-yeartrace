import { writable } from 'svelte/store';
import type { DayRecord } from './types';

// We create a global writable store for the records dictionary
export const recordsStore = writable<Record<string, DayRecord>>({});
