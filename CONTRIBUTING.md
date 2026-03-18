# Contributing to Limner

## Adding a New Persona

A persona is a directory structure following the Person Schema:

1. Create a `CLAUDE.md` (or equivalent system prompt) defining identity, modes, and response formats
2. Add domain knowledge to `reference/` (or a project-specific subdirectory)
3. Bind to a project in `projects/[project-name]/`
4. Start a session and iterate

The schema is still emerging. Limner's Art Director is the first persona — the pattern will formalize after 2-3 more prove the structure.

## Contributing Tools

Tools live in `tools/` as standalone Python scripts. Requirements:

- Shebang line: `#!/usr/bin/env python3`
- Docstring with description and usage
- Dependencies listed in `requirements.txt`
- No package installation required — scripts run directly
- Accept file paths as arguments, return structured output

## Updating Learnings

The learnings files are Limner's institutional memory. The workflow:

1. **Read** `reference/learnings.md` (or project-specific learnings) before generating
2. **Generate** using known-good patterns, avoiding known-bad ones
3. **Validate** output against style guide and compliance rules
4. **Update** learnings with new discoveries

### What to capture
- Specific phrases that fixed problems
- Terms to avoid that caused issues
- Parameter values that worked for specific situations
- Surprising failures worth remembering

### What NOT to capture
- Obvious stuff already in the style guide
- One-off flukes
- Speculation (only confirmed learnings)

## Code Style

- Python 3.10+ compatible
- Linted with ruff (see `pyproject.toml` for config)
- Comments for non-obvious logic only
- Don't over-engineer — solve what's asked

## Submitting Changes

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Ensure `ruff check` passes
5. Open a PR with a clear description
