import { App, PluginSettingTab, Setting, type TextComponent } from "obsidian";
import type YeartracePlugin from "./main";

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export class YeartraceSettingTab extends PluginSettingTab {
	plugin: YeartracePlugin;

	constructor(app: App, plugin: YeartracePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Yeartrace - 设置' });

		this.displayBehaviors(containerEl);
		this.displayStatusTiers(containerEl);
	}

	private displayBehaviors(containerEl: HTMLElement) {
		containerEl.createEl('h3', { text: '追踪行为 (Behaviors)' });
		containerEl.createEl('p', { text: '设置你每天要追踪的习惯行为，以及它们的得分权重。', cls: 'setting-item-description' });

		this.plugin.settings.behaviors.forEach((behavior, index) => {
			const setting = new Setting(containerEl)
				.addText(text => text
					.setPlaceholder('行为名称 (如: 运动)')
					.setValue(behavior.name)
					.onChange(async (value) => {
						behavior.name = value;
						await this.plugin.saveSettings();
					})
				)
				.addText(text => text
					.setPlaceholder('分值 (如: 3)')
					.setValue(behavior.score.toString())
					.onChange(async (value) => {
						const score = parseInt(value);
						if (!isNaN(score)) {
							behavior.score = score;
							await this.plugin.saveSettings();
						}
					})
				)
				.addToggle(toggle => toggle
					.setTooltip('是否可重复记录多次 (例如：每喝一次水算一次)')
					.setValue(behavior.repeatable)
					.onChange(async (value) => {
						behavior.repeatable = value;
						await this.plugin.saveSettings();
					})
				)
				.addButton(btn => btn
					.setButtonText('删除')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.behaviors.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
				);
			// Hide the name/description area to save space for multiple inputs
			setting.infoEl.style.display = 'none';
		});

		new Setting(containerEl)
			.addButton(btn => btn
				.setButtonText('+ 新增行为')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.behaviors.push({
						id: generateId(),
						name: '',
						score: 1,
						repeatable: false
					});
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}

	private displayStatusTiers(containerEl: HTMLElement) {
		containerEl.createEl('br');
		containerEl.createEl('h3', { text: '状态档位 (Status Tiers)' });
		containerEl.createEl('p', { text: '定义每天总分所对应的状态，以及在年度热力图上的颜色。', cls: 'setting-item-description' });

		this.plugin.settings.statusTiers.forEach((tier, index) => {
			const setting = new Setting(containerEl)
				.addText(text => text
					.setPlaceholder('档位名称 (如: 高峰)')
					.setValue(tier.name)
					.onChange(async (value) => {
						tier.name = value;
						await this.plugin.saveSettings();
					})
				)
				.addText(text => text
					.setPlaceholder('最低分要求 (如: 6)')
					.setValue(tier.minScore.toString())
					.onChange(async (value) => {
						const score = parseInt(value);
						if (!isNaN(score)) {
							tier.minScore = score;
							await this.plugin.saveSettings();
						}
					})
				)
				.addText(text => text
					.setPlaceholder('颜色代码 (如: #ff0000 或是 var(--color-blue))')
					.setValue(tier.color)
					.onChange(async (value) => {
						tier.color = value;
						await this.plugin.saveSettings();
					})
				)
				.addButton(btn => btn
					.setButtonText('删除')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.statusTiers.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
				);
			setting.infoEl.style.display = 'none';
		});

		new Setting(containerEl)
			.addButton(btn => btn
				.setButtonText('+ 新增档位')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.statusTiers.push({
						id: generateId(),
						name: '',
						minScore: 0,
						color: 'var(--color-base-40)'
					});
					this.plugin.settings.statusTiers.sort((a, b) => a.minScore - b.minScore);
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}
}
