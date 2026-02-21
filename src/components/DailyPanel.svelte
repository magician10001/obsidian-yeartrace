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
        statusTierId: '',
        summary: '',
        inspirations: [],
        mood: [],
        harvests: [],
        reflections: { stuck: '', improvement: '' }
    };

    // Ensure backwards compatibility with old records that don't have these arrays
    $: _currentRecord = {
        ...currentRecord,
        summary: currentRecord.summary || '',
        inspirations: currentRecord.inspirations || [],
        mood: currentRecord.mood || [],
        harvests: currentRecord.harvests || [],
        reflections: currentRecord.reflections || { stuck: '', improvement: '' }
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
                    statusTierId: '',
                    summary: '',
                    inspirations: [],
                    mood: [],
                    harvests: [],
                    reflections: { stuck: '', improvement: '' }
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

    // --- Local Form State to prevent input blocking ---
    let localDate = '';
    let localSummary = '';
    let localStuck = '';
    let localImprovement = '';

    $: {
        if (currentDate !== localDate) {
            localDate = currentDate;
            const rec = records[currentDate];
            localSummary = rec?.summary || '';
            localStuck = rec?.reflections?.stuck || '';
            localImprovement = rec?.reflections?.improvement || '';
        }
    }

    let formTimeout: any;
    function handleFormInput() {
        clearTimeout(formTimeout);
        formTimeout = setTimeout(async () => {
            recordsStore.update(recs => {
                const date = localDate;
                if (!recs[date]) {
                    recs[date] = {
                        date,
                        behaviors: {},
                        score: 0,
                        statusTierId: '',
                        summary: '',
                        inspirations: [],
                        mood: [],
                        harvests: [],
                        reflections: { stuck: '', improvement: '' }
                    };
                }
                recs[date].summary = localSummary;
                if (!recs[date].reflections) recs[date].reflections = { stuck: '', improvement: '' };
                recs[date].reflections!.stuck = localStuck;
                recs[date].reflections!.improvement = localImprovement;
                return recs;
            });
            await plugin.saveSettings();
        }, 800);
    }

    // --- Record Modules Logic ---
    let newInspiration = '';
    let newHarvest = '';

    const presetMoods = [
        { id: 'Core', label: '核心记忆', emoji: '🌟' },
        { id: 'Joy', label: '开心', emoji: '😊' },
        { id: 'Sad', label: '难过', emoji: '😢' },
        { id: 'Fear', label: '害怕', emoji: '😨' },
        { id: 'Angry', label: '生气', emoji: '😡' },
        { id: 'Disgust', label: '厌恶', emoji: '😣' },
        { id: 'Anxiety', label: '焦虑', emoji: '😰' },
        { id: 'Envy', label: '羡慕', emoji: '🥺' },
        { id: 'Embarrassed', label: '尴尬', emoji: '😅' },
        { id: 'Ennui', label: '丧', emoji: '🫠' },
        { id: 'Nostalgia', label: '怀旧', emoji: '🕰️' },
        { id: 'Thanks', label: '感谢', emoji: '🙏' }
    ];

    async function addArrayRecord(field: 'inspirations' | 'harvests', value: string) {
        if (!value.trim()) return;
        recordsStore.update(recs => {
            if (!recs[currentDate]) recs[currentDate] = _currentRecord;
            if (!recs[currentDate][field]) recs[currentDate][field] = [];
            recs[currentDate][field]!.push(value);
            return recs;
        });
        await plugin.saveSettings();
        if (field === 'inspirations') newInspiration = '';
        if (field === 'harvests') newHarvest = '';
    }

    async function removeArrayRecord(field: 'inspirations' | 'harvests', index: number) {
        recordsStore.update(recs => {
            if (recs[currentDate] && recs[currentDate][field]) {
                recs[currentDate][field]!.splice(index, 1);
            }
            return recs;
        });
        await plugin.saveSettings();
    }

    async function toggleMood(moodId: string) {
        recordsStore.update(recs => {
            if (!recs[currentDate]) recs[currentDate] = _currentRecord;
            if (!recs[currentDate].mood) recs[currentDate].mood = [];
            const idx = recs[currentDate].mood!.indexOf(moodId);
            if (idx === -1) {
                recs[currentDate].mood!.push(moodId);
            } else {
                recs[currentDate].mood!.splice(idx, 1);
            }
            return recs;
        });
        await plugin.saveSettings();
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

    <!-- Record Modules -->
    <div class="record-modules">
        <!-- 📝 Summary -->
        <div class="module-card">
            <div class="module-title">📝 一句话总结 <span>#Note/life/summary</span></div>
            <div class="module-content">
                <input class="record-input" 
                       type="text" 
                       placeholder="用一句话描述今天..." 
                       bind:value={localSummary}
                       on:input={handleFormInput} />
            </div>
        </div>

        <!-- 💡 Inspiration -->
        <div class="module-card">
            <div class="module-title">💡 灵感记录 <span>#Note/life/Memos</span></div>
            <div class="module-content">
                <div class="input-with-btn">
                    <input class="record-input" 
                           type="text" 
                           placeholder="突然想到的 idea (回车添加)..." 
                           bind:value={newInspiration}
                           on:keydown={(e) => e.key === 'Enter' && addArrayRecord('inspirations', newInspiration)} />
                    <button class="add-btn" 
                            disabled={!newInspiration.trim()}
                            on:click={() => addArrayRecord('inspirations', newInspiration)}>
                        +
                    </button>
                </div>
                <div class="record-list">
                    {#each _currentRecord.inspirations as insp, i}
                        <div class="record-item">
                            <span>{insp}</span>
                            <button class="del-btn" on:click={() => removeArrayRecord('inspirations', i)}>×</button>
                        </div>
                    {/each}
                </div>
            </div>
        </div>

        <!-- 🌤️ Mood -->
        <div class="module-card">
            <div class="module-title">🌤️ 心情记录 <span>#Note/life/mood/...</span></div>
            <div class="module-content mood-grid">
                {#each presetMoods as m}
                    <button class="mood-tag {_currentRecord.mood.includes(m.id) ? 'active' : ''}" 
                            on:click={() => toggleMood(m.id)}>
                        {m.emoji} {m.label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- 🎁 Harvest -->
        <div class="module-card">
            <div class="module-title">🎁 收获记录 <span>#Note/life/yeah</span></div>
            <div class="module-content">
                <div class="input-with-btn">
                    <input class="record-input" 
                           type="text" 
                           placeholder="哪怕很小，比如想明白一个公式 (回车添加)..." 
                           bind:value={newHarvest}
                           on:keydown={(e) => e.key === 'Enter' && addArrayRecord('harvests', newHarvest)} />
                    <button class="add-btn" 
                            disabled={!newHarvest.trim()}
                            on:click={() => addArrayRecord('harvests', newHarvest)}>
                        +
                    </button>
                </div>
                <div class="record-list">
                    {#each _currentRecord.harvests as harv, i}
                        <div class="record-item">
                            <span>{harv}</span>
                            <button class="del-btn" on:click={() => removeArrayRecord('harvests', i)}>×</button>
                        </div>
                    {/each}
                </div>
            </div>
        </div>

        <!-- 🔍 Reflections -->
        <div class="module-card">
            <div class="module-title">🔍 反思与改进 <span>#Note/life/hard</span></div>
            <div class="module-content reflection-inputs">
                <div class="reflection-field">
                    <label>今天最卡的是哪一步？</label>
                    <textarea class="record-textarea" 
                              bind:value={localStuck}
                              on:input={handleFormInput}
                              placeholder="..." rows="2"></textarea>
                </div>
                <div class="reflection-field">
                    <label>下次我可以怎么让它更顺一点？</label>
                    <textarea class="record-textarea" 
                              bind:value={localImprovement}
                              on:input={handleFormInput}
                              placeholder="..." rows="2"></textarea>
                </div>
            </div>
        </div>
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

    /* Record Modules CSS */
    .record-modules {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 10px;
        border-top: 1px solid var(--background-modifier-border);
        padding-top: 20px;
    }
    .module-card {
        background: var(--background-secondary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 12px;
    }
    .module-title {
        font-size: 0.9em;
        font-weight: 600;
        margin-bottom: 10px;
        color: var(--text-normal);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .module-title span {
        font-size: 0.75em;
        color: var(--text-faint);
        font-weight: normal;
        background: var(--background-primary);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px dashed var(--background-modifier-border-hover);
    }
    .module-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .input-with-btn {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    .input-with-btn .record-input {
        flex: 1;
    }
    .add-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 6px;
        font-size: 1.2em;
        font-weight: bold;
        width: 32px;
        height: 32px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: opacity 0.2s, background 0.2s;
    }
    .add-btn:hover:not(:disabled) {
        opacity: 0.9;
        background: var(--interactive-accent-hover);
    }
    .add-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .record-input {
        width: 100%;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 0.85em;
    }
    .record-textarea {
        width: 100%;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 0.85em;
        resize: vertical;
    }
    .record-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .record-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--background-primary);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 0.85em;
        color: var(--text-muted);
        border-left: 2px solid var(--interactive-accent);
    }
    .del-btn {
        background: transparent;
        border: none;
        color: var(--text-faint);
        cursor: pointer;
        padding: 2px 6px;
    }
    .del-btn:hover {
        color: var(--text-error);
    }
    .mood-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .mood-tag {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-muted);
        padding: 4px 10px;
        border-radius: 14px;
        font-size: 0.8em;
        cursor: pointer;
        transition: all 0.2s;
    }
    .mood-tag:hover {
        background: var(--background-modifier-hover);
    }
    .mood-tag.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
    }
    .reflection-inputs {
        gap: 12px;
    }
    .reflection-field label {
        display: block;
        font-size: 0.8em;
        color: var(--text-muted);
        margin-bottom: 4px;
    }
</style>
