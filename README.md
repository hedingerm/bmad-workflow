# Clique

Streamline agent development with the BMAD (Build, Measure, Analyze, Deliver) methodology. This VS Code extension reads `sprint-status.yaml` files and provides a UI to run Claude workflows based on story status.

## Features

- **Tree View Sidebar** - Display stories grouped by epic with status indicators
- **Workflow Actions** - Inline play button to run appropriate Claude commands
- **Status Management** - Right-click to change story status directly
- **Sprint File Selection** - Search workspace and select which `sprint-status.yaml` to use
- **Terminal Integration** - Spawn terminals with the correct workflow command
- **Auto-refresh** - Automatically watches `sprint-status.yaml` for changes

## Workflow State Machine

Stories progress through a defined workflow:

```
backlog → create-story → ready-for-dev → dev-story → in-progress → review → code-review → done
```

| Current Status | Action | Command |
|----------------|--------|---------|
| `backlog` | Create Story | `claude "/bmad:bmm:workflows:create-story <story-id>"` |
| `ready-for-dev` | Start Dev | `claude "/bmad:bmm:workflows:dev-story <story-id>"` |
| `review` | Code Review | `claude "/bmad:bmm:workflows:code-review <story-id>"` |
| `in-progress`, `done` | No action | - |

## Usage

### Sidebar

The extension adds a "Clique" view to the activity bar. The tree view displays:

- Epics as collapsible parent nodes
- Stories nested under their epics with status icons
- Play button on actionable stories (backlog, ready-for-dev, review)

### Running Workflows

1. Click the play button next to a story to run its workflow
2. A terminal opens with the appropriate Claude command
3. The story status updates as the workflow progresses

### Changing Status

Right-click any story to access the status menu:

- Set Status: Backlog
- Set Status: Ready for Dev
- Set Status: In Progress
- Set Status: Review
- Set Status: Done

### Multiple Sprint Files

If your workspace contains multiple `sprint-status.yaml` files:

1. Click the folder icon in the view title bar
2. Select which file to use from the quick pick menu

## Sprint Status File Format

The extension expects a `sprint-status.yaml` file with this structure:

```yaml
project: my-project
sprint: 1

epics:
  - id: 1
    name: User Authentication
    status: in-progress
    stories:
      - id: 1-1-login-page
        status: done
      - id: 1-2-signup-flow
        status: ready-for-dev
      - id: 1-3-password-reset
        status: backlog

  - id: 2
    name: Dashboard
    status: backlog
    stories:
      - id: 2-1-metrics-display
        status: backlog
```

### Story ID Format

Story IDs follow the pattern: `{epic-num}-{story-num}-{description}`

Example: `4-7-create-admin-staff-domain`

## Requirements

- VS Code 1.85.0 or higher
- Claude CLI installed and configured

## Extension Settings

This extension currently has no configurable settings. The sprint file selection is stored per-workspace.

## Commands

| Command | Description |
|---------|-------------|
| `Clique: Run Workflow` | Run the appropriate workflow for the selected story |
| `Clique: Refresh` | Reload the sprint-status.yaml file |
| `Clique: Select Sprint File` | Choose which sprint-status.yaml to use |
| `Clique: Set Status: *` | Change story status |

## Known Issues

- External changes to `sprint-status.yaml` may require a manual refresh in some cases

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Acknowledgments

This extension is built for the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) created by [Brian Madison](https://github.com/bmad-code-org). BMAD (Build, Measure, Analyze, Deliver) is a methodology for streamlined agent-driven development workflows.

## License

MIT - See [LICENSE](LICENSE) for details.
