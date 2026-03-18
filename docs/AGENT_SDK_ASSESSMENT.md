# Limner → Claude Agent SDK: Architecture Assessment

> Evaluating options for formalizing Limner as a production Claude API agent using the Claude Agent SDK.

**Date:** 2026-03-18
**Status:** Assessment / Pre-implementation
**SDK Version Evaluated:** claude-agent-sdk v0.1.48 (Python)

---

## Executive Summary

Limner's current architecture — a `CLAUDE.md` system prompt, Python tool scripts, and domain knowledge files — maps almost directly onto the Claude Agent SDK's programming model. The SDK provides the same agent loop, built-in tools, and context management that power Claude Code, but as a programmable Python/TypeScript library.

**Recommendation:** Pursue a phased migration. Start with a read-only "Art Consultant" agent (Phase 1), then add generation capabilities (Phase 2), then full autonomous workflows (Phase 3).

**Estimated effort:** 2-3 weeks for Phase 1 (functional read-only agent with all domain knowledge and validation tools).

---

## Current Architecture

```
┌─────────────────────────────────────────────────┐
│ Claude Code / Claude Project                     │
│                                                   │
│  CLAUDE.md (system prompt)                        │
│  ├── Identity: Limner Art Director                │
│  ├── Modes: GENERATE, CRITIQUE, REFINE, CATALOG  │
│  └── Response formats: structured output          │
│                                                   │
│  reference/ (domain knowledge)                    │
│  ├── style_guide.md                               │
│  ├── lands.md, classes.md                         │
│  ├── prompt_templates.md                          │
│  └── learnings.md                                 │
│                                                   │
│  tools/ (Python scripts, invoked via Bash)        │
│  ├── vga_validate.py                              │
│  ├── palette_check.py                             │
│  ├── retro_diffusion.py (API client)              │
│  └── asset_inventory.py                           │
│                                                   │
│  Human provides: creative direction, approval     │
│  Claude provides: prompt eng, critique, catalog   │
└─────────────────────────────────────────────────┘
```

**Strengths:** Simple, works now, domain knowledge is thorough, learnings accumulate.
**Weaknesses:** No programmatic API access, no session persistence across conversations, no automated pipelines, no multi-agent delegation, tool invocation is indirect (via Bash).

---

## Claude Agent SDK: What It Provides

The Claude Agent SDK (formerly Claude Code SDK) gives you the same capabilities as Claude Code, programmable in Python and TypeScript.

### Package & Installation

```bash
pip install claude-agent-sdk
```

**Repo:** `github.com/anthropics/claude-agent-sdk-python` (v0.1.48)
**Docs:** `platform.claude.com/docs/en/agent-sdk/overview`

### Core API Surface

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition, HookMatcher

# The fundamental pattern: async iterator of messages
async for message in query(
    prompt="Your task here",
    options=ClaudeAgentOptions(
        system_prompt="...",           # Persona definition
        allowed_tools=["Read", "Bash", "Glob", "Grep"],  # Permission control
        permission_mode="acceptEdits", # Or "default" for interactive approval
        hooks={...},                   # Lifecycle callbacks
        agents={...},                  # Subagent definitions
        mcp_servers={...},             # External tool servers
        resume=session_id,             # Session continuation
    ),
):
    # Messages stream as the agent works
    if hasattr(message, "result"):
        print(message.result)
