# Phase-Based Workflow UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Clique with four phase-based tabs (Discovery, Planning, Solutioning, Implementation) that read from `bmm-workflow-status.yaml` and show rich workflow cards with detail panels.

**Architecture:** Reorganize code into `src/core/` for shared infrastructure and `src/phases/` for phase-specific tree providers. Add webview-based detail panel and welcome view. Preserve existing sprint-status functionality in Implementation tab.

**Tech Stack:** VS Code Extension API, TypeScript, YAML parser, Webview API

---

## Task 1: Create Core Types

**Files:**
- Create: `src/core/types.ts`

**Step 1: Create the types file**

```typescript
// src/core/types.ts

// Workflow item from bmm-workflow-status.yaml
export interface WorkflowItem {
    id: string;
    phase: number | 'prerequisite';
    status: string;  // 'required' | 'optional' | 'conditional' | 'skipped' | file path
    agent: string;
    command: string;
    note?: string;
}

export interface WorkflowData {
    lastUpdated: string;
    status: string;
    statusNote?: string;
    project: string;
    projectType: string;
    selectedTrack: string;
    fieldType: string;
    workflowPath: string;
    items: WorkflowItem[];
}

// Phase definitions
export type PhaseId = 'discovery' | 'planning' | 'solutioning' | 'implementation';

export interface PhaseConfig {
    id: PhaseId;
    phaseNumber: number | 'prerequisite';
    label: string;
    viewId: string;
}

export const PHASES: PhaseConfig[] = [
    { id: 'discovery', phaseNumber: 0, label: 'Discovery', viewId: 'cliqueDiscovery' },
    { id: 'planning', phaseNumber: 1, label: 'Planning', viewId: 'cliquePlanning' },
    { id: 'solutioning', phaseNumber: 2, label: 'Solutioning', viewId: 'cliqueSolutioning' },
    { id: 'implementation', phaseNumber: 3, label: 'Implementation', viewId: 'cliqueImplementation' }
];

// Re-export existing types for backward compatibility
export type StoryStatus = 'backlog' | 'drafted' | 'ready-for-dev' | 'in-progress' | 'review' | 'done' | 'optional' | 'completed';

export interface Story {
    id: string;
    status: StoryStatus;
    epicId: string;
}

export interface Epic {
    id: string;
    name: string;
    status: StoryStatus;
    stories: Story[];
}

export interface SprintData {
    project: string;
    projectKey: string;
    epics: Epic[];
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add core types for workflow items and phases"
```

---

## Task 2: Create Workflow Parser

**Files:**
- Create: `src/core/workflowParser.ts`

**Step 1: Create the parser**

```typescript
// src/core/workflowParser.ts
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { WorkflowData, WorkflowItem } from './types';

export function parseWorkflowStatus(filePath: string): WorkflowData | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.parse(content);

    const items: WorkflowItem[] = (parsed.workflow_status || []).map((item: any) => ({
        id: item.id,
        phase: item.phase,
        status: item.status,
        agent: item.agent,
        command: item.command,
        note: item.note
    }));

    return {
        lastUpdated: parsed.last_updated || '',
        status: parsed.status || '',
        statusNote: parsed.status_note,
        project: parsed.project || '',
        projectType: parsed.project_type || '',
        selectedTrack: parsed.selected_track || '',
        fieldType: parsed.field_type || '',
        workflowPath: parsed.workflow_path || '',
        items
    };
}

export function getItemsForPhase(data: WorkflowData, phaseNumber: number): WorkflowItem[] {
    return data.items.filter(item => item.phase === phaseNumber);
}

export function findWorkflowStatusFile(workspaceRoot: string): string | null {
    const candidates = [
        path.join(workspaceRoot, 'docs', 'bmm-workflow-status.yaml'),
        path.join(workspaceRoot, 'bmm-workflow-status.yaml')
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

export function updateWorkflowItemStatus(
    filePath: string,
    itemId: string,
    newStatus: string
): boolean {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Use regex to find and update the status for this item
    // Pattern matches: id: "itemId" followed by status: "value" within the same item block
    const regex = new RegExp(
        `(- id: ["']?${itemId}["']?[\\s\\S]*?status:\\s*)["']?[^\\s"']+["']?`,
        'm'
    );

    if (!regex.test(content)) {
        return false;
    }

    const updatedContent = content.replace(regex, `$1"${newStatus}"`);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    return true;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/workflowParser.ts
git commit -m "feat: add workflow status parser for bmm-workflow-status.yaml"
```

---

## Task 3: Move Sprint Parser to Core

**Files:**
- Move: `src/sprintParser.ts` → `src/core/sprintParser.ts`
- Modify: `src/core/sprintParser.ts` (update imports)

**Step 1: Move the file**

```bash
mv src/sprintParser.ts src/core/sprintParser.ts
```

**Step 2: Update sprintParser to use shared types**

In `src/core/sprintParser.ts`, replace the type definitions at the top with imports:

```typescript
// src/core/sprintParser.ts
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Story, Epic, SprintData, StoryStatus } from './types';

