import * as vscode from 'vscode';
import { Epic, Story, SprintData, StoryStatus } from './sprintParser';
import { isActionableStatus, getWorkflowAction } from './workflowRunner';

type TreeItemType = 'epic' | 'story';

export class StoryItem extends vscode.TreeItem {
    constructor(
        public readonly itemType: TreeItemType,
        public readonly data: Epic | Story,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(StoryItem.getLabel(itemType, data), collapsibleState);
        this.setupItem(itemType, data);
    }

    private setupItem(itemType: 'epic' | 'story', data: Epic | Story): void {
        const status = data.status;
        this.description = `[${status}]`;
        this.tooltip = this.getTooltip(itemType, data);
        this.iconPath = this.getIcon(status);

        if (itemType === 'story') {
            if (isActionableStatus(status)) {
                this.contextValue = 'story-actionable';
                const action = getWorkflowAction(status);
                if (action) {
                    this.tooltip = `${this.tooltip}\n\nClick play to: ${action.label}`;
                }
            } else {
                this.contextValue = 'story';
            }
        } else {
            this.contextValue = 'epic';
        }
    }

    private static getLabel(itemType: TreeItemType, data: Epic | Story): string {
        if (itemType === 'epic') {
            return (data as Epic).name;
        }
        return (data as Story).id;
    }

    private getTooltip(itemType: 'epic' | 'story', data: Epic | Story): string {
        if (itemType === 'epic') {
            const epic = data as Epic;
            const done = epic.stories.filter(s => s.status === 'done').length;
            return `${epic.name}: ${done}/${epic.stories.length} stories done`;
        }
        const story = data as Story;
        return `Story: ${story.id}\nStatus: ${story.status}`;
    }

    private getIcon(status: StoryStatus): vscode.ThemeIcon {
        switch (status) {
            case 'done':
            case 'completed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            case 'in-progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
            case 'review':
                return new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.orange'));
            case 'ready-for-dev':
                return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.yellow'));
            case 'backlog':
                return new vscode.ThemeIcon('circle-outline');
            case 'drafted':
                return new vscode.ThemeIcon('edit');
            default:
                return new vscode.ThemeIcon('question');
        }
    }
}

export class StoryTreeProvider implements vscode.TreeDataProvider<StoryItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<StoryItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private sprintData: SprintData | null = null;

    setData(data: SprintData | null): void {
        this.sprintData = data;
        this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StoryItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: StoryItem): Thenable<StoryItem[]> {
        if (!this.sprintData) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Root level: show epics
            return Promise.resolve(
                this.sprintData.epics.map(epic =>
                    new StoryItem(
                        'epic',
                        epic,
                        vscode.TreeItemCollapsibleState.Expanded
                    )
                )
            );
        }

        if (element.itemType === 'epic') {
            // Epic level: show stories
            const epic = element.data as Epic;
            return Promise.resolve(
                epic.stories.map(story =>
                    new StoryItem(
                        'story',
                        story,
                        vscode.TreeItemCollapsibleState.None
                    )
                )
            );
        }

        return Promise.resolve([]);
    }
}
