# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Bundle with esbuild to dist/
npm run compile      # TypeScript type-check only (no output)
npm run watch        # Watch mode with esbuild
vsce package         # Package as .vsix for distribution
```

## Architecture

Clique is a VS Code extension that integrates with the BMAD workflow methodology. It reads `sprint-status.yaml` files and provides a sidebar UI to run Claude workflows based on story status.

### Core Components

- **extension.ts** - Activation entry point. Registers commands, sets up VS Code and native file watchers (dual-watcher pattern handles both VS Code events and external file changes).
- **sprintParser.ts** - Parses `sprint-status.yaml` files using the `yaml` library. Extracts epics/stories from the `development_status` section. Updates story status in-place using regex replacement to preserve YAML formatting.
- **storyTreeProvider.ts** - VS Code TreeDataProvider for sidebar. Shows epics > stories hierarchy with status-colored icons.
- **workflowRunner.ts** - Spawns terminals with Claude workflow commands. Maps statuses to BMAD workflow slash commands.

### Workflow State Machine

Actionable statuses (show play button):
- `backlog` → runs `claude "/bmad:bmm:workflows:create-story <story-id>"`
- `ready-for-dev` → runs `claude "/bmad:bmm:workflows:dev-story <story-id>"`
- `review` → runs `claude "/bmad:bmm:workflows:code-review <story-id>"`

Non-actionable: `drafted`, `in-progress`, `done`, `completed`, `optional`

### Key Data Structures

- `SprintData` contains `project`, `projectKey`, and array of `Epic`
- `Epic` contains `id`, `name`, `status`, and array of `Story`
- `Story` contains `id`, `status`, `epicId`
- Story IDs follow pattern `{epic-num}-{story-num}-{description}` (e.g., `4-7-create-admin-staff-domain`)

### Sprint Status File Format

The parser reads `development_status` section where keys like `epic-N` define epics and keys like `N-M-description` define stories belonging to epic N.