// Remove the duplicate type definitions (lines 5-24 of original)
// Keep all the function implementations unchanged
```

**Step 3: Verify TypeScript compiles**

Run: `npm run compile`
Expected: Errors about imports in extension.ts and storyTreeProvider.ts (expected, we'll fix next)

**Step 4: Commit**

```bash
git add src/core/sprintParser.ts
git rm src/sprintParser.ts
git commit -m "refactor: move sprintParser to core directory"
```

---

## Task 4: Create File Watcher Module

**Files:**
- Create: `src/core/fileWatcher.ts`

**Step 1: Create unified file watcher**

```typescript
// src/core/fileWatcher.ts
import * as vscode from 'vscode';
import * as fs from 'fs';

export interface FileWatcherOptions {
    onWorkflowChange: () => void;
    onSprintChange: () => void;
}

export class CliqueFileWatcher implements vscode.Disposable {
    private vsCodeWatcher: vscode.FileSystemWatcher | null = null;
    private nativeWatchers: Map<string, fs.FSWatcher> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly debounceMs = 300;

    constructor(private options: FileWatcherOptions) {}

    setup(): void {
        this.vsCodeWatcher = vscode.workspace.createFileSystemWatcher(
            '**/{sprint-status.yaml,bmm-workflow-status.yaml}'
        );

        this.vsCodeWatcher.onDidChange(uri => this.handleChange(uri));
        this.vsCodeWatcher.onDidCreate(uri => this.handleChange(uri));
        this.vsCodeWatcher.onDidDelete(uri => this.handleDelete(uri));
    }

    watchFile(filePath: string, type: 'workflow' | 'sprint'): void {
        this.disposeNativeWatcher(filePath);

        if (!fs.existsSync(filePath)) {
            return;
        }

        try {
            const watcher = fs.watch(filePath, eventType => {
                this.debouncedNotify(filePath, type);

                if (eventType === 'rename') {
                    setTimeout(() => {
                        if (fs.existsSync(filePath)) {
                            this.watchFile(filePath, type);
                        }
                    }, 100);
                }
            });

            watcher.on('error', () => {
                setTimeout(() => {
                    if (fs.existsSync(filePath)) {
                        this.watchFile(filePath, type);
                    }
                }, 1000);
            });

            this.nativeWatchers.set(filePath, watcher);
        } catch (error) {
            console.error('Clique: Failed to set up native watcher:', error);
        }
    }

    private handleChange(uri: vscode.Uri): void {
        const type = uri.fsPath.includes('bmm-workflow-status') ? 'workflow' : 'sprint';
        this.debouncedNotify(uri.fsPath, type);
    }

    private handleDelete(uri: vscode.Uri): void {
        this.disposeNativeWatcher(uri.fsPath);
    }

