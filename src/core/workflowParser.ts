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

export function getItemsForPhase(data: WorkflowData, phaseNumber: number | 'prerequisite'): WorkflowItem[] {
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

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        `(- id: ["']?${escapeRegex(itemId)}["']?[\\s\\S]*?status:\\s*)["']?[^\\s"']+["']?`,
        'm'
    );

    if (!regex.test(content)) {
        return false;
    }

    const updatedContent = content.replace(regex, `$1"${newStatus}"`);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    return true;
}
