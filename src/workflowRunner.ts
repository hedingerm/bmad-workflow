import * as vscode from 'vscode';
import { StoryStatus } from './sprintParser';

interface WorkflowAction {
    label: string;
    command: string;
}

const WORKFLOW_ACTIONS: Partial<Record<StoryStatus, WorkflowAction>> = {
    'backlog': {
        label: 'Create Story',
        command: 'claude "/bmad:bmm:workflows:create-story'
    },
    'ready-for-dev': {
        label: 'Start Dev',
        command: 'claude "/bmad:bmm:workflows:dev-story'
    },
    'review': {
        label: 'Code Review',
        command: 'claude "/bmad:bmm:workflows:code-review'
    }
};

const TERMINAL_PREFIX = 'Clique: ';

export function getWorkflowAction(status: StoryStatus): WorkflowAction | null {
    return WORKFLOW_ACTIONS[status] || null;
}

export function isActionableStatus(status: StoryStatus): boolean {
    return status in WORKFLOW_ACTIONS;
}

export function runWorkflow(storyId: string, status: StoryStatus): void {
    const action = getWorkflowAction(status);
    if (!action) {
        vscode.window.showWarningMessage(`No workflow action for status: ${status}`);
        return;
    }

    const terminalName = `${TERMINAL_PREFIX}${storyId}`;
    const terminal = vscode.window.createTerminal(terminalName);

    const fullCommand = `${action.command} ${storyId}"`;
    terminal.sendText(fullCommand);

    vscode.window.showInformationMessage(`Running ${action.label} for ${storyId}`);
}
