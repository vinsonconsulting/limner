# Summoning Chamber — Master Design Document

> The canonical reference for all design decisions.
> Version 1.0 — Compiled from completed questionnaires.

---

## ◈ Project Identity

| Attribute | Decision |
|-----------|----------|
| **Working Title** | Summoning Chamber (may refine) |
| **File Extension** | `.summon.md` |
| **Core Metaphor** | RPG Character Sheet / D&D spell invocation |
| **Visual Language** | VGA-era PC games (Darklands primary influence) |
| **Resolution** | Native 1920x1080 |
| **Palette** | Custom 256-color VGA-style |
| **Audio Direction** | FM synth (Genesis/PC-98) |

---

## ◈ Character Sheet Slots

### Slot Taxonomy

| Slot | Purpose | UI Input Type | Visual Representation |
|------|---------|---------------|----------------------|
| **Land of Origin** | Base model provider/family/version | Clickable map (progressive disclosure) | Distinct visual styles, color tints, costume elements |
| **Class** | Job role / expertise | Class cards with art | Environment selection |
| **Subclass** | Specialization | Dropdown within class | Scene props |
| **Demeanor** | Communication style | Dropdown from curated list | Scene atmosphere (lighting, arrangement) |
| **Nature** | Reasoning/thinking style | Dropdown from curated list | Scene props (charts, art supplies, etc.) |
| **Archetype** | Speaking style guide | TBD | Stock phrases, vocab, canned lines |
| **Equipment** | Direct tool integrations | Paper doll slots | Clickable scene objects |
| **Proficiencies** | MCP servers | Checkbox list (card selection UI) | Skills on character sheet |
| **Spells** | API connections | Spellbook pages (schools + providers) | Magical effects/items |
| **Trainings** | Vector DBs, RAG sources | Bookshelf (drag books) | Tomes on shelf |
| **Experience** | Unstructured context, backstory | Structured fields | Background lore |
| **Sworn Oaths** | Goals, directives | Checklist + custom field | Hard-enforced rules |
| **Sigils** | Emoji usage | Preset sigil sets | Visual mark in comms |
| **Trades** | Multi-step workflows | Basic sequence builder | Learned procedures |
| **Languages** | Supported languages | TBD | Translation abilities |
| **Appearance** | Visual customization | Sliders + AI generation | Portrait + full body |

### Slot Groupings

| Group | Slots | Metaphor |
|-------|-------|----------|
| **Identity** | Land of Origin, Class, Subclass | Who they are |
| **Personality** | Demeanor, Nature, Archetype | How they act |
| **Capabilities** | Equipment, Proficiencies, Spells | What they can do |
| **Knowledge** | Trainings, Experience | What they know |
| **Conduct** | Sworn Oaths, Sigils | How they behave |
| **Workflows** | Trades | What they do automatically |
| **Presentation** | Languages, Appearance | How they present |

---

## ◈ Class Definitions

| Fantasy Class | Real-World Equivalent | Primary Environment |
|---------------|----------------------|---------------------|
| Scryer | Researcher, Analyst | Gazing Pool |
| Magister | Writer, Editor, Summarizer | Castle Library |
| Hammerer | Builder | Workshop |
| Craftsman | Creator, Designer | Artisan Studio |
| Diplomat | Translator | Long Table |
| Herald | Communicator | Speaking Platform |
| Warden | Monitor, Validator, Fact-checker | Crossroads |
| Counselor | Advisor, Coach, Therapist | Study |
| Merchant | Negotiator, Sales, Persuader | Merchant Shop |
| Seneschal | Planner, Strategist | Commander Tent |
| Bard | Entertainer, Storyteller | Tavern |

### Multi-classing

No multi-classing. One Class + one Subclass per character.

---

## ◈ Demeanor Options

Curated dropdown list:

- Formal / Courtly
- Casual / Friendly
- Terse / Laconic
- Verbose / Elaborate
- Mysterious / Cryptic
- Sardonic / Dry wit
- Melancholic / Brooding
- Scholarly / Pedantic

---

## ◈ Nature Options

Curated dropdown list:

- Analytical / Logical
- Creative / Lateral
- Cautious / Thorough
- Bold / Decisive
- Empathetic / Intuitive
- Skeptical / Critical
- Optimistic / Solution-focused
- Systematic / Methodical
- Improvisational / Adaptive