    private debouncedNotify(filePath: string, type: 'workflow' | 'sprint'): void {
        const existing = this.debounceTimers.get(filePath);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(filePath);
            if (type === 'workflow') {
                this.options.onWorkflowChange();
            } else {
                this.options.onSprintChange();
            }
        }, this.debounceMs);

        this.debounceTimers.set(filePath, timer);
    }

    private disposeNativeWatcher(filePath: string): void {
        const watcher = this.nativeWatchers.get(filePath);
        if (watcher) {
            watcher.close();
            this.nativeWatchers.delete(filePath);
        }
    }

    dispose(): void {
        this.vsCodeWatcher?.dispose();
        for (const watcher of this.nativeWatchers.values()) {
            watcher.close();
        }
        this.nativeWatchers.clear();
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors (or same import errors from Task 3)

**Step 3: Commit**

```bash
git add src/core/fileWatcher.ts
git commit -m "feat: add unified file watcher for workflow and sprint files"
```

---

## Task 5: Create Base Workflow Tree Provider

**Files:**
- Create: `src/phases/baseWorkflowProvider.ts`

**Step 1: Create the base provider**

```typescript
// src/phases/baseWorkflowProvider.ts
import * as vscode from 'vscode';
import { WorkflowItem, WorkflowData } from '../core/types';

export class WorkflowTreeItem extends vscode.TreeItem {
    constructor(
        public readonly workflowItem: WorkflowItem,
        public readonly isNextAction: boolean
    ) {
        super(WorkflowTreeItem.formatLabel(workflowItem.id), vscode.TreeItemCollapsibleState.None);
        this.setupItem();
    }

    private static formatLabel(id: string): string {
        return id
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private setupItem(): void {
        const status = this.workflowItem.status;

        this.description = `[${this.workflowItem.agent}]`;
        this.tooltip = this.buildTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
    }

    private buildTooltip(): string {
        const lines = [
            `${WorkflowTreeItem.formatLabel(this.workflowItem.id)}`,
            `Agent: ${this.workflowItem.agent}`,
            `Status: ${this.workflowItem.status}`,
            `Command: /bmad:bmm:workflows:${this.workflowItem.command}`
        ];
        if (this.workflowItem.note) {
            lines.push(`\n${this.workflowItem.note}`);
        }
        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        const status = this.workflowItem.status;

        if (this.isNextAction) {
            return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.blue'));
        }
        if (status === 'skipped') {
            return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
        }
        if (status === 'conditional') {
            return new vscode.ThemeIcon('circle-large-outline', new vscode.ThemeColor('charts.yellow'));
        }
        if (status === 'required' || status === 'optional' || status === 'recommended') {
            return new vscode.ThemeIcon('circle-outline');
        }
        // Status is a file path = completed
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    }

    private getContextValue(): string {
        if (this.isNextAction) {
            return 'workflow-actionable';
        }
        if (this.workflowItem.status === 'skipped') {
            return 'workflow-skipped';
        }
        if (this.isCompleted()) {
            return 'workflow-completed';
        }
        return 'workflow-pending';
    }

    isCompleted(): boolean {
        const status = this.workflowItem.status;
        return status !== 'required' &&
               status !== 'optional' &&
               status !== 'recommended' &&
               status !== 'conditional' &&
               status !== 'skipped';
    }

    isActionable(): boolean {
        const status = this.workflowItem.status;
        return status === 'required' || status === 'optional' || status === 'recommended';
    }
}

export class BaseWorkflowProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<WorkflowTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    protected workflowData: WorkflowData | null = null;
    protected phaseNumber: number;

    constructor(phaseNumber: number) {
        this.phaseNumber = phaseNumber;
    }

    setData(data: WorkflowData | null): void {
        this.workflowData = data;
        this._onDidChangeTreeData.fire(undefined);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): Thenable<WorkflowTreeItem[]> {
        if (!this.workflowData) {
            return Promise.resolve([]);
        }

        const phaseItems = this.workflowData.items.filter(
            item => item.phase === this.phaseNumber
        );

        // Find first actionable item for "next action" indicator
        let foundNextAction = false;
        const treeItems = phaseItems.map(item => {
            const isNext = !foundNextAction && this.isActionable(item);
            if (isNext) {
                foundNextAction = true;
            }
            return new WorkflowTreeItem(item, isNext);
        });

        return Promise.resolve(treeItems);
    }

    private isActionable(item: WorkflowItem): boolean {
        const status = item.status;
        return status === 'required' || status === 'optional' || status === 'recommended';
    }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors (or import errors we're still fixing)

**Step 3: Commit**

```bash
git add src/phases/baseWorkflowProvider.ts
git commit -m "feat: add base workflow tree provider for phase tabs"
```

---

## Task 6: Create Phase-Specific Providers

**Files:**
- Create: `src/phases/discovery/treeProvider.ts`
- Create: `src/phases/planning/treeProvider.ts`
- Create: `src/phases/solutioning/treeProvider.ts`
- Create: `src/phases/implementation/treeProvider.ts`

**Step 1: Create directory structure**

```bash
mkdir -p src/phases/discovery src/phases/planning src/phases/solutioning src/phases/implementation
```

**Step 2: Create discovery provider**

```typescript
// src/phases/discovery/treeProvider.ts
import { BaseWorkflowProvider } from '../baseWorkflowProvider';

export class DiscoveryTreeProvider extends BaseWorkflowProvider {
    constructor() {
        super(0); // Phase 0
    }
}
```

**Step 3: Create planning provider**

```typescript
// src/phases/planning/treeProvider.ts
import { BaseWorkflowProvider } from '../baseWorkflowProvider';

export class PlanningTreeProvider extends BaseWorkflowProvider {
    constructor() {
        super(1); // Phase 1
    }
}
```

**Step 4: Create solutioning provider**

```typescript
// src/phases/solutioning/treeProvider.ts
import { BaseWorkflowProvider } from '../baseWorkflowProvider';

export class SolutioningTreeProvider extends BaseWorkflowProvider {
    constructor() {
        super(2); // Phase 2
    }
}
```

**Step 5: Create implementation provider**

```typescript
// src/phases/implementation/treeProvider.ts
import * as vscode from 'vscode';
import { BaseWorkflowProvider, WorkflowTreeItem } from '../baseWorkflowProvider';
import { SprintData, Epic, Story, StoryStatus } from '../../core/types';

// Re-use story item from existing code with modifications
class StoryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly itemType: 'epic' | 'story' | 'divider',
        public readonly data: Epic | Story | null,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(
            StoryTreeItem.getLabel(itemType, data),
            collapsibleState
        );
        if (itemType !== 'divider') {
            this.setupItem();
        }
    }

    private static getLabel(itemType: string, data: Epic | Story | null): string {
        if (itemType === 'divider') {
            return '── Sprint Stories ──';
        }
        if (itemType === 'epic') {
            return (data as Epic).name;
        }
        return (data as Story).id;
    }

    private setupItem(): void {
        if (!this.data) return;

        const status = this.data.status;
        this.description = `[${status}]`;
        this.iconPath = this.getIcon(status);
        this.contextValue = this.itemType === 'story' ? 'story' : 'epic';
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

type ImplementationItem = WorkflowTreeItem | StoryTreeItem;

export class ImplementationTreeProvider extends BaseWorkflowProvider {
    private sprintData: SprintData | null = null;

    constructor() {
        super(3); // Phase 3
    }

    setSprintData(data: SprintData | null): void {
        this.sprintData = data;
        this.refresh();
    }

    override getChildren(element?: ImplementationItem): Thenable<ImplementationItem[]> {
        if (!element) {
            return this.getRootChildren();
        }

        if (element instanceof StoryTreeItem && element.itemType === 'epic') {
            const epic = element.data as Epic;
            return Promise.resolve(
                epic.stories.map(story =>
                    new StoryTreeItem('story', story, vscode.TreeItemCollapsibleState.None)
                )
            );
        }

        return Promise.resolve([]);
    }

    private async getRootChildren(): Promise<ImplementationItem[]> {
        const items: ImplementationItem[] = [];

        // Add workflow items for phase 3
        if (this.workflowData) {
            const workflowItems = await super.getChildren();
            items.push(...workflowItems);
        }

        // Add divider if we have both workflow and sprint data
        if (this.workflowData && this.sprintData && this.sprintData.epics.length > 0) {
            items.push(new StoryTreeItem('divider', null, vscode.TreeItemCollapsibleState.None));
        }

        // Add sprint epics
        if (this.sprintData) {
            for (const epic of this.sprintData.epics) {
                items.push(
                    new StoryTreeItem('epic', epic, vscode.TreeItemCollapsibleState.Expanded)
                );
            }
        }

        return items;
    }
}

export { StoryTreeItem };
```

**Step 6: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors

**Step 7: Commit**

```bash
git add src/phases/
git commit -m "feat: add phase-specific tree providers"
```

---

## Task 7: Create Detail Panel Webview

**Files:**
- Create: `src/ui/detailPanel.ts`

**Step 1: Create the detail panel**

```typescript
// src/ui/detailPanel.ts
import * as vscode from 'vscode';
import { WorkflowItem } from '../core/types';

export class WorkflowDetailPanel {
    public static currentPanel: WorkflowDetailPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static show(
        extensionUri: vscode.Uri,
        item: WorkflowItem,
        onRun: () => void,
        onSkip: () => void
    ): void {
        const column = vscode.ViewColumn.Beside;

        if (WorkflowDetailPanel.currentPanel) {
            WorkflowDetailPanel.currentPanel.panel.reveal(column);
            WorkflowDetailPanel.currentPanel.update(item, onRun, onSkip);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'cliqueWorkflowDetail',
            'Workflow Details',
            column,
            { enableScripts: true }
        );

        WorkflowDetailPanel.currentPanel = new WorkflowDetailPanel(panel, extensionUri);
        WorkflowDetailPanel.currentPanel.update(item, onRun, onSkip);
    }

    private update(item: WorkflowItem, onRun: () => void, onSkip: () => void): void {
        this.panel.title = this.formatTitle(item.id);
        this.panel.webview.html = this.getHtml(item);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'run':
                        onRun();
                        return;
                    case 'skip':
                        onSkip();
                        return;
                }
            },
            null,
            this.disposables
        );
    }

    private formatTitle(id: string): string {
        return id
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private getPhaseName(phase: number | 'prerequisite'): string {
        if (phase === 'prerequisite') return 'Prerequisite';
        const names = ['Discovery', 'Planning', 'Solutioning', 'Implementation'];
        return `${names[phase]} (Phase ${phase})`;
    }

    private getHtml(item: WorkflowItem): string {
        const title = this.formatTitle(item.id);
        const isActionable = item.status === 'required' ||
                            item.status === 'optional' ||
                            item.status === 'recommended';
        const isCompleted = !isActionable && item.status !== 'skipped' && item.status !== 'conditional';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        h1 {
            margin-top: 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .field {
            margin: 12px 0;
        }
        .label {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-bottom: 4px;
        }
        .value {
            font-size: 14px;
        }
        .note {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            padding: 10px;
            margin: 16px 0;
        }
        .actions {
            margin-top: 24px;
            display: flex;
            gap: 10px;
        }
        button {
            padding: 8px 16px;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .completed {
            color: var(--vscode-charts-green);
        }
    </style>
</head>
<body>
    <h1>${title}</h1>

    <div class="field">
        <div class="label">Phase</div>
        <div class="value">${this.getPhaseName(item.phase)}</div>
    </div>

    <div class="field">
        <div class="label">Agent</div>
        <div class="value">${item.agent}</div>
    </div>

    <div class="field">
        <div class="label">Command</div>
        <div class="value"><code>/bmad:bmm:workflows:${item.command}</code></div>
    </div>

    <div class="field">
        <div class="label">Status</div>
        <div class="value ${isCompleted ? 'completed' : ''}">${item.status}</div>
    </div>

    ${item.note ? `
    <div class="note">
        <div class="label">Note</div>
        <div class="value">${item.note}</div>
    </div>
    ` : ''}

    ${isActionable ? `
    <div class="actions">
        <button class="primary" onclick="run()">Run Workflow</button>
        <button class="secondary" onclick="skip()">Mark Skipped</button>
    </div>
    ` : ''}

    <script>
        const vscode = acquireVsCodeApi();
        function run() {
            vscode.postMessage({ command: 'run' });
        }
        function skip() {
            vscode.postMessage({ command: 'skip' });
        }
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        WorkflowDetailPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
```

**Step 2: Create directory and verify**

```bash
mkdir -p src/ui
```

Run: `npm run compile`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/detailPanel.ts
git commit -m "feat: add workflow detail panel webview"
```

---

## Task 8: Create Welcome View

**Files:**
- Create: `src/ui/welcomeView.ts`

**Step 1: Create the welcome view provider**

```typescript
// src/ui/welcomeView.ts
import * as vscode from 'vscode';

export class WelcomeViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cliqueWelcome';
    private view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly onInitialize: () => void
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'initialize') {
                this.onInitialize();
            }
        });
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            text-align: center;
            color: var(--vscode-foreground);
        }
        .icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        h2 {
            margin: 0 0 12px 0;
            font-weight: 500;
        }
        p {
            color: var(--vscode-descriptionForeground);
            margin: 0 0 20px 0;
            line-height: 1.5;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .hint {
            margin-top: 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="icon">🚀</div>
    <h2>Welcome to Clique</h2>
    <p>Get started with the BMAD Method by initializing your project workflow.</p>
    <button onclick="initialize()">Initialize Workflow</button>
    <p class="hint">This will run workflow-init to set up your project's workflow status file.</p>

    <script>
        const vscode = acquireVsCodeApi();
        function initialize() {
            vscode.postMessage({ command: 'initialize' });
        }
    </script>
</body>
</html>`;
    }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/welcomeView.ts
git commit -m "feat: add welcome view for workflow initialization"
```

---

## Task 9: Update Package.json for New Views

**Files:**
- Modify: `package.json`

**Step 1: Update activationEvents**

Replace the `activationEvents` array:

```json
"activationEvents": [
    "workspaceContains:**/sprint-status.yaml",
    "workspaceContains:**/bmm-workflow-status.yaml",
    "onView:cliqueDiscovery",
    "onView:cliquePlanning",
    "onView:cliqueSolutioning",
    "onView:cliqueImplementation"
],
```

**Step 2: Update views configuration**

Replace the `views` section under `contributes`:

```json
"views": {
    "clique": [
        {
            "id": "cliqueDiscovery",
            "name": "Discovery",
            "when": "clique.hasWorkflowFile"
        },
        {
            "id": "cliquePlanning",
            "name": "Planning",
            "when": "clique.hasWorkflowFile"
        },
        {
            "id": "cliqueSolutioning",
            "name": "Solutioning",
            "when": "clique.hasWorkflowFile"
        },
        {
            "id": "cliqueImplementation",
            "name": "Implementation",
            "when": "clique.hasWorkflowFile"
        },
        {
            "id": "cliqueWelcome",
            "name": "Get Started",
            "when": "!clique.hasWorkflowFile",
            "type": "webview"
        }
    ]
},
```

**Step 3: Add new commands**

Add to the `commands` array:

```json
{
    "command": "clique.showWorkflowDetail",
    "title": "Show Workflow Details"
},
{
    "command": "clique.runPhaseWorkflow",
    "title": "Run Workflow",
    "icon": "$(play)"
},
{
    "command": "clique.skipWorkflow",
    "title": "Skip Workflow"
},
{
    "command": "clique.initializeWorkflow",
    "title": "Initialize Workflow"
}
```

**Step 4: Update menus for workflow items**

Add to the `view/item/context` menu array:

```json
{
    "command": "clique.runPhaseWorkflow",
    "when": "view =~ /clique(Discovery|Planning|Solutioning|Implementation)/ && viewItem == workflow-actionable",
    "group": "inline"
},
{
    "command": "clique.showWorkflowDetail",
    "when": "view =~ /clique(Discovery|Planning|Solutioning|Implementation)/ && viewItem =~ /^workflow/",
    "group": "navigation"
},
{
    "command": "clique.skipWorkflow",
    "when": "view =~ /clique(Discovery|Planning|Solutioning|Implementation)/ && viewItem == workflow-actionable",
    "group": "workflow@1"
}
```

**Step 5: Verify JSON is valid**

Run: `npm run compile`
Expected: No errors

**Step 6: Commit**

```bash
git add package.json
git commit -m "feat: add package.json configuration for phase views"
```

---

## Task 10: Rewrite Extension Entry Point

**Files:**
- Modify: `src/extension.ts`

**Step 1: Rewrite extension.ts**

Replace the entire file:

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';

// Core imports
import { parseWorkflowStatus, findWorkflowStatusFile, updateWorkflowItemStatus } from './core/workflowParser';
import { parseSprintStatus, findAllSprintStatusFiles, updateStoryStatus } from './core/sprintParser';
import { CliqueFileWatcher } from './core/fileWatcher';
import { WorkflowData, SprintData, StoryStatus, WorkflowItem } from './core/types';

// Phase providers
import { DiscoveryTreeProvider } from './phases/discovery/treeProvider';
import { PlanningTreeProvider } from './phases/planning/treeProvider';
import { SolutioningTreeProvider } from './phases/solutioning/treeProvider';
import { ImplementationTreeProvider, StoryTreeItem } from './phases/implementation/treeProvider';
import { WorkflowTreeItem } from './phases/baseWorkflowProvider';

// UI
import { WorkflowDetailPanel } from './ui/detailPanel';
import { WelcomeViewProvider } from './ui/welcomeView';

// State
let workspaceRoot: string | null = null;
let workflowStatusPath: string | null = null;
let sprintStatusPath: string | null = null;
let fileWatcher: CliqueFileWatcher | null = null;

// Providers
let discoveryProvider: DiscoveryTreeProvider;
let planningProvider: PlanningTreeProvider;
let solutioningProvider: SolutioningTreeProvider;
let implementationProvider: ImplementationTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Clique extension activated');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        workspaceRoot = workspaceFolders[0].uri.fsPath;
    }

    // Initialize providers
    discoveryProvider = new DiscoveryTreeProvider();
    planningProvider = new PlanningTreeProvider();
    solutioningProvider = new SolutioningTreeProvider();
    implementationProvider = new ImplementationTreeProvider();

    // Register tree views
    const discoveryView = vscode.window.createTreeView('cliqueDiscovery', {
        treeDataProvider: discoveryProvider,
        showCollapseAll: false
    });

    const planningView = vscode.window.createTreeView('cliquePlanning', {
        treeDataProvider: planningProvider,
        showCollapseAll: false
    });

    const solutioningView = vscode.window.createTreeView('cliqueSolutioning', {
        treeDataProvider: solutioningProvider,
        showCollapseAll: false
    });

    const implementationView = vscode.window.createTreeView('cliqueImplementation', {
        treeDataProvider: implementationProvider,
        showCollapseAll: true
    });

    // Register welcome view
    const welcomeProvider = new WelcomeViewProvider(
        context.extensionUri,
        () => runWorkflowInit()
    );
    const welcomeView = vscode.window.registerWebviewViewProvider(
        WelcomeViewProvider.viewType,
        welcomeProvider
    );

    // Set up file watcher
    fileWatcher = new CliqueFileWatcher({
        onWorkflowChange: loadWorkflowData,
        onSprintChange: loadSprintData
    });
    fileWatcher.setup();

    // Initialize data
    initializeFiles(context);

    // Register commands
    const commands = [
        vscode.commands.registerCommand('clique.refresh', () => {
            loadWorkflowData();
            loadSprintData();
            vscode.window.showInformationMessage('Clique: Refreshed');
        }),

        vscode.commands.registerCommand('clique.selectFile', () => selectSprintFile(context)),

        vscode.commands.registerCommand('clique.showWorkflowDetail', (item: WorkflowTreeItem) => {
            if (item.workflowItem) {
                showWorkflowDetail(context.extensionUri, item.workflowItem);
            }
        }),

        vscode.commands.registerCommand('clique.runPhaseWorkflow', (item: WorkflowTreeItem) => {
            if (item.workflowItem) {
                runPhaseWorkflow(item.workflowItem);
            }
        }),

        vscode.commands.registerCommand('clique.skipWorkflow', (item: WorkflowTreeItem) => {
            if (item.workflowItem && workflowStatusPath) {
                skipWorkflow(item.workflowItem);
            }
        }),

        vscode.commands.registerCommand('clique.initializeWorkflow', () => runWorkflowInit()),

        // Legacy story commands
        vscode.commands.registerCommand('clique.runWorkflow', (item: StoryTreeItem) => {
            if (item.itemType === 'story' && item.data) {
                const story = item.data as { id: string; status: StoryStatus };
                runStoryWorkflow(story.id, story.status);
            }
        }),

        ...registerStatusCommands(context)
    ];

    context.subscriptions.push(
        discoveryView, planningView, solutioningView, implementationView,
        welcomeView, ...commands
    );

    if (fileWatcher) {
        context.subscriptions.push(fileWatcher);
    }
}

function initializeFiles(context: vscode.ExtensionContext): void {
    if (!workspaceRoot) {
        updateHasWorkflowContext(false);
        return;
    }

    // Find workflow status file
    workflowStatusPath = findWorkflowStatusFile(workspaceRoot);

    if (workflowStatusPath) {
        updateHasWorkflowContext(true);
        loadWorkflowData();
        fileWatcher?.watchFile(workflowStatusPath, 'workflow');
    } else {
        updateHasWorkflowContext(false);
    }

    // Find sprint status file
    const savedSprintPath = context.workspaceState.get<string>('clique.selectedFile');
    if (savedSprintPath) {
        sprintStatusPath = savedSprintPath;
        loadSprintData();
    } else {
        const sprintFiles = findAllSprintStatusFiles(workspaceRoot);
        if (sprintFiles.length === 1) {
            sprintStatusPath = sprintFiles[0];
            context.workspaceState.update('clique.selectedFile', sprintStatusPath);
            loadSprintData();
        }
    }

    if (sprintStatusPath) {
        fileWatcher?.watchFile(sprintStatusPath, 'sprint');
    }
}

function updateHasWorkflowContext(hasFile: boolean): void {
    vscode.commands.executeCommand('setContext', 'clique.hasWorkflowFile', hasFile);
}

function loadWorkflowData(): void {
    if (!workflowStatusPath) {
        const data = null;
        discoveryProvider.setData(data);
        planningProvider.setData(data);
        solutioningProvider.setData(data);
        implementationProvider.setData(data);
        return;
    }

    const data = parseWorkflowStatus(workflowStatusPath);
    discoveryProvider.setData(data);
    planningProvider.setData(data);
    solutioningProvider.setData(data);
    implementationProvider.setData(data);

    if (data) {
        console.log(`Clique: Loaded ${data.items.length} workflow items`);
    }
}

function loadSprintData(): void {
    if (!sprintStatusPath) {
        implementationProvider.setSprintData(null);
        return;
    }

    const data = parseSprintStatus(sprintStatusPath);
    implementationProvider.setSprintData(data);

    if (data) {
        const totalStories = data.epics.reduce((sum, e) => sum + e.stories.length, 0);
        console.log(`Clique: Loaded ${totalStories} stories`);
    }
}

async function selectSprintFile(context: vscode.ExtensionContext): Promise<void> {
    if (!workspaceRoot) return;

    const files = findAllSprintStatusFiles(workspaceRoot);
    if (files.length === 0) {
        vscode.window.showWarningMessage('Clique: No sprint-status.yaml files found');
        return;
    }

    const items = files.map(file => ({
        label: path.relative(workspaceRoot!, file),
        description: file === sprintStatusPath ? '(current)' : '',
        fullPath: file
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select sprint-status.yaml file'
    });

    if (selected) {
        sprintStatusPath = selected.fullPath;
        context.workspaceState.update('clique.selectedFile', sprintStatusPath);
        loadSprintData();
        fileWatcher?.watchFile(sprintStatusPath, 'sprint');
        vscode.window.showInformationMessage(`Clique: Using ${selected.label}`);
    }
}

function showWorkflowDetail(extensionUri: vscode.Uri, item: WorkflowItem): void {
    WorkflowDetailPanel.show(
        extensionUri,
        item,
        () => runPhaseWorkflow(item),
        () => skipWorkflow(item)
    );
}

function runPhaseWorkflow(item: WorkflowItem): void {
    const command = `claude "/bmad:bmm:workflows:${item.command}"`;
    const terminalName = `Clique: ${item.id}`;
    const terminal = vscode.window.createTerminal(terminalName);
    terminal.sendText(command);
    terminal.show();

    vscode.window.showInformationMessage(
        `Running ${item.id}`,
        'Show Terminal'
    ).then(action => {
        if (action === 'Show Terminal') {
            terminal.show();
        }
    });
}

function skipWorkflow(item: WorkflowItem): void {
    if (!workflowStatusPath) return;

    const success = updateWorkflowItemStatus(workflowStatusPath, item.id, 'skipped');
    if (success) {
        loadWorkflowData();
        vscode.window.showInformationMessage(`Skipped: ${item.id}`);
    } else {
        vscode.window.showErrorMessage(`Failed to skip: ${item.id}`);
    }
}

function runWorkflowInit(): void {
    const command = 'claude "/bmad:bmm:workflows:workflow-init"';
    const terminal = vscode.window.createTerminal('Clique: Initialize');
    terminal.sendText(command);
    terminal.show();
}

function runStoryWorkflow(storyId: string, status: StoryStatus): void {
    const actions: Partial<Record<StoryStatus, { label: string; command: string }>> = {
        'backlog': { label: 'Create Story', command: 'create-story' },
        'ready-for-dev': { label: 'Start Dev', command: 'dev-story' },
        'review': { label: 'Code Review', command: 'code-review' }
    };

    const action = actions[status];
    if (!action) {
        vscode.window.showWarningMessage(`No workflow action for status: ${status}`);
        return;
    }

    const command = `claude "/bmad:bmm:workflows:${action.command} ${storyId}"`;
    const terminal = vscode.window.createTerminal(`Clique: ${storyId}`);
    terminal.sendText(command);
    terminal.show();

    vscode.window.showInformationMessage(`Running ${action.label} for ${storyId}`);
}

function registerStatusCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
    const handler = (newStatus: StoryStatus) => (item: StoryTreeItem) => {
        if (item.itemType === 'story' && item.data && sprintStatusPath) {
            const story = item.data as { id: string };
            const success = updateStoryStatus(sprintStatusPath, story.id, newStatus);
            if (success) {
                loadSprintData();
                vscode.window.showInformationMessage(`Set ${story.id} to ${newStatus}`);
            } else {
                vscode.window.showErrorMessage(`Failed to update status for ${story.id}`);
            }
        }
    };

    return [
        vscode.commands.registerCommand('clique.setStatus.backlog', handler('backlog')),
        vscode.commands.registerCommand('clique.setStatus.readyForDev', handler('ready-for-dev')),
        vscode.commands.registerCommand('clique.setStatus.inProgress', handler('in-progress')),
        vscode.commands.registerCommand('clique.setStatus.review', handler('review')),
        vscode.commands.registerCommand('clique.setStatus.done', handler('done'))
    ];
}

export function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run compile`
Expected: No errors

**Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: rewrite extension entry point for phase-based UI"
```

---

## Task 11: Clean Up Old Files

**Files:**
- Delete: `src/storyTreeProvider.ts`
- Delete: `src/workflowRunner.ts`

**Step 1: Remove old files**

```bash
git rm src/storyTreeProvider.ts src/workflowRunner.ts
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Successful build to dist/extension.js

**Step 3: Commit**

```bash
git commit -m "chore: remove legacy files now integrated into phase structure"
```

---

## Task 12: Test the Extension

**Step 1: Build the extension**

Run: `npm run build`
Expected: Successful build

**Step 2: Launch extension in development**

Run: Press F5 in VS Code (or run "Debug: Start Debugging")
Expected: New VS Code window opens with extension loaded

**Step 3: Manual verification checklist**

- [ ] Open a workspace WITHOUT bmm-workflow-status.yaml
  - [ ] Welcome view appears with "Initialize Workflow" button
  - [ ] Phase tabs are hidden

- [ ] Open a workspace WITH bmm-workflow-status.yaml
  - [ ] Four phase tabs appear (Discovery, Planning, Solutioning, Implementation)
  - [ ] Welcome view is hidden
  - [ ] Workflow items show with correct icons and agent badges
  - [ ] "Next action" item has blue play icon
  - [ ] Clicking item opens detail panel
  - [ ] "Run Workflow" opens terminal with correct command
  - [ ] "Mark Skipped" updates the YAML file

- [ ] Implementation tab with sprint-status.yaml
  - [ ] Phase 3 workflow items appear at top
  - [ ] Divider line appears
  - [ ] Epics and stories appear below
  - [ ] Story play buttons work as before

**Step 4: Commit verification notes**

```bash
git add -A
git commit -m "test: verify phase-based UI functionality"
```

---

## Task 13: Update README

**Files:**
- Modify: `README.md`

**Step 1: Update features section**

Add to features:

```markdown
## Features

- **Phase-Based Workflow UI** - Four tabs for Discovery, Planning, Solutioning, and Implementation phases
- **Workflow Status Tracking** - Read `bmm-workflow-status.yaml` to show workflow progress
- **Rich Workflow Cards** - Status icons, agent badges, and notes for each workflow item
- **Detail Panel** - Click any workflow to see full details and run/skip actions
- **Welcome View** - Easy initialization when no workflow file exists
- **Tree View Sidebar** - Display stories grouped by epic with status indicators
- **Workflow Actions** - Inline play button to run appropriate Claude commands
- **Status Management** - Right-click to change story status directly
- **Sprint File Selection** - Search workspace and select which `sprint-status.yaml` to use
- **Terminal Integration** - Spawn terminals with the correct workflow command
- **Auto-refresh** - Automatically watches both workflow and sprint status files
```

**Step 2: Add workflow status file documentation**

Add new section:

```markdown
## Workflow Status File Format

The extension reads `docs/bmm-workflow-status.yaml` to track BMAD methodology progress:

\`\`\`yaml
project: my-project
selected_track: enterprise
workflow_status:
  - id: "product-brief"
    phase: 0
    status: "required"
    agent: "analyst"
    command: "product-brief"
    note: "Create product brief first"

  - id: "prd"
    phase: 1
    status: "docs/prd.md"
    agent: "pm"
    command: "prd"
    note: "Completed"
\`\`\`

### Status Values

- `required` / `optional` / `recommended` - Actionable, shows play button
- `conditional` - Waiting on prerequisites
- `skipped` - Explicitly skipped
- File path (e.g., `docs/prd.md`) - Completed, shows checkmark
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README with phase-based workflow features"
```

---

## Summary

This plan includes 13 tasks that build the phase-based workflow UI incrementally:

1. **Tasks 1-4**: Core infrastructure (types, parsers, file watcher)
2. **Tasks 5-6**: Phase tree providers
3. **Tasks 7-8**: UI components (detail panel, welcome view)
4. **Tasks 9-10**: Extension integration
5. **Tasks 11-13**: Cleanup, testing, documentation

Each task has explicit file paths, complete code, and verification steps.
