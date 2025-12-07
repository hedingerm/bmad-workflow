import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseSprintStatus, findAllSprintStatusFiles, updateStoryStatus, Story, StoryStatus } from './sprintParser';
import { StoryTreeProvider, StoryItem } from './storyTreeProvider';
import { runWorkflow } from './workflowRunner';

let sprintStatusPath: string | null = null;
let fileWatcher: vscode.FileSystemWatcher | null = null;
let nativeWatcher: fs.FSWatcher | null = null;
let treeProvider: StoryTreeProvider;
let workspaceRoot: string | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Clique Workflow extension activated');

    treeProvider = new StoryTreeProvider();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        workspaceRoot = workspaceFolders[0].uri.fsPath;
    }

    // Register tree view
    const treeView = vscode.window.createTreeView('cliqueStories', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });

    // Load initial data (auto-select if only one file, prompt if multiple)
    initializeSprintFile(context);

    // Register commands
    const runWorkflowCmd = vscode.commands.registerCommand('clique.runWorkflow', (item: StoryItem) => {
        if (item.itemType === 'story') {
            const story = item.data as Story;
            runWorkflow(story.id, story.status);
        }
    });

    const refreshCmd = vscode.commands.registerCommand('clique.refresh', () => {
        loadSprintData();
        vscode.window.showInformationMessage('Clique: Refreshed sprint status');
    });

    const selectFileCmd = vscode.commands.registerCommand('clique.selectFile', () => {
        selectSprintFile(context);
    });

    // Register set status commands
    const setStatusHandler = (newStatus: StoryStatus) => (item: StoryItem) => {
        if (item.itemType === 'story' && sprintStatusPath) {
            const story = item.data as Story;
            const success = updateStoryStatus(sprintStatusPath, story.id, newStatus);
            if (success) {
                loadSprintData();
                vscode.window.showInformationMessage(`Set ${story.id} to ${newStatus}`);
            } else {
                vscode.window.showErrorMessage(`Failed to update status for ${story.id}`);
            }
        }
    };

    const setBacklogCmd = vscode.commands.registerCommand('clique.setStatus.backlog', setStatusHandler('backlog'));
    const setReadyCmd = vscode.commands.registerCommand('clique.setStatus.readyForDev', setStatusHandler('ready-for-dev'));
    const setInProgressCmd = vscode.commands.registerCommand('clique.setStatus.inProgress', setStatusHandler('in-progress'));
    const setReviewCmd = vscode.commands.registerCommand('clique.setStatus.review', setStatusHandler('review'));
    const setDoneCmd = vscode.commands.registerCommand('clique.setStatus.done', setStatusHandler('done'));

    // Watch for file changes
    setupFileWatcher();

    context.subscriptions.push(
        treeView, runWorkflowCmd, refreshCmd, selectFileCmd,
        setBacklogCmd, setReadyCmd, setInProgressCmd, setReviewCmd, setDoneCmd
    );

    if (fileWatcher) {
        context.subscriptions.push(fileWatcher);
    }
}

async function initializeSprintFile(context: vscode.ExtensionContext): Promise<void> {
    if (!workspaceRoot) {
        treeProvider.setData(null);
        return;
    }

    // Check if we have a saved selection
    const savedPath = context.workspaceState.get<string>('clique.selectedFile');
    if (savedPath) {
        sprintStatusPath = savedPath;
        loadSprintData();
        return;
    }

    // Find all sprint-status.yaml files
    const files = findAllSprintStatusFiles(workspaceRoot);

    if (files.length === 0) {
        vscode.window.showWarningMessage('Clique: No sprint-status.yaml found in workspace');
        treeProvider.setData(null);
    } else if (files.length === 1) {
        sprintStatusPath = files[0];
        context.workspaceState.update('clique.selectedFile', sprintStatusPath);
        loadSprintData();
    } else {
        // Multiple files found, prompt user
        await selectSprintFile(context);
    }
}