---

## ◈ Land of Origin System

### Progressive Disclosure

1. **Land** (Provider) → The Clockwork Principality of OpenAI, The Anthropic Highlands, The Open Realm of Llama, etc.
2. **Region** (Model Family) → GPT-4, Claude 3, Gemini, Llama 3
3. **District** (Specific Model) → gpt-4-turbo, claude-3-opus, etc.

### Visual Impact

Each Land has distinct visual styles affecting:
- Color tints
- Costume elements
- Heraldic badges
- Environmental palette shifts

---

## ◈ Scene Engine

### Primary Scene Drivers (Ranked)

1. **Land of Origin** — Determines base environment style
2. **Class** — Determines environment type
3. **Equipment** — Adds clickable objects
4. **Subclass** — Adds specialized props
5. **Demeanor/Nature** — Modifies atmosphere and props

### Scene Modifiers

**Demeanor:**
- Formal → Ornate furniture, candles, proper arrangement
- Casual → Cluttered, cozy, lived-in
- Mysterious → Shadows, obscured corners, veiled elements

**Nature:**
- Analytical → Charts, diagrams, measuring instruments
- Creative → Art supplies, colorful chaos, works-in-progress
- Cautious → Locks, barriers, multiple light sources
- Bold → Open spaces, dramatic elements, weapons displayed

### Random Delight

Every summon looks slightly different:
- Small creatures (mice, spiders, familiars)
- Background activity (distant figures, movement outside windows)
- Lighting variations (candle flicker patterns, shaft of light)
- Easter eggs (hidden details for sharp eyes)

### Layer Architecture

1. Background — Walls, sky, distant elements
2. Midground furniture — Large objects
3. Props — Smaller objects, decorations
4. Equipment objects — Tool representations (clickable)
5. Character — The summoned agent
6. Foreground — Frame elements, atmospheric overlays
7. UI overlay — Buttons, panels

### Asset Organization

Modular tile/sprite sheets (combinatorial)

---

## ◈ Character Rendering

| Aspect | Decision |
|--------|----------|
| **Format** | Portrait for UI + Full body in scene |
| **Generation** | Paper doll assembly (modular parts) |
| **Animation** | Idle loop (subtle breathing, blinking) |
| **Appearance Controls** | Colors/palette, Styling (e.g., "elder wizard"), AI-generated option |

Note: No race/species selection — Land of Origin determines species appearance.

---

## ◈ Clickable Scene Objects

### MVP Objects

| Object | Click Action |
|--------|--------------|
| Agent character | Open conversation |
| Crystal ball / scrying mirror | Trigger web search |
| Bookshelf / tome | Show Trainings/Lore |
| Mechanical device | Trigger code execution |
| Scroll / letter | Show recent conversation |

### Phase 2 Objects

Potion/flask, Weapon/tool, Window/door, Candle/torch, Chest/container, Familiar/pet

### Click Feedback

- Brief animation (object moves/reacts)
- Context menu (right-click for options)

### Discoverability

- Subtle highlight on hover
- All clickable objects have slight animation/glow

---

## ◈ Scene States

| State Type | Behavior |
|------------|----------|
| **Time of Day** | Synced to user's real time |
| **Mood** | Lighting/atmosphere shifts with conversation tone |
| **Activity: Thinking** | Visual indicator (quill writing, gears turning) |
| **Activity: Researching** | Relevant objects animate |
| **Activity: Idle** | Subtle ambient animation |

---

## ◈ Chat Interface Layout

### Single Agent View (Layout A: Scene-Dominant)

```
┌─────────────────────────────┐
│                             │
│      SCENE (60%)            │
│                             │
├───────────────┬─────────────┤
│ THOUGHTS      │ CHAT        │
│ (20%)         │ (20%)       │
└───────────────┴─────────────┘
```

### Thoughts Panel Content

- Chain-of-thought reasoning (when available)
- Tool usage indicators ("Consulting web search...")
- Confidence/uncertainty signals
- Memory retrieval ("Recalling from Training: X...")
- Current Oath consideration ("Bound by oath to cite sources...")

### Thoughts Panel Style

Styled like handwritten notes

---

## ◈ Council Mode

### Layout

- **Tabbed view:** Each agent in their own full lair, tabs to switch
- **Grid view:** 2x3 grid for 5-6 agents
- **Hybrid:** Grid overview, click to expand one agent