```

### Built-in Tools (Available Out of the Box)

| Tool | Maps to Limner Need |
|------|---------------------|
| **Read** | Reading reference docs, learnings, style guide |
| **Write** | Creating session logs, updating asset catalog |
| **Edit** | Updating learnings.md, refining catalog entries |
| **Bash** | Running Python validation tools, API calls |
| **Glob** | Finding assets by pattern in output/ |
| **Grep** | Searching learnings, reference docs |
| **WebSearch** | Looking up reference material |
| **WebFetch** | Fetching external docs |
| **Agent** | Delegating to specialized subagents |

### Key Capabilities

**Sessions:** Persist context across multiple interactions. Resume a session hours later with full memory of files read, analysis done, and conversation history.

**Subagents:** Spawn specialized agents for focused subtasks. A "Validator" subagent runs compliance checks while the main agent continues prompt refinement.

**Hooks:** Run custom code at lifecycle events (`PreToolUse`, `PostToolUse`, `Stop`). Log every file change, enforce additional constraints, collect metrics.

**MCP Servers:** Connect to external systems. The Retro Diffusion API client could become an MCP server, giving the agent direct generation capability without shelling out.

**Permissions:** Fine-grained control over what the agent can do. Read-only mode for critique, write-enabled for cataloging.

---

## Migration Mapping

### 1:1 Mapping: Current → SDK

| Current (Claude Code) | SDK Equivalent |
|----------------------|----------------|
| `CLAUDE.md` contents | `ClaudeAgentOptions(system_prompt=...)` |
| `reference/` files read via context | Agent reads via `Read` tool (or pre-loaded) |
| `python tools/pixel_art/vga_validate.py` via Bash | `Bash` tool, or custom MCP tool |
| Human approval in chat | `AskUserQuestion` tool, or hook callbacks |
| Session notes in `sessions/` | SDK session persistence + `Write` tool |
| Learnings updates | `Edit` tool on `reference/learnings.md` |

### What Stays the Same

- **System prompt:** `CLAUDE.md` content becomes `system_prompt` parameter directly
- **Domain knowledge:** `reference/` files stay on disk; agent reads them via `Read` tool
- **Python tools:** Existing scripts work unchanged via `Bash` tool
- **Learnings workflow:** Agent reads before generating, updates after approval
- **Response formats:** Defined in system prompt, work identically

### What Changes

- **Invocation:** `claude` CLI → `query()` async function call
- **Integration:** Can embed in web apps, CI/CD, scheduled jobs, other agents
- **Session persistence:** Built-in resume/fork vs. starting fresh each conversation
- **Multi-agent:** Can delegate validation to a subagent while continuing main work
- **Programmatic control:** Hooks let you enforce constraints, log actions, collect metrics

---

## Architecture Options

### Option A: Minimal — SDK Wrapper Around Existing Setup

**Effort:** 1 week | **Risk:** Low | **Value:** Medium

Wrap the existing `CLAUDE.md` + tools in a thin SDK script. The agent reads files and invokes tools exactly as it does in Claude Code today, but programmatically.

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions
from pathlib import Path

SYSTEM_PROMPT = Path("CLAUDE.md").read_text()

async def limner_session(task: str):
    """Run a Limner art direction session."""
    async for message in query(
        prompt=task,
        options=ClaudeAgentOptions(
            system_prompt=SYSTEM_PROMPT,
            allowed_tools=["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
        ),
    ):
        if hasattr(message, "result"):
            return message.result
```

**Pros:** Works immediately, no code changes to tools or docs.
**Cons:** Doesn't leverage SDK-specific features (sessions, subagents, hooks).

### Option B: Enhanced — Custom MCP Tools + Subagents

**Effort:** 2-3 weeks | **Risk:** Medium | **Value:** High

Register Limner's Python tools as proper MCP tools. Define subagents for specialized work. Add hooks for quality enforcement.

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition, HookMatcher

