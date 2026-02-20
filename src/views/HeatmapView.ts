import { ItemView, type WorkspaceLeaf } from "obsidian";
import HeatmapComponent from "../components/Heatmap.svelte";
import type YeartracePlugin from "../main";

export const VIEW_TYPE_HEATMAP = "yeartrace-heatmap-view";

export class HeatmapView extends ItemView {
    plugin: YeartracePlugin;
    component: any = null;

    constructor(leaf: WorkspaceLeaf, plugin: YeartracePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_HEATMAP;
    }

    getDisplayText(): string {
        return "YearTrace - 年度热力图";
    }

    getIcon(): string {
        return "calendar-days";
    }

    async onOpen() {
        this.component = new HeatmapComponent({
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
