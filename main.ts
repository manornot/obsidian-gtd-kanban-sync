import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

interface MyPluginSettings {
    mySetting: string;
    targetFolder: string;
    kanbanBoardLocation: string;
    updateTime: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    mySetting: 'default',
    targetFolder: '',
    kanbanBoardLocation: '',
    updateTime: 30 // Default update time in seconds
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    private previousFileState: Set<string> = new Set();

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new SampleSettingTab(this.app, this));
        this.registerInterval(window.setInterval(() => {
            this.startFolderWatch();
        }, this.settings.updateTime * 1000));
		
		await this.startFolderWatch();
    }

    onunload() {
        // Additional unload logic if needed
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    startFolderWatch(): void {
        this.checkFolderChanges().then(changes => {
            if (Object.keys(changes).length > 0) {
				new Notice('Changes detected in the target folder. Updating Kanban board...');
                this.updateKanbanBoard(changes);
            }
        });
    }

	// async onKanbanFileChange(): Promise<void> {
	// 	try {
	// 		const kanbanFilePath = this.settings.kanbanBoardLocation;
	// 		const kanbanFile = this.app.vault.getAbstractFileByPath(kanbanFilePath) as TFile;
			
	// 		if (kanbanFile && kanbanFile instanceof TFile) {
	// 			// Read the current content of the Kanban file
	// 			const currentContent = await this.app.vault.read(kanbanFile);
				
	// 			// Parse the current content to understand the current state of tasks
	// 			const currentTasksState = this.parseTasksState(currentContent);
	
	// 			// Compare the current state with the previous state to detect what has moved
	// 			const movedTasks = this.detectMovedTasks(currentTasksState, this.previousTasksState);
				
	// 			// Execute the file movements based on the moved tasks
	// 			await this.executeFileMovements(movedTasks);
	
	// 			// Update the previous state to reflect the current state for future comparisons
	// 			this.previousTasksState = currentTasksState;
	// 		}
	// 	} catch (error) {
	// 		console.error("Error handling Kanban file change: ", error);
	// 	}
	// }

    async checkFolderChanges(): Promise<{ [key: string]: string[] }> {
        const changes: { [key: string]: string[] } = {};
        const folderPath = this.settings.targetFolder;
        const filesInFolder = this.app.vault.getFiles().filter(file => file.path.startsWith(folderPath));

        for (const file of filesInFolder) {
            const filePath = file.path;
            if (!this.previousFileState.has(filePath)) {
                const subfolder = this.extractSubfolder(filePath, folderPath);
                if (!changes[subfolder]) changes[subfolder] = [];
                changes[subfolder].push(file.basename);
                this.previousFileState.add(filePath);
            }
        }

        this.previousFileState.forEach(path => {
            if (!filesInFolder.some(file => file.path === path)) {
                this.previousFileState.delete(path);
                // Logic to handle deleted files, if needed
            }
        });
        return changes;
    }

    private extractSubfolder(filePath: string, folderPath: string): string {
		// Ensure we have a clean folderPath with a trailing slash
		const cleanFolderPath = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
		const relativePath = filePath.startsWith(cleanFolderPath) ? filePath.substring(cleanFolderPath.length) : filePath;
		const parts = relativePath.split('/');
		// Assuming the first non-empty part is the subfolder name
		return parts.find(part => part.trim() !== '') || ''; // Return the subfolder name or an empty string if not found
	}
	

	// private extractSubfolder(filePath: string, folderPath: string): string {
    //     const relativePath = filePath.substring(folderPath.length);
    //     const parts = relativePath.split('/');
    //     return parts[0]; // Assuming the first part is the subfolder name
    // }

    // async updateKanbanBoard(changes: { [key: string]: string[] }): Promise<void> {
    //     const kanbanFilePath = this.settings.kanbanBoardLocation;
    //     const kanbanFile = this.app.vault.getAbstractFileByPath(kanbanFilePath) as TFile;

    //     if (kanbanFile) {
    //         const content = await this.app.vault.read(kanbanFile);
    //         const newContent = this.modifyKanbanContent(content, changes);
    //         await this.app.vault.modify(kanbanFile, newContent);
    //     }
    // }

	async updateKanbanBoard(changes: { [key: string]: string[] }): Promise<void> {
		try {
			const kanbanFilePath = this.settings.kanbanBoardLocation;
				
			const kanbanFile = this.app.vault.getAbstractFileByPath(kanbanFilePath) as TFile;
	
			if (kanbanFile && kanbanFile instanceof TFile) {
				const content = await this.app.vault.read(kanbanFile);
				const newContent = this.modifyKanbanContent(content, changes);
				await this.app.vault.modify(kanbanFile, newContent);
			} else {
				console.error("Kanban file not found or is not a file.");
			}
		} catch (error) {
			console.error("Error updating Kanban board: ", error);
		}
	}

    modifyKanbanContent(content: string, changes: { [key: string]: string[] }): string {
		// Split the content into lines
		let lines = content.split('\n');
		// Map to keep track of the existing tasks
		let existingTasks = new Set<string>();
	
		// First, populate the existingTasks set with current tasks
		lines.forEach(line => {
			// This regex looks for markdown links with the format [[folder/file|alias]]
			const taskMatch = line.match(/\[\[(.*?)\|(.*?)\]\]/);
			if (taskMatch) {
				// The first capturing group is the folder/file, the second one is the alias
				const taskKey = taskMatch[1].trim();
				existingTasks.add(taskKey);
			}
		});
	
		// Iterate through each line and modify the content
		lines = lines.map(line => {
			// Check if the line is a heading
			if (line.startsWith('##')) {
				const heading = line.substring(2).trim();
				if (changes[heading]) {
					// Add new items under this heading
					changes[heading].forEach(item => {
						const taskKey = `${heading}/${item}`;
						if (!existingTasks.has(taskKey)) { // Check if the task is not already in the Kanban board
							line += `\n- [ ] [[${taskKey}|${item}]]`;
							existingTasks.add(taskKey);
						}
					});
				}
			}
			return line;
		});
	
		// Re-join the lines back into a single string
		return lines.join('\n');
	}
	
	
}

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

		new Setting(containerEl)
			.setName('Target Folder')
			.setDesc('Specify the target folder where the plugin should operate')
			.addText(text => text
				.setPlaceholder('Enter the path to the target folder')
				.setValue(this.plugin.settings.targetFolder)
				.onChange(async (value) => {
					this.plugin.settings.targetFolder = value;
					await this.plugin.saveSettings();
				}));

		// Setting for Kanban Board Location
		new Setting(containerEl)
			.setName('Kanban Board Location')
			.setDesc('Specify the location of the Kanban board file')
			.addText(text => text
				.setPlaceholder('Enter the path to the Kanban board file')
				.setValue(this.plugin.settings.kanbanBoardLocation)
				.onChange(async (value) => {
					this.plugin.settings.kanbanBoardLocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('Update Interval')
		.setDesc('Set the interval (in seconds) for checking changes in the folder')
		.addText(text => text
			.setPlaceholder('Enter the interval in seconds')
			.setValue(this.plugin.settings.updateTime.toString())
			.onChange(async (value) => {
				this.plugin.settings.updateTime = parseInt(value);
				await this.plugin.saveSettings();
			}));
	}
}
