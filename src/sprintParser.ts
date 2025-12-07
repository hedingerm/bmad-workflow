import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

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

export function parseSprintStatus(filePath: string): SprintData | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.parse(content);

    const project = parsed.project || 'Unknown';
    const projectKey = parsed.project_key || '';
    const devStatus = parsed.development_status || {};

    const epicsMap = new Map<string, Epic>();

    // First pass: identify epics
    for (const [key, value] of Object.entries(devStatus)) {
        const match = key.match(/^epic-(\d+)$/);
        if (match) {
            const epicNum = match[1];
            epicsMap.set(epicNum, {
                id: key,
                name: `Epic ${epicNum}`,
                status: value as StoryStatus,
                stories: []
            });
        }
    }

    // Second pass: assign stories to epics
    for (const [key, value] of Object.entries(devStatus)) {
        // Skip epic entries and retrospectives
        if (key.match(/^epic-\d+$/) || key.includes('retrospective')) {
            continue;
        }

        // Extract epic number from story id (e.g., "4-7-create-admin-staff-domain" -> "4")
        const storyMatch = key.match(/^(\d+)-/);
        if (storyMatch) {
            const epicNum = storyMatch[1];
            const epic = epicsMap.get(epicNum);
            if (epic) {
                epic.stories.push({
                    id: key,
                    status: value as StoryStatus,
                    epicId: `epic-${epicNum}`
                });
            }
        }
    }

    // Convert map to sorted array
    const epics = Array.from(epicsMap.values())
        .sort((a, b) => {
            const numA = parseInt(a.id.replace('epic-', ''));
            const numB = parseInt(b.id.replace('epic-', ''));
            return numA - numB;
        });

    return { project, projectKey, epics };
}

export function updateStoryStatus(filePath: string, storyId: string, newStatus: StoryStatus): boolean {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Use regex to find and replace the status for this story
    // Match pattern: "storyId: oldStatus" and replace with "storyId: newStatus"
    const regex = new RegExp(`^(\\s*${storyId}:\\s*)\\S+`, 'm');

    if (!regex.test(content)) {
        return false;
    }

    const updatedContent = content.replace(regex, `$1${newStatus}`);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    return true;
}

export function findAllSprintStatusFiles(workspaceRoot: string): string[] {
    const results: string[] = [];

    function searchDir(dir: string): void {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                    searchDir(fullPath);
                } else if (entry.isFile() && entry.name === 'sprint-status.yaml') {
                    results.push(fullPath);
                }
            }
        } catch {
            // Ignore permission errors
        }
    }

    searchDir(workspaceRoot);
    return results;
}
