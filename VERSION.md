# Version Management

The version number is automatically displayed in the UI from `client/package.json`.

## Bumping Versions

Use these commands from the `client/` directory:

```bash
# Patch version (0.4.0 -> 0.4.1) - for bug fixes
npm run version:patch

# Minor version (0.4.0 -> 0.5.0) - for new features
npm run version:minor

# Major version (0.4.0 -> 1.0.0) - for breaking changes
npm run version:major
```

## Workflow

1. Make your changes
2. Bump version: `cd client && npm run version:patch` (or minor/major)
3. Commit: `git add -A && git commit -m "v0.4.1: Your changes"`
4. Push: `git push`

The version will automatically appear in the top-left corner of the UI.

## Current Version: 0.4.0