async function selectSprintFile(context: vscode.ExtensionContext): Promise<void> {
    if (!workspaceRoot) {
        return;
    }

    const files = findAllSprintStatusFiles(workspaceRoot);

    if (files.length === 0) {
        vscode.window.showWarningMessage('Clique: No sprint-status.yaml files found');
        return;
    }

    // Create quick pick items with relative paths
    const items = files.map(file => ({
        label: path.relative(workspaceRoot!, file),
        description: file === sprintStatusPath ? '(current)' : '',
        fullPath: file
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select sprint-status.yaml file',
        title: 'Clique: Select Sprint File'
    });

    if (selected) {
        sprintStatusPath = selected.fullPath;
        context.workspaceState.update('clique.selectedFile', sprintStatusPath);
        loadSprintData();
        vscode.window.showInformationMessage(`Clique: Using ${selected.label}`);
    }
}

let lastWatchedPath: string | null = null;

function loadSprintData(): void {
    if (!sprintStatusPath) {
        treeProvider.setData(null);
        return;
    }

    const data = parseSprintStatus(sprintStatusPath);
    treeProvider.setData(data);

    // Re-setup native watcher if the file path changed
    if (sprintStatusPath !== lastWatchedPath) {
        lastWatchedPath = sprintStatusPath;
        setupNativeWatcher();
    }

    if (data) {
        const totalStories = data.epics.reduce((sum, e) => sum + e.stories.length, 0);
        const doneStories = data.epics.reduce(
            (sum, e) => sum + e.stories.filter(s => s.status === 'done').length,
            0
        );
        console.log(`Clique: Loaded ${totalStories} stories (${doneStories} done) from ${sprintStatusPath}`);
    }
}

function setupFileWatcher(): void {
    if (fileWatcher) {
        fileWatcher.dispose();
    }

    fileWatcher = vscode.workspace.createFileSystemWatcher('**/sprint-status.yaml');

    fileWatcher.onDidChange((uri) => {
        if (uri.fsPath === sprintStatusPath) {
            loadSprintData();
        }
    });

    fileWatcher.onDidCreate(() => {
        // A new file was created, could prompt user
    });

    fileWatcher.onDidDelete((uri) => {
        if (uri.fsPath === sprintStatusPath) {
            sprintStatusPath = null;
            treeProvider.setData(null);
        }
    });

    // Also set up native watcher for the specific file (more reliable for external changes)
    setupNativeWatcher();
}

function setupNativeWatcher(): void {
    // Dispose existing native watcher
    if (nativeWatcher) {
        nativeWatcher.close();
        nativeWatcher = null;
    }

    if (!sprintStatusPath || !fs.existsSync(sprintStatusPath)) {
        return;
    }

    // Debounce to avoid multiple rapid reloads
    let debounceTimer: NodeJS.Timeout | null = null;
    const debounceMs = 300;

    const triggerReload = (reason: string) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            console.log(`Clique: Native watcher detected ${reason}`);
            loadSprintData();
        }, debounceMs);
    };

    try {
        nativeWatcher = fs.watch(sprintStatusPath, (eventType) => {
            if (eventType === 'change') {
                triggerReload('file change');
            } else if (eventType === 'rename') {
                // 'rename' event fires when file is replaced via atomic write
                // (write to temp file, then rename). This is common for editors
                // and tools like Claude Code. After a rename, the watcher becomes
                // invalid since it was watching the old inode, so we must re-setup.
                triggerReload('file replacement');

                // Re-establish watcher after a short delay (file may still be in flux)
                setTimeout(() => {
                    if (sprintStatusPath && fs.existsSync(sprintStatusPath)) {
                        setupNativeWatcher();
                    }
                }, 100);
            }
        });

        nativeWatcher.on('error', (error) => {
            console.error('Clique: Native file watcher error:', error);
            // Try to re-establish watcher on error
            setTimeout(() => {
                if (sprintStatusPath && fs.existsSync(sprintStatusPath)) {
                    setupNativeWatcher();
                }
            }, 1000);
        });
    } catch (error) {
        console.error('Clique: Failed to set up native file watcher:', error);
    }
}

export function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (nativeWatcher) {
        nativeWatcher.close();
    }
}
