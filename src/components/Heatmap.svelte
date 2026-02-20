<script lang="ts">
    import type YeartracePlugin from "../main";
    import { recordsStore } from "../store";
    const _keep = recordsStore; // Prevent TS from stripping the import when only used via $
    
    export let plugin: YeartracePlugin;

    let year = new Date().getFullYear();
    
    // For reactivity
    $: settings = plugin.settings;
    $: statusTiers = settings.statusTiers;
    $: records = $recordsStore;



    function getGridDays(y: number) {
        let date = new Date(y, 0, 1);
        const startDayOfWeek = date.getDay(); // 0 is Sunday
        
        let days = [];
        // Add padding for the first week so Jan 1 falls on the correct weekday row
        for(let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        
        while (date.getFullYear() === y) {
             const offset = date.getTimezoneOffset();
             const localDate = new Date(date.getTime() - (offset*60*1000));
            days.push(localDate.toISOString().split('T')[0]);
            date.setDate(date.getDate() + 1);
        }
        return days;
    }

    $: gridDays = getGridDays(year);

    function getColorForDay(dateStr: string, recs: any, tiers: any) {
        const record = recs[dateStr];
        if (!record || !record.statusTierId) return 'var(--background-modifier-border)'; // empty state
        const tier = tiers.find((t: any) => t.id === record.statusTierId);
        return tier ? tier.color : 'var(--background-modifier-border)';
    }

    function getTooltipForDay(dateStr: string, recs: any, tiers: any) {
        const record = recs[dateStr];
        if (!record) return `${dateStr} (暂无记录)`;
        const tier = tiers.find((t: any) => t.id === record.statusTierId);
        return `${dateStr}\n得分: ${record.score}\n状态: ${tier?.name || '未知'}`;
    }

    function selectDate(dateStr: string) {
        // Here we could dispatch an event to the rest of obsidian 
        // Or we could directly update a shared store if we want to sync the Side Bar
        console.log("Selected date", dateStr);
        // Dispatching a custom DOM event so the Daily Panel can pick it up
        document.dispatchEvent(new CustomEvent('yeartrace-date-selected', { detail: dateStr }));
        
        // Let's also open the Daily Panel directly for convenience
        plugin.activateDailyPanelView();
    }

    function getToday() {
        const offset = new Date().getTimezoneOffset();
        const date = new Date(new Date().getTime() - (offset*60*1000));
        return date.toISOString().split('T')[0];
    }

    function openTodayPanel() {
        const todayStr = getToday();
        document.dispatchEvent(new CustomEvent('yeartrace-date-selected', { detail: todayStr }));
        plugin.activateDailyPanelView();
    }
</script>

<div class="heatmap-wrapper">
    <div class="header">
        <button class="nav-btn" on:click={() => year--}>&lt;</button>
        <h2>{year} 年度追溯 (YearTrace)</h2>
        <button class="nav-btn" on:click={() => year++}>&gt;</button>
        <button class="today-btn" on:click={openTodayPanel}>打卡今日</button>
    </div>
    
    <div class="grid-container">
        <div class="grid">
            {#each gridDays as dateStr}
                {#if dateStr === null}
                    <div class="day-cell empty"></div>
                {:else}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div class="day-cell" 
                         style="background-color: {getColorForDay(dateStr, records, statusTiers)}"
                         title={getTooltipForDay(dateStr, records, statusTiers)}
                         on:click={() => selectDate(dateStr)}>
                    </div>
                {/if}
            {/each}
        </div>
    </div>
    
    <div class="legend">
        <span>Less</span>
        <div class="day-cell" style="background-color: var(--background-modifier-border)"></div>
        {#each statusTiers.slice().sort((a,b) => a.minScore - b.minScore) as tier}
            <div class="day-cell" style="background-color: {tier.color}" title="{tier.name} ({tier.minScore}分起)"></div>
        {/each}
        <span>More</span>
    </div>
</div>

<style>
    .heatmap-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 20px;
        color: var(--text-normal);
        height: 100%;
        overflow-y: auto;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 30px;
    }

    .nav-btn {
        background: transparent;
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
        border-radius: 4px;
        padding: 4px 12px;
        cursor: pointer;
    }
    .nav-btn:hover {
        background: var(--background-modifier-hover);
    }
    
    .today-btn {
        margin-left: auto; /* Push to the right */
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        padding: 6px 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s ease;
    }
    .today-btn:hover {
        opacity: 0.9;
    }

    .grid-container {
        padding: 24px;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 12px;
        overflow-x: auto;
        max-width: 100%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .grid {
        display: grid;
        grid-template-rows: repeat(7, 1fr);
        grid-auto-flow: column;
        gap: 4px;
    }

    .day-cell {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    
    .day-cell:not(.empty):hover {
        transform: scale(1.3);
        box-shadow: 0 0 5px rgba(0,0,0,0.4);
        z-index: 10;
        position: relative;
    }

    .day-cell.empty {
        background-color: transparent;
        cursor: default;
    }
    
    .legend {
        margin-top: 30px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85em;
        color: var(--text-muted);
    }
</style>
