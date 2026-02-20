import { Plugin, WorkspaceLeaf } from 'obsidian';
import { YeartraceSettingTab } from "./settings";
import type { YeartraceSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { VIEW_TYPE_HEATMAP, HeatmapView } from './views/HeatmapView';
import { VIEW_TYPE_DAILY_PANEL, DailyPanelView } from './views/DailyPanelView';
import { recordsStore } from './store';

export default class YeartracePlugin extends Plugin {
	settings: YeartraceSettings;

	async onload() {
		await this.loadSettings();

		// Register the views
		this.registerView(VIEW_TYPE_HEATMAP, (leaf) => new HeatmapView(leaf, this));
		this.registerView(VIEW_TYPE_DAILY_PANEL, (leaf) => new DailyPanelView(leaf, this));

		// Register the settings tab
		this.addSettingTab(new YeartraceSettingTab(this.app, this));

		// Let's add a ribbon icon as a temporary entry point
		this.addRibbonIcon('calendar-days', 'Yeartrace Heatmap', (evt: MouseEvent) => {
			this.activateHeatmapView();
		});

		this.addCommand({
			id: 'open-yeartrace-heatmap',
			name: 'Open Yearly Heatmap',
			callback: () => {
				this.activateHeatmapView();
			}
		});

		this.addCommand({
			id: 'open-yeartrace-daily-panel',
			name: 'Open Daily Panel',
			callback: () => {
				this.activateDailyPanelView();
			}
		});
	}

	onunload() {
	}

	async activateHeatmapView() {
		const { workspace } = this.app;

		let leaf: any;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_HEATMAP);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf(true); // Open in a new center leaf
			await leaf?.setViewState({ type: VIEW_TYPE_HEATMAP, active: true });
		}

		if (leaf) workspace.revealLeaf(leaf);
	}

	async activateDailyPanelView() {
		const { workspace } = this.app;

		let leaf: any;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DAILY_PANEL);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			// Open in right sidebar
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_DAILY_PANEL, active: true });
		}

		if (leaf) workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<YeartraceSettings>);
		recordsStore.set(this.settings.records);
	}

	async saveSettings() {
		this.settings.records = require('svelte/store').get(recordsStore);
		await this.saveData(this.settings);
	}
}
