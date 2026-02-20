import { ItemView, type WorkspaceLeaf } from "obsidian";
import DailyPanelComponent from "../components/DailyPanel.svelte";
import type YeartracePlugin from "../main";

export const VIEW_TYPE_DAILY_PANEL = "yeartrace-daily-panel-view";

export class DailyPanelView extends ItemView {
    plugin: YeartracePlugin;
    component: any = null;

    constructor(leaf: WorkspaceLeaf, plugin: YeartracePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_DAILY_PANEL;
    }

    getDisplayText(): string {
        return "YearTrace - 今日状态";
    }

    getIcon(): string {
        return "check-circle";
    }

    async onOpen() {
        this.component = new DailyPanelComponent({
            target: this.contentEl,
            props: {
                plugin: this.plugin
            }
        });
    }

    async onClose() {
        if (this.component) {
            this.component.$destroy();
        }
    }
}
