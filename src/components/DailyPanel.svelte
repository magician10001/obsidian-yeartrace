<script lang="ts">
    import type YeartracePlugin from "../main";
    import { recordsStore, settingsStore } from "../store";
    
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

    // Create reactive dependency on the store, falling back to plugin.settings if undefined momentarily
    $: settings = $settingsStore || plugin.settings;
    $: records = $recordsStore;
    
    $: currentRecord = records[currentDate] || {
        date: currentDate,
        behaviors: {},
        score: 0,
        statusTierId: ''
    };

    $: behaviors = settings.behaviors;
    $: mainBehaviors = behaviors.filter(b => b.type === 'main');
    $: secondaryBehaviors = behaviors.filter(b => b.type === 'secondary');
    $: habitBehaviors = behaviors.filter(b => !b.type || b.type === 'habit');
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
        let a = 0; // main count
        let b = 0; // secondary count
        let habitsScore = 0;

        for (const behavior of behaviors) {
            const val = record.behaviors[behavior.id];
            
            if (behavior.type === 'main') {
                if (typeof val === 'number') a += val;
            } else if (behavior.type === 'secondary') {
                if (typeof val === 'number') b += val;
            } else {
                // habits or undefined default
                if (val === true) habitsScore += behavior.score;
                else if (typeof val === 'number') habitsScore += val * behavior.score;
            }
        }

        let mainSecScore = 0;
        if (a < 6) {
            mainSecScore = a * 8 + b * 1;
        } else if (a >= 6 && a <= 8) {
            if (b <= 3) {
                mainSecScore = a * 8 + b * 8;
            } else {
                mainSecScore = a * 8 + 3 * 8 + (b - 3) * 5;
            }
        } else if (a > 8) {
            if (b <= 3) {
                mainSecScore = 8 * 8 + (a - 8) * 5 + b * 8;
            } else {
                mainSecScore = 8 * 8 + (a - 8) * 5 + 3 * 8 + (b - 3) * 5;
            }
        }

        const total = mainSecScore + habitsScore;
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
        {#if mainBehaviors.length > 0}
            <div class="section-title">👑 主项 (科研/工作)</div>
            {#each mainBehaviors as b}
                <div class="behavior-item">
                    <div class="behavior-info">
                        <span class="behavior-name">{b.name}</span>
                        <span class="behavior-score">番茄钟</span>
                    </div>
                    <div class="behavior-actions">
                        <button class="btn decreament" on:click={() => toggleBehavior(b.id, -1, true)}>-</button>
                        <span class="count">{currentRecord.behaviors[b.id] || 0}</span>
                        <button class="btn increment" on:click={() => toggleBehavior(b.id, 1, true)}>+</button>
                    </div>
                </div>
            {/each}
        {/if}

        {#if secondaryBehaviors.length > 0}
            <div class="section-title">🎯 副项 (个人提升)</div>
            {#each secondaryBehaviors as b}
                <div class="behavior-item">
                    <div class="behavior-info">
                        <span class="behavior-name">{b.name}</span>
                        <span class="behavior-score">番茄钟</span>
                    </div>
                    <div class="behavior-actions">
                        <button class="btn decreament" on:click={() => toggleBehavior(b.id, -1, true)}>-</button>
                        <span class="count">{currentRecord.behaviors[b.id] || 0}</span>
                        <button class="btn increment" on:click={() => toggleBehavior(b.id, 1, true)}>+</button>
                    </div>
                </div>
            {/each}
        {/if}

        {#if habitBehaviors.length > 0}
            <div class="section-title">💡 其他习惯</div>
            {#each habitBehaviors as b}
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
        {/if}
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
    .section-title {
        font-size: 0.85em;
        font-weight: bold;
        color: var(--text-muted);
        text-transform: uppercase;
        margin-top: 10px;
        margin-bottom: -4px;
        padding-bottom: 4px;
        border-bottom: 1px dashed var(--background-modifier-border);
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