### Council Scene

All agents in shared neutral space (council chamber)

### Interaction Models

- All answer the same prompt independently (A/B testing mode)
- User addresses specific party members by name
- Voting/consensus mechanism

---

## ◈ Creation Flow

### Philosophy

- **Structure:** Strictly linear (Wizardry style)
- **Save:** Explicit "save draft" action
- **Navigation:** Sidebar menu (always visible)
- **Transitions:** Slide (left/right)
- **Platform:** Desktop only for now

### Screen Sequence

| # | Screen | Priority | Notes |
|---|--------|----------|-------|
| 1 | Welcome/Entry | MVP | Atmospheric intro, Quick vs Full choice, recent drafts |
| 2 | Land of Origin | MVP | Clickable map with regions |
| 3 | Class Selection | MVP | Class cards with art and description |
| 4 | Personality | MVP | Dropdowns for Demeanor + Nature, sample text preview |
| 5 | Equipment | MVP | Paper doll with slots |
| 6 | Proficiencies | MVP | Card selection interface |
| 7 | Spells | MVP | Spellbook pages to fill |
| 8 | Knowledge | MVP | Bookshelf + upload + structured fields |
| 9 | Conduct | MVP | Checklist for Oaths, preset Sigils |
| 10 | Appearance | MVP | Sliders + AI generation |
| 11 | Trades | Phase 2 | Basic sequence builder |
| 12 | Summary/Review | Phase 2 | Full sheet view, editable |
| 13 | Summoning Ritual | Phase 2 | Medium theatrics, user choice to skip |

### Quick Summon

- Template selection OR import existing .summon.md
- Under 2 minutes total

---

## ◈ Admin UI

### Manages

- Available models (Land of Origin catalog)
- Available tools (Equipment catalog)
- MCP server registry (Proficiencies catalog)
- API connections (Spells catalog)
- Class definitions and descriptions
- Template characters
- User accounts and permissions
- System configuration

### Access

Just me + trusted collaborators (single-tenant initially)

### Priority

Essential for MVP — can bootstrap with config files, build UI in parallel

---

## ◈ .summon.md File Format

### Required Fields

```yaml
cart_version: "1.0"
cart_type: "agent"  # agent | component | council | scene
name: "Character Name"
id: "uuid"
created_at: "ISO8601"
updated_at: "ISO8601"
```

### Identity Fields

```yaml
author: "handle"           # Required
version: "1.0.0"           # Required (semantic)
description: "Short text"  # Required
tags: ["tag1", "tag2"]     # Required
author_contact: "optional"
license: "optional"
```

### Character Data Structure (UI-Grouped)

```yaml
identity:
  land_of_origin: "anthropic"
  model: "claude-3-opus"
  class: "magister"
  subclass: "historian"

personality:
  demeanor: "formal"
  nature: "analytical"
  archetype: "cackling scold"  # Speaking style with stock phrases

capabilities:
  equipment:
    - name: "Web Search"
      type: "tool"
      config:
        provider: "tavily"
  proficiencies:
    - name: "Google Drive"
      type: "mcp"
      config: {...}
  spells: []

knowledge:
  trainings: [...]

conduct:
  sworn_oaths:
    - "Always cite sources"
  sigils:
    emoji_style: "minimal"

appearance:
  styling: "elder wizard"
  clothing: "scholar_robes"
  accessories: ["spectacles", "quill"]
```

### Markdown Body Sections

```markdown
# Character Name

## Overview
Human-readable summary

## Backstory
Rich narrative for Experience slot

## Instructions
Detailed system prompt content

## Sworn Oaths
Expanded oath descriptions

## Example Conversations
Few-shot examples

## Changelog
Version history

## Notes
Creator's notes (not sent to model)
```

### Cartridge Types (v1)

| Type | Contains | Standalone? |
|------|----------|-------------|
| agent | Complete character | Yes |
| component | Single slot content | No |
| council | Collection of agents | Yes |
| scene | Environment definition | No |

### Portability

- Secrets in separate paired file (not in cartridge)
- All content embedded (self-contained)
- Design for export to CrewAI YAML
- Design for export to other frameworks
- Include framework-specific sections as needed

### Versioning

- Cartridge version: Semantic (1.0.0) + date (2025-01-31)
- Schema version: cart_version field
- Maintain backward compatibility always