async def main():
    async for message in query(
        prompt="Generate and validate a Seelie Groves backdrop",
        options=ClaudeAgentOptions(
            system_prompt=SYSTEM_PROMPT,
            allowed_tools=[
                "Read", "Edit", "Write", "Bash", "Glob", "Grep", "Agent"
            ],
            agents={
                "validator": AgentDefinition(
                    description="VGA compliance validator. Runs pixel art validation tools.",
                    prompt=(
                        "You validate pixel art assets against VGA-era standards. "
                        "Run vga_validate.py, palette_check.py, and png_validate.py. "
                        "Report structured results."
                    ),
                    tools=["Read", "Bash", "Glob"],
                ),
                "cataloger": AgentDefinition(
                    description="Asset cataloger. Updates asset catalog and learnings.",
                    prompt=(
                        "You maintain the asset catalog and learnings files. "
                        "Append approved assets to output/asset_catalog.md. "
                        "Update reference/learnings.md with new insights."
                    ),
                    tools=["Read", "Edit", "Write"],
                ),
            },
            mcp_servers={
                # Retro Diffusion as MCP server (Phase 2)
                # "retro-diffusion": {
                #     "command": "python",
                #     "args": ["tools/api/rd_mcp_server.py"]
                # }
            },
            hooks={
                "PostToolUse": [
                    HookMatcher(
                        matcher="Write|Edit",
                        hooks=[log_file_changes]
                    )
                ]
            },
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)
```

**Pros:** Full SDK capability, subagent delegation, lifecycle hooks, proper tool registration.
**Cons:** More setup work, need to write MCP server wrapper for RD API.

### Option C: Full Platform — Multi-Agent Art Pipeline

**Effort:** 4-6 weeks | **Risk:** Higher | **Value:** Very High

Build a complete art generation pipeline where Limner orchestrates multiple specialized agents, manages sessions across multi-day projects, and integrates with external systems.

```
┌──────────────────────────────────────────────────────────┐
│ Limner Orchestrator (main agent)                          │
│   system_prompt: CLAUDE.md                                │
│   tools: Read, Write, Edit, Glob, Grep, Agent            │
│                                                            │
│   ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│   │ Generator     │  │ Validator    │  │ Cataloger     │  │
│   │ subagent      │  │ subagent     │  │ subagent      │  │
│   │               │  │              │  │               │  │
│   │ Drives RD API │  │ Runs VGA     │  │ Updates asset │  │
│   │ via MCP       │  │ checks via   │  │ catalog and   │  │
│   │               │  │ Bash tools   │  │ learnings     │  │
│   └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                            │
│   Sessions: persistent across multi-day generation runs    │
│   Hooks: audit logging, cost tracking, quality gates       │
│   MCP: Retro Diffusion API, palette management             │
└──────────────────────────────────────────────────────────┘
```

**Pros:** Autonomous art generation pipeline, persistent project state, cost tracking.
**Cons:** Significant engineering investment, complex error handling for API calls.

---

## Recommended Approach: Phased Migration

### Phase 1: Read-Only Art Consultant (Week 1-2)

**Goal:** Limner can critique, advise, and generate prompts via API call.

- Wrap `CLAUDE.md` as `system_prompt`
- Allow `Read`, `Glob`, `Grep` tools (read-only)
- Agent reads domain knowledge on demand
- Returns structured prompt output and critiques
- Test with existing Summoning Chamber assets

**Deliverable:** `limner_agent.py` — callable from any Python application.

### Phase 2: Validation + Cataloging (Week 2-3)

**Goal:** Limner can validate assets and update the catalog.

- Add `Bash`, `Write`, `Edit` tools
- Register validation scripts as available via Bash
- Add "validator" subagent for parallel compliance checks
- Implement session persistence for multi-step workflows
- Add `PostToolUse` hook for audit logging

**Deliverable:** Agent can run the full GENERATE → VALIDATE → CATALOG workflow.

### Phase 3: Autonomous Generation (Week 4+)

**Goal:** Limner can drive the Retro Diffusion API directly.

- Build `rd_mcp_server.py` — MCP server wrapping `retro_diffusion.py`
- Add "generator" subagent with RD API access
- Implement cost tracking hooks
- Add `AskUserQuestion` for approval gates
- Session persistence across multi-day generation runs

**Deliverable:** End-to-end autonomous art generation pipeline.

---

## Technical Considerations

### Authentication

The SDK requires an Anthropic API key (`ANTHROPIC_API_KEY`). Also supports Bedrock, Vertex AI, and Azure Foundry for enterprise deployments.

For the Retro Diffusion API, the `RD_API_TOKEN` would be passed as an environment variable, accessible to the agent via Bash or MCP server.

### Cost Model

Two cost vectors:

1. **Claude API usage:** Token costs for agent reasoning. A typical GENERATE session (read domain knowledge + generate prompt) will consume ~10-20K input tokens (domain docs) + ~2-5K output tokens. At current Sonnet pricing, roughly $0.05-0.15 per session.

2. **Retro Diffusion credits:** $0.015-0.22 per image depending on tier. Unchanged from current workflow.

The SDK itself adds no cost beyond Claude API usage. The agent loop, tool execution, and session management are all local.

### Session Persistence

The SDK manages session state internally. Key patterns:

```python
# Capture session ID from init message
async for message in query(prompt="Read the style guide", options=opts):
    if hasattr(message, "subtype") and message.subtype == "init":
        session_id = message.session_id

# Resume later with full context
async for message in query(
    prompt="Now generate a prompt for the Ironroot Holdings",
    options=ClaudeAgentOptions(resume=session_id),
):
    ...
```

This is a significant improvement over the current model (start fresh each Claude Code session or Claude Project conversation).

### MCP Server for Retro Diffusion

The existing `tools/api/retro_diffusion.py` can be wrapped as an MCP server using FastMCP:

```python
# tools/api/rd_mcp_server.py (sketch)
from mcp.server.fastmcp import FastMCP
from tools.api.retro_diffusion import RDClient, get_palette_base64

mcp = FastMCP("retro-diffusion")

@mcp.tool()
def generate_pixel_art(
    prompt: str,
    width: int = 256,
    height: int = 256,
    style: str = "rd_pro__default",
    land: str | None = None,
    remove_bg: bool = False,
) -> str:
    """Generate pixel art via Retro Diffusion API."""
    client = RDClient(api_token=os.environ["RD_API_TOKEN"])
    palette = get_palette_base64(land) if land else None
    result = client.generate(
        prompt=prompt, width=width, height=height,
        style=style, input_palette=palette, remove_bg=remove_bg,
    )
    # Save and return path
    output_path = f"output/{prompt[:30].replace(' ', '_')}.png"
    result.images[0].save(output_path)
    return f"Generated: {output_path} (cost: {result.credit_cost} credits)"

@mcp.tool()
def check_credits() -> str:
    """Check remaining Retro Diffusion API credits."""
    client = RDClient(api_token=os.environ["RD_API_TOKEN"])
    info = client.check_credits()
    return f"Remaining: {info['credits']} credits"
```

### Permissions Strategy

| Phase | Permission Mode | Allowed Tools |
|-------|----------------|---------------|
| Phase 1 | Default (read-only) | Read, Glob, Grep |
| Phase 2 | acceptEdits | + Bash, Write, Edit, Agent |
| Phase 3 | acceptEdits + hooks | + MCP (Retro Diffusion) |

The `acceptEdits` permission mode auto-approves file edits while still requiring human approval for other sensitive operations. Hooks provide additional guardrails.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK API instability (v0.1.x) | Breaking changes on update | Pin version, test before upgrading |
| Token cost for domain docs | High input token usage | Progressive loading (read only what's needed per task) |
| Session state corruption | Lost context mid-project | Implement session backup/export |
| RD API rate limits | Generation bottleneck | Queue management in MCP server |
| Prompt drift from system_prompt | Persona degradation over long sessions | Periodic context reinforcement via hooks |

---

## Decision Points

Before implementation, confirm:

1. **Primary runtime:** Will Limner-as-SDK-agent replace Claude Code usage, or supplement it? (Recommendation: supplement — use SDK for automation, Claude Code for interactive sessions.)

2. **Hosting model:** Local Python script, or deployed as a service? (Recommendation: start local, deploy later if needed.)

3. **Phase 1 scope:** Read-only consultant sufficient for initial value? Or jump to Phase 2? (Recommendation: Phase 1 first — validates the pattern before investing in write operations.)

4. **MCP vs Bash for tools:** Wrap existing tools as MCP servers, or continue invoking via Bash? (Recommendation: Bash for Phase 1-2, MCP for Phase 3 — Bash is zero-effort, MCP is cleaner long-term.)

---

## References

- **Claude Agent SDK Overview:** https://platform.claude.com/docs/en/agent-sdk/overview
- **Python SDK Repo:** https://github.com/anthropics/claude-agent-sdk-python
- **TypeScript SDK Repo:** https://github.com/anthropics/claude-agent-sdk-typescript
- **Example Agents:** https://github.com/anthropics/claude-agent-sdk-demos
- **MCP Specification:** https://modelcontextprotocol.io
- **FastMCP (Python MCP servers):** https://github.com/jlowin/fastmcp

---

*This assessment is a living document. Update as the SDK matures and Limner's requirements evolve.*
