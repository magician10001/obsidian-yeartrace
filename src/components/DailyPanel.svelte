<script lang="ts">
    import type YeartracePlugin from "../main";
    import { recordsStore } from "../store";
    
    export let plugin: YeartracePlugin;

    import { onMount } from "svelte";

    // Get today's date in local timezone YYYY-MM-DD
    function getToday() {
        const offset = new Date().getTimezoneOffset();
        const date = new Date(new Date().getTime() - (offset*60*1000));
        return date.toISOString().split('T')[0];
    }

    let currentDate = getToday();

    onMount(() => {
        const handleDateSelect = (e: Event) => {
            const dateStr = (e as CustomEvent).detail;
            currentDate = dateStr;
        };
        document.addEventListener('yeartrace-date-selected', handleDateSelect);
        
        return () => {
            document.removeEventListener('yeartrace-date-selected', handleDateSelect);
        };
    });

    // The plugin.settings could be empty initially, reactivity trick
    $: settings = plugin.settings;
    $: records = $recordsStore;
    
    $: currentRecord = records[currentDate] || {
        date: currentDate,
        behaviors: {},
        score: 0,
        statusTierId: ''
    };

    $: behaviors = settings.behaviors;
    $: statusTiers = settings.statusTiers;

    // Computed properties
    $: currentTier = getStatusTier(currentRecord.score);

    function getStatusTier(score: number) {
        if (!statusTiers || statusTiers.length === 0) return null;
        let matchedTier = statusTiers[0];
        for (const tier of statusTiers) {
            if (score >= tier.minScore) {
                matchedTier = tier;
            }
        }
        return matchedTier;
    }

    async function toggleBehavior(behaviorId: string, delta: number, repeatable: boolean, checkedVal?: boolean) {
        recordsStore.update(recs => {
            if (!recs[currentDate]) {
                recs[currentDate] = {
                    date: currentDate,
                    behaviors: {},
                    score: 0,
                    statusTierId: ''
                };
            }
            
            const record = recs[currentDate];

            if (repeatable) {
                const currentCount = typeof record.behaviors[behaviorId] === 'number' ? record.behaviors[behaviorId] as number : 0;
                const newCount = Math.max(0, currentCount + delta);
                record.behaviors[behaviorId] = newCount;
            } else {
                // For non-repeatable
                record.behaviors[behaviorId] = checkedVal!;
            }

            recalculateScore(record);
            return recs;
        });
        
        // Save to file
        await plugin.saveSettings();
    }

    function recalculateScore(record: any) {
        let total = 0;
        for (const b of behaviors) {
            const val = record.behaviors[b.id];
            if (val === true) {
                total += b.score;
            } else if (typeof val === 'number') {
                total += val * b.score;
            }
        }
        record.score = total;
        record.statusTierId = getStatusTier(total)?.id || '';
    }
</script>

<div class="yeartrace-daily-container">
    <div class="header">
        <input type="date" bind:value={currentDate} class="date-picker" />
        <div class="status-summary" style="color: {currentTier?.color || 'var(--text-normal)'}">
            <span class="score">{currentRecord.score} 分</span>
            <span class="tier-name">{currentTier?.name || '未知状态'}</span>
        </div>
    </div>

    <div class="behaviors-list">
        {#each behaviors as b}
            <div class="behavior-item">
                <div class="behavior-info">
                    <span class="behavior-name">{b.name}</span>
                    <span class="behavior-score">(+{b.score})</span>
                </div>
                
                <div class="behavior-actions">
                    {#if b.repeatable}
                        <button class="btn decreament" on:click={() => toggleBehavior(b.id, -1, true)}>-</button>
                        <span class="count">{currentRecord.behaviors[b.id] || 0}</span>
                        <button class="btn increment" on:click={() => toggleBehavior(b.id, 1, true)}>+</button>
                    {:else}
                        <input type="checkbox" 
                               class="behavior-checkbox"
                               checked={!!currentRecord.behaviors[b.id]}
                               on:change={(e) => toggleBehavior(b.id, 0, false, e.currentTarget.checked)} />
                    {/if}
                </div>
            </div>
        {/each}
        {#if behaviors.length === 0}
            <p class="empty-msg">请先在设置中配置你的日常行为。</p>
        {/if}
    </div>
</div>

<style>
    .yeartrace-daily-container {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        color: var(--text-normal);
    }
    .header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid var(--background-modifier-border);
        padding-bottom: 16px;
    }
    .date-picker {
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
        font-size: 1.1em;
        font-weight: bold;
        outline: none;
        border-radius: 8px;
        padding: 6px 12px;
        cursor: pointer;
    }
    .status-summary {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.5em;
        font-weight: 800;
        transition: color 0.3s ease;
    }
    .score {
        background: var(--background-modifier-hover);
        padding: 4px 12px;
        border-radius: 8px;
    }
    .tier-name {
        font-size: 0.9em;
    }
    .behaviors-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .behavior-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    .behavior-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .behavior-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .behavior-name {
        font-weight: 600;
        font-size: 1.1em;
    }
    .behavior-score {
        color: var(--text-muted);
        font-size: 0.85em;
    }
    .behavior-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .btn {
        background: var(--interactive-normal);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.3em;
        font-weight: bold;
        transition: background 0.2s ease;
    }
    .btn:hover {
        background: var(--interactive-hover);
    }
    .count {
        min-width: 24px;
        text-align: center;
        font-weight: bold;
        font-size: 1.2em;
    }
    .behavior-checkbox {
        width: 24px;
        height: 24px;
        cursor: pointer;
    }
    .empty-msg {
        text-align: center;
        color: var(--text-muted);
        margin-top: 20px;
        font-size: 0.9em;
    }
</style>
