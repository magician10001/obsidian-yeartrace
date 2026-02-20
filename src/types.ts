export interface DayRecord {
    date: string; // YYYY-MM-DD
    behaviors: Record<string, number | boolean>; // behaviorId -> count or completed
    score: number;
    statusTierId: string;
    note?: string;
}

export type BehaviorType = 'main' | 'secondary' | 'habit';

export interface Behavior {
    id: string; // uuid
    name: string;
    score: number; // For main/secondary, this might be unused or overridden, but kept for habits
    repeatable: boolean;
    type: BehaviorType;
    maxCount?: number;
    category?: string;
}

export interface StatusTier {
    id: string; // uuid
    name: string;
    minScore: number;
    color: string;
}

export interface Goal {
    id: string;
    title: string;
    level: 'year' | 'month' | 'week' | 'day';
    dateRange: { start: string; end: string };
    status: 'in-progress' | 'completed' | 'abandoned';
}

export interface YeartraceSettings {
    behaviors: Behavior[];
    statusTiers: StatusTier[];
    goals: Goal[];
    // We'll store records in a separate data file ideally, 
    // but for Obsidian plugins it's common to put everything in data.json.
    // For performance with many days, we might keep it in standard properties 
    // or inside plugin settings. We'll store it in plugin settings for MVP.
    records: Record<string, DayRecord>; // date -> DayRecord
}

export const DEFAULT_SETTINGS: YeartraceSettings = {
    behaviors: [
        { id: 'b1', name: '文献阅读', score: 1, repeatable: true, type: 'main' },
        { id: 'b2', name: '项目编码', score: 1, repeatable: true, maxCount: 10, type: 'secondary' },
        { id: 'b3', name: '早睡', score: 2, repeatable: false, type: 'habit' }
    ],
    statusTiers: [
        { id: 't1', name: '低能量', minScore: 0, color: 'var(--color-base-40)' },
        { id: 't2', name: '普通', minScore: 3, color: 'var(--color-green)' },
        { id: 't3', name: '良好', minScore: 6, color: 'var(--color-blue)' },
        { id: 't4', name: '高峰', minScore: 9, color: 'var(--color-purple)' }
    ],
    goals: [],
    records: {}
};
