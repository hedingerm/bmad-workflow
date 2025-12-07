# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run compile      # Build TypeScript to out/
npm run watch        # Watch mode for development
vsce package         # Package as .vsix for distribution
```

## Architecture

Clique is a VS Code extension that integrates with the BMAD (Build, Measure, Analyze, Deliver) workflow methodology. It reads `sprint-status.yaml` files and provides UI to run Claude workflows based on story status.

### Core Components

- **extension.ts** - Activation entry point. Registers commands and sets up file watchers for auto-refresh.
- **sprintParser.ts** - Parses `sprint-status.yaml` files. Extracts epics/stories with status. Updates story status in-place using regex replacement.
- **storyTreeProvider.ts** - VS Code TreeDataProvider for sidebar. Shows epics > stories hierarchy with status icons.
- **workflowRunner.ts** - Spawns terminals with Claude workflow commands based on story status.

### Workflow State Machine

```
backlog → create-story → ready-for-dev → dev-story → in-progress → (manual) → review → code-review → done
```

Actionable statuses (show play button):
- `backlog` → runs `/bmad:bmm:workflows:create-story`
- `ready-for-dev` → runs `/bmad:bmm:workflows:dev-story`
- `review` → runs `/bmad:bmm:workflows:code-review`

### Key Data Structures

- `SprintData` contains project info and array of `Epic`
- `Epic` contains `id`, `name`, `status`, and array of `Story`
- `Story` contains `id`, `status`, `epicId`
- Story IDs follow pattern `{epic-num}-{story-num}-{description}` (e.g., `4-7-create-admin-staff-domain`)