---

## ◈ Visual Specifications

| Attribute | Value |
|-----------|-------|
| Resolution | 1920x1080 native |
| Palette | Custom 256-color (VGA-style, project-specific) |
| CRT Effects | Subtle, option to disable for accessibility |
| Dithering | Floyd-Steinberg (organic feel) |
| Character Sheet Layout | Darklands as primary influence |

---

## ◈ Audio Specifications

| Attribute | Value |
|-----------|-------|
| Direction | FM synth (Genesis/PC-98) |
| Priority 1 | UI sound effects |
| Priority 2 | Ambient lair atmosphere |
| Priority 3 | Summoning ritual fanfare |
| Priority 4 | Text/dialogue blips |
| User Control | Toggle on/off |

---

## ◈ Onboarding

| Aspect | Decision |
|--------|----------|
| Paths | Dual — "Quick Summon" vs "Full Ritual" |
| Tutorial | Contextual hints that fade as you learn |
| Errors | Flavor first, clarity second |

---

## ◈ Tooling Requirements

### Validation

- CLI tool that checks schema compliance
- Built into web UI

### Generation

- Export from Summoning Chamber UI (essential)
- CLI generator from prompts
- Template scaffolding tool

### Conversion

- Import from CrewAI YAML
- Export to CrewAI YAML
- Import from other agent frameworks
- JSON export for programmatic use

---

## ◈ Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | **Svelte** (selected for Council mode complexity) |
| Hosting | Cloudflare Pages (static) |
| Functions | Cloudflare Workers (serverless) |
| Storage | Cloudflare KV/D1 + user export/import |
| Auth | OAuth (Google/GitHub) |
| Primary Framework | CrewAI |
| Execution | Client-side (browser calls APIs directly) |

---

## ◈ Asset Pipeline

### MVP

1. AI-generate with heavy manual cleanup
2. Use/adapt existing pixel art assets (with licensing)
3. Placeholder art first, polish later

### Long-term

1. Full custom asset library
2. Procedural generation from AI
3. Hybrid approach
4. Single artist creates base environments
5. Strict style guide enforced
6. AI trained on style (when viable)

---

## ◈ Phase Summary

### MVP (Phase 1)

- Welcome/Entry screen
- Identity screens (Land + Class)
- Personality screen
- Capabilities screens (Equipment, Proficiencies, Spells)
- Knowledge screen
- Conduct screen
- Appearance screen
- Admin UI (config-file bootstrapped)
- Single agent chat with scene
- .summon.md export/import

### Phase 2

- Trades (workflow builder)
- Summary/Review screen
- Summoning Ritual animation
- Council mode
- Additional clickable objects
- Full Admin UI

### Future

- NFC/USB-C physical cartridges
- Local model support
- Mobile flow
- Community features

---

## ◈ Open Questions

Items requiring final clarification:

1. **Archetype slot:** ~~Is this part of Personality group?~~ → **DEFERRED to Phase 2** for further design

2. **Knowledge screen priority:** ~~Marked both "Nice-to-Have" and "Skip"~~ → **RESOLVED: MVP with simplified implementation**

3. **Frontend framework:** ~~Prototype in both~~ → **RESOLVED: Svelte selected** for future-proofing (Council mode complexity)

4. **Dithering examples:** ~~Still want visual comparison?~~ → **RESOLVED: Floyd-Steinberg confirmed** (demo delivered)

5. **Land of Origin kingdoms:** ~~Need to define fantasy kingdom names~~ → **RESOLVED: All 10 Lands named and documented**
   - **IP REVIEW COMPLETE**: Silvanus→Seelie Groves, Halflings→Smallfolk, Bag of Holding→Bottomless Satchel, Lizardmen→Scalekind

6. **Heraldry selection:** ~~3 options provided per Land~~ → **RESOLVED: Option A locked for all Lands**

---

## ◈ Phase Status

**DESIGN PHASE: LOCKED** ✓

Ready for Visual Development Phase:
1. Art Director CrewAI agent (prompt ready for new chat thread)
2. MidJourney exploration
3. Custom 256-color palette definition

---

*The design is locked. The Chamber awaits construction.*

*Document version: 1.2*
*Last updated: 2025-02-01*
*Status: DESIGN PHASE LOCKED — Ready for Visual Development*
