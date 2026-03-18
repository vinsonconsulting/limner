# Directory Structure Cleanup — Naming Conventions & Duplicate Removal

## Overview

Directory structure inconsistencies create cascading failures in component systems that construct file paths programmatically. A single asset directory with inconsistent naming (kebab-case vs underscore, mixed capitalization, redundant structures) can break path helpers, invalidate imports, and require extensive manual correction during integration.

This document extracts reusable patterns for detecting, validating, and consolidating directory structures in pixel art projects.

---

## Problem Statement

### Naming Convention Drift

Asset directories often accumulate multiple naming conventions over time:

- **Kebab-case**: `seelie-groves/`, `freemark-reaches/`
- **Underscore**: `seelie_groves/`, `freemark_reaches/`
- **Mixed case**: `SeelieGroves/`, `Seelie-Groves/`
- **Duplicate structures**: Both `seelie-groves/` and `seelie_groves/` coexist with identical content

### Impact on Integration

**Path Construction Failures**:
```typescript
// Path helper expects kebab-case
export function getLandBackdropPath(landId: string): string {
  return `/assets/lands/${landId}/backdrop.png`;
}

// Fails when landId = "seelie-groves" but directory is "seelie_groves/"
// Succeeds when landId = "seelie_groves" but directory is "seelie-groves/"
// 50% failure rate if both directories exist
```

**Component Integration Blockers**:
- SvelteKit/React components using path helpers break intermittently
- Asset loading fails depending on which ID convention is used
- Developers manually test each asset path rather than trusting helpers
- CI/CD pipelines fail on file-not-found errors

**Developer Confusion**:
- Which directory is canonical? The one with more files? Most recent?
- Safe to delete either? Both contain files — which to keep?
- Bulk renaming breaks existing references

---

## Detection Strategies

### Strategy 1: Pattern-Based Directory Scanning

**Goal**: Find all directories matching a base name with different conventions

```python
from pathlib import Path
import re

def find_duplicate_directories(base_path, patterns=None):
    """
    Find directories with same semantic name, different conventions.

    Args:
        base_path: Root directory to scan
        patterns: Optional list of regex patterns to match

    Returns:
        Dict mapping normalized name → list of actual directory paths
    """
    if patterns is None:
        # Default: match kebab-case and underscore variants
        patterns = [
            r'^([a-z]+)-([a-z]+)$',  # kebab-case: seelie-groves
            r'^([a-z]+)_([a-z]+)$',  # underscore: seelie_groves
            r'^([A-Z][a-z]+)([A-Z][a-z]+)$',  # PascalCase: SeelieGroves
        ]

    dirs = [d for d in Path(base_path).iterdir() if d.is_dir()]

    # Normalize all directory names to lowercase-no-separators
    normalized_map = {}
    for dir_path in dirs:
        name = dir_path.name
        # Strip all separators and lowercase
        normalized = re.sub(r'[-_]', '', name.lower())

        if normalized not in normalized_map:
            normalized_map[normalized] = []
        normalized_map[normalized].append(dir_path)

    # Filter to only groups with multiple variants
    duplicates = {k: v for k, v in normalized_map.items() if len(v) > 1}

    return duplicates
```

**Usage Example**:
```python
# Scan lands/ directory for duplicate naming
duplicates = find_duplicate_directories('static/assets/lands/')

# Output:
# {
#   'seeliegrovesgroves': [
#     PosixPath('static/assets/lands/seelie-groves'),
#     PosixPath('static/assets/lands/seelie_groves')
#   ],
#   'freemarkfreemarkreaches': [
#     PosixPath('static/assets/lands/freemark-reaches'),
#     PosixPath('static/assets/lands/freemark_reaches')
#   ]
# }
```

### Strategy 2: Content Comparison (Verify True Duplicates)

**Goal**: Confirm duplicate directories contain identical or overlapping content

```python
import hashlib

def hash_file(file_path):
    """SHA256 hash of file contents."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()

def compare_directory_contents(dir1, dir2):
    """
    Compare contents of two directories.

    Returns:
        dict with keys: common_files, dir1_only, dir2_only, content_differs
    """
    dir1_files = {f.relative_to(dir1): f for f in dir1.rglob('*') if f.is_file()}
    dir2_files = {f.relative_to(dir2): f for f in dir2.rglob('*') if f.is_file()}

    common_paths = set(dir1_files.keys()) & set(dir2_files.keys())
    dir1_only = set(dir1_files.keys()) - set(dir2_files.keys())
    dir2_only = set(dir2_files.keys()) - set(dir1_files.keys())

    content_differs = []
    for rel_path in common_paths:
        hash1 = hash_file(dir1_files[rel_path])
        hash2 = hash_file(dir2_files[rel_path])
        if hash1 != hash2:
            content_differs.append(rel_path)

    return {
        'common_files': list(common_paths),
        'dir1_only': list(dir1_only),
        'dir2_only': list(dir2_only),
        'content_differs': content_differs
    }
```

**Decision Logic**:
```python
def analyze_duplicate_pair(dir1, dir2):
    """
    Analyze duplicate directories and recommend action.

    Returns:
        dict with 'action' and 'reason' keys
    """
    comparison = compare_directory_contents(dir1, dir2)

    # Case 1: Identical content
    if (not comparison['dir1_only'] and
        not comparison['dir2_only'] and
        not comparison['content_differs']):
        return {
            'action': 'delete_either',
            'reason': 'Directories contain identical files — safe to delete either'
        }

    # Case 2: One directory is subset of other
    if not comparison['dir1_only'] and comparison['dir2_only']:
        return {
            'action': 'keep_dir2_delete_dir1',
            'reason': f'dir2 contains all files from dir1 plus {len(comparison["dir2_only"])} additional files'
        }

    if not comparison['dir2_only'] and comparison['dir1_only']:
        return {
            'action': 'keep_dir1_delete_dir2',
            'reason': f'dir1 contains all files from dir2 plus {len(comparison["dir1_only"])} additional files'
        }

    # Case 3: Both contain unique files
    if comparison['dir1_only'] and comparison['dir2_only']:
        return {
            'action': 'merge_required',
            'reason': f'dir1 has {len(comparison["dir1_only"])} unique files, dir2 has {len(comparison["dir2_only"])} unique files',
            'merge_strategy': 'Move all unique files to canonical directory, then delete duplicate'
        }

    # Case 4: Same files, different content
    if comparison['content_differs']:
        return {
            'action': 'manual_review',
            'reason': f'{len(comparison["content_differs"])} files have different content — requires manual diff',
            'files_to_review': comparison['content_differs']
        }
```

### Strategy 3: File Count & Modification Time Heuristic

**Goal**: Quick heuristic for identifying canonical directory when content is identical

```python
from datetime import datetime

def get_directory_stats(dir_path):
    """
    Get statistics for directory comparison heuristic.

    Returns:
        dict with file_count, total_size, most_recent_modification
    """
    files = list(dir_path.rglob('*'))
    file_list = [f for f in files if f.is_file()]

    if not file_list:
        return {
            'file_count': 0,
            'total_size': 0,
            'most_recent_modification': None
        }

    total_size = sum(f.stat().st_size for f in file_list)
    most_recent = max(f.stat().st_mtime for f in file_list)

    return {
        'file_count': len(file_list),
        'total_size': total_size,
        'most_recent_modification': datetime.fromtimestamp(most_recent)
    }

def choose_canonical_directory(dir1, dir2):
    """
    Use heuristics to choose canonical directory.

    Priority:
    1. Directory with more files
    2. If equal file count, directory with more recent modifications
    3. If equal mtime, alphabetical precedence (kebab-case preferred)

    Returns:
        tuple: (canonical_path, duplicate_path)
    """
    stats1 = get_directory_stats(dir1)
    stats2 = get_directory_stats(dir2)

    # Prefer directory with more files
    if stats1['file_count'] > stats2['file_count']:
        return (dir1, dir2)
    elif stats2['file_count'] > stats1['file_count']:
        return (dir2, dir1)

    # Equal file count: prefer more recent modifications
    if stats1['most_recent_modification'] and stats2['most_recent_modification']:
        if stats1['most_recent_modification'] > stats2['most_recent_modification']:
            return (dir1, dir2)
        elif stats2['most_recent_modification'] > stats1['most_recent_modification']:
            return (dir2, dir1)

    # Equal mtime: alphabetical (kebab-case "seelie-groves" < underscore "seelie_groves")
    if dir1.name < dir2.name:
        return (dir1, dir2)
    else:
        return (dir2, dir1)
```

---

## Consolidation Workflows

### Workflow 1: Safe Deletion (Identical Content)

**When**: Directories contain byte-for-byte identical files

```bash
#!/bin/bash
# consolidate_duplicates.sh

set -e

# Example: Consolidate seelie-groves/ and seelie_groves/
CANONICAL="static/assets/lands/seelie-groves"
DUPLICATE="static/assets/lands/seelie_groves"

# Step 1: Verify directories exist
if [ ! -d "$CANONICAL" ]; then
    echo "Error: Canonical directory $CANONICAL does not exist"
    exit 1
fi

if [ ! -d "$DUPLICATE" ]; then
    echo "Error: Duplicate directory $DUPLICATE does not exist"
    exit 1
fi

# Step 2: Verify content is identical
echo "Comparing directory contents..."
diff -qr "$CANONICAL" "$DUPLICATE"

# If diff exits with 0, directories are identical
if [ $? -eq 0 ]; then
    echo "✓ Directories are identical — safe to delete duplicate"

    # Step 3: Remove duplicate
    rm -rf "$DUPLICATE"
    echo "✓ Deleted $DUPLICATE"
else
    echo "✗ Directories differ — manual review required"
    exit 1
fi
```

**Validation**:
```bash
# Verify directory removed
ls -d static/assets/lands/*/ | wc -l  # Should decrease by 1

# Verify canonical directory intact
ls -lh "$CANONICAL"  # Should show all files unchanged
```

### Workflow 2: Merge Strategy (Complementary Content)

**When**: Each directory contains unique files that should be combined

```python
from pathlib import Path
import shutil

def merge_duplicate_directories(canonical, duplicate, dry_run=True):
    """
    Merge unique files from duplicate into canonical, then delete duplicate.

    Args:
        canonical: Path to keep
        duplicate: Path to merge and delete
        dry_run: If True, only print actions without executing

    Returns:
        dict with moved_files, skipped_files, errors
    """
    comparison = compare_directory_contents(canonical, duplicate)

    moved_files = []
    skipped_files = []
    errors = []

    # Move files that only exist in duplicate
    for rel_path in comparison['dir2_only']:
        src = duplicate / rel_path
        dst = canonical / rel_path

        if dry_run:
            print(f"[DRY RUN] Would move: {src} → {dst}")
            moved_files.append((src, dst))
        else:
            try:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dst))
                print(f"✓ Moved: {src} → {dst}")
                moved_files.append((src, dst))
            except Exception as e:
                print(f"✗ Error moving {src}: {e}")
                errors.append((src, str(e)))

    # Report files with conflicting content
    for rel_path in comparison['content_differs']:
        src = duplicate / rel_path
        dst = canonical / rel_path
        print(f"⚠️  Conflict: {rel_path} exists in both with different content")
        skipped_files.append((src, dst, 'content_differs'))

    # If no errors and no conflicts, delete duplicate directory
    if not dry_run and not errors and not comparison['content_differs']:
        shutil.rmtree(duplicate)
        print(f"✓ Deleted duplicate directory: {duplicate}")

    return {
        'moved_files': moved_files,
        'skipped_files': skipped_files,
        'errors': errors
    }
```

**Usage**:
```python
# Dry run first
results = merge_duplicate_directories(
    Path('static/assets/lands/seelie-groves'),
    Path('static/assets/lands/seelie_groves'),
    dry_run=True
)

# Review output, then execute
if not results['skipped_files'] and not results['errors']:
    merge_duplicate_directories(
        Path('static/assets/lands/seelie-groves'),
        Path('static/assets/lands/seelie_groves'),
        dry_run=False
    )
```

### Workflow 3: Batch Consolidation (Multiple Duplicate Pairs)

**When**: Project has many duplicate directory pairs (e.g., 10 Lands × 2 naming conventions = 20 dirs)

```python
def batch_consolidate_duplicates(base_path, naming_preference='kebab-case', dry_run=True):
    """
    Consolidate all duplicate directories in a project.

    Args:
        base_path: Root directory to scan
        naming_preference: 'kebab-case' or 'underscore' — canonical convention
        dry_run: If True, report actions without executing

    Returns:
        Summary report dict
    """
    duplicates = find_duplicate_directories(base_path)

    report = {
        'total_duplicate_groups': len(duplicates),
        'actions': [],
        'errors': []
    }

    for normalized_name, dir_list in duplicates.items():
        # Choose canonical based on naming preference
        if naming_preference == 'kebab-case':
            canonical = next((d for d in dir_list if '-' in d.name), dir_list[0])
        elif naming_preference == 'underscore':
            canonical = next((d for d in dir_list if '_' in d.name), dir_list[0])
        else:
            # Fallback: use heuristic
            canonical, _ = choose_canonical_directory(dir_list[0], dir_list[1])

        duplicates_to_merge = [d for d in dir_list if d != canonical]

        for duplicate in duplicates_to_merge:
            print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing: {duplicate} → {canonical}")

            # Analyze what action is needed
            analysis = analyze_duplicate_pair(canonical, duplicate)

            if analysis['action'] == 'delete_either':
                if not dry_run:
                    shutil.rmtree(duplicate)
                    print(f"✓ Deleted {duplicate} (identical to canonical)")
                report['actions'].append({
                    'duplicate': str(duplicate),
                    'canonical': str(canonical),
                    'action': 'deleted',
                    'reason': analysis['reason']
                })

            elif analysis['action'] in ['keep_dir1_delete_dir2', 'keep_dir2_delete_dir1']:
                # One is superset — safe to delete subset
                if not dry_run:
                    shutil.rmtree(duplicate)
                    print(f"✓ Deleted {duplicate} (subset of canonical)")
                report['actions'].append({
                    'duplicate': str(duplicate),
                    'canonical': str(canonical),
                    'action': 'deleted',
                    'reason': analysis['reason']
                })

            elif analysis['action'] == 'merge_required':
                # Merge unique files
                merge_results = merge_duplicate_directories(canonical, duplicate, dry_run)
                report['actions'].append({
                    'duplicate': str(duplicate),
                    'canonical': str(canonical),
                    'action': 'merged',
                    'moved_files': len(merge_results['moved_files']),
                    'reason': analysis['reason']
                })

            elif analysis['action'] == 'manual_review':
                print(f"⚠️  {duplicate} requires manual review: {analysis['reason']}")
                report['errors'].append({
                    'duplicate': str(duplicate),
                    'canonical': str(canonical),
                    'reason': analysis['reason'],
                    'files_to_review': analysis.get('files_to_review', [])
                })

    # Summary
    print(f"\n{'='*60}")
    print(f"Batch Consolidation {'Dry Run ' if dry_run else ''}Report")
    print(f"{'='*60}")
    print(f"Total duplicate groups: {report['total_duplicate_groups']}")
    print(f"Actions taken: {len(report['actions'])}")
    print(f"Errors/Manual review: {len(report['errors'])}")

    return report
```

**Execution**:
```python
# Dry run with kebab-case preference
report = batch_consolidate_duplicates(
    'static/assets/lands/',
    naming_preference='kebab-case',
    dry_run=True
)

# Review report, then execute
if len(report['errors']) == 0:
    batch_consolidate_duplicates(
        'static/assets/lands/',
        naming_preference='kebab-case',
        dry_run=False
    )
```

---

## Naming Convention Standards

### Recommendation: Kebab-Case for All Asset Directories

**Rationale**:
1. **URL-safe**: No encoding needed for web paths (`/assets/seelie-groves/backdrop.png`)
2. **Case-insensitive filesystems**: Works identically on macOS (case-insensitive) and Linux (case-sensitive)
3. **Cross-platform**: No issues with Windows path limits or reserved characters
4. **Visual clarity**: Hyphens more readable than underscores in file paths
5. **JavaScript/TypeScript convention**: Matches import path style in modern frameworks

**Standard Format**:
```
static/assets/
├── lands/
│   ├── seelie-groves/         # ✓ kebab-case
│   ├── freemark-reaches/      # ✓ kebab-case
│   └── ironroot-holdings/     # ✓ kebab-case
├── classes/
│   ├── scryer/                # ✓ lowercase single word
│   ├── hammerer/              # ✓ lowercase single word
│   └── craftsman/             # ✓ lowercase single word
└── icons/
    ├── status/                # ✓ lowercase
    ├── tools/                 # ✓ lowercase
    └── actions/               # ✓ lowercase
```

### Migration Script: Rename to Kebab-Case

```python
import re
from pathlib import Path

def to_kebab_case(name):
    """Convert string to kebab-case."""
    # Handle PascalCase or camelCase: insert hyphen before capitals
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    # Handle acronyms: insert hyphen before capital runs
    s2 = re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1)
    # Replace underscores with hyphens
    s3 = s2.replace('_', '-')
    # Lowercase
    return s3.lower()

def rename_to_kebab_case(base_path, dry_run=True):
    """
    Rename all directories to kebab-case convention.

    Args:
        base_path: Root directory to scan
        dry_run: If True, print actions without executing

    Returns:
        List of (old_path, new_path) tuples
    """
    dirs = sorted([d for d in Path(base_path).iterdir() if d.is_dir()], reverse=True)

    renamed = []
    for dir_path in dirs:
        kebab_name = to_kebab_case(dir_path.name)

        if kebab_name == dir_path.name:
            # Already kebab-case
            continue

        new_path = dir_path.parent / kebab_name

        if new_path.exists():
            print(f"⚠️  Cannot rename {dir_path.name} → {kebab_name} (target exists)")
            continue

        if dry_run:
            print(f"[DRY RUN] Would rename: {dir_path.name} → {kebab_name}")
        else:
            dir_path.rename(new_path)
            print(f"✓ Renamed: {dir_path.name} → {kebab_name}")

        renamed.append((dir_path, new_path))

    return renamed
```

---

## Post-Cleanup Validation

### Validation 1: No Duplicate Directory Names

```python
def validate_no_duplicates(base_path):
    """
    Verify no duplicate directory names exist.

    Returns:
        bool: True if no duplicates, False otherwise
    """
    duplicates = find_duplicate_directories(base_path)

    if duplicates:
        print(f"✗ Found {len(duplicates)} duplicate directory groups:")
        for normalized, paths in duplicates.items():
            print(f"  - {normalized}: {[p.name for p in paths]}")
        return False
    else:
        print(f"✓ No duplicate directories found in {base_path}")
        return True
```

### Validation 2: Naming Convention Compliance

```python
def validate_naming_convention(base_path, convention='kebab-case'):
    """
    Verify all directories follow naming convention.

    Args:
        base_path: Root directory to scan
        convention: 'kebab-case', 'underscore', or 'lowercase'

    Returns:
        bool: True if all comply, False otherwise
    """
    dirs = [d for d in Path(base_path).iterdir() if d.is_dir()]

    if convention == 'kebab-case':
        pattern = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
    elif convention == 'underscore':
        pattern = re.compile(r'^[a-z0-9]+(_[a-z0-9]+)*$')
    elif convention == 'lowercase':
        pattern = re.compile(r'^[a-z0-9]+$')
    else:
        raise ValueError(f"Unknown convention: {convention}")

    non_compliant = []
    for dir_path in dirs:
        if not pattern.match(dir_path.name):
            non_compliant.append(dir_path.name)

    if non_compliant:
        print(f"✗ {len(non_compliant)} directories do not follow {convention} convention:")
        for name in non_compliant:
            print(f"  - {name}")
        return False
    else:
        print(f"✓ All directories follow {convention} convention")
        return True
```

### Validation 3: Path Helper Verification

**Goal**: Verify that programmatic path construction works for all assets

```typescript
// Test path helpers against actual filesystem
import { describe, it, expect } from 'vitest';
import { readdir } from 'fs/promises';
import { getLandBackdropPath, getClassOverlayPath } from '$lib/services/scene';

describe('Path helpers match filesystem', () => {
  it('should construct valid paths for all lands', async () => {
    const landDirs = await readdir('static/assets/lands', { withFileTypes: true });
    const landIds = landDirs
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const landId of landIds) {
      const path = getLandBackdropPath(landId);
      const exists = await Bun.file(path).exists();
      expect(exists, `Path should exist: ${path}`).toBe(true);
    }
  });
});
```

---

## Integration with CI/CD

### Pre-Commit Hook: Prevent New Duplicates

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Detect duplicate asset directories before commit
echo "Checking for duplicate asset directories..."

DUPLICATES=$(python scripts/detect_duplicate_dirs.py static/assets/)

if [ -n "$DUPLICATES" ]; then
    echo "✗ Duplicate directories detected:"
    echo "$DUPLICATES"
    echo ""
    echo "Please consolidate duplicates before committing."
    echo "Run: python scripts/consolidate_duplicates.py"
    exit 1
fi

echo "✓ No duplicate directories found"
```

### GitHub Actions: Directory Structure Validation

```yaml
# .github/workflows/validate-assets.yml
name: Validate Asset Structure

on: [push, pull_request]

jobs:
  validate-directories:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Check for duplicate directories
        run: |
          python scripts/detect_duplicate_dirs.py static/assets/

      - name: Verify kebab-case convention
        run: |
          python scripts/validate_naming_convention.py static/assets/ --convention kebab-case

      - name: Test path helpers
        run: |
          npm test -- path-helpers.test.ts
```

---

## Case Study: Summoning Chamber Session 13

### Problem Discovery

**Symptoms**:
- Path helper `getLandBackdropPath(landId)` failed intermittently
- Component integration blocked — scenes wouldn't render for some lands
- Asset loading worked locally but failed in CI

**Root Cause**:
```bash
# Directory structure scan revealed duplicates
$ ls -d static/assets/lands/*/
static/assets/lands/seelie-groves/
static/assets/lands/seelie_groves/
static/assets/lands/freemark-reaches/
static/assets/lands/freemark_reaches/
static/assets/lands/ironroot-holdings/
static/assets/lands/ironroot_holdings/
# ... 20 total directories (10 Lands × 2 naming conventions)
```

**Impact**:
- Path construction worked for 10/10 lands if using correct convention
- But 50% failure rate if convention mismatched between code and filesystem
- Developers couldn't trust which ID format to use in components

### Consolidation Strategy

1. **Detection**:
```python
duplicates = find_duplicate_directories('static/assets/lands/')
# Found 10 duplicate groups
```

2. **Analysis**:
```python
for group in duplicates.values():
    canonical, duplicate = choose_canonical_directory(group[0], group[1])
    analysis = analyze_duplicate_pair(canonical, duplicate)
    # Result: All pairs had identical content — safe deletion
```

3. **Execution**:
```bash
# Batch consolidate with kebab-case preference
python scripts/batch_consolidate.py static/assets/lands/ --convention kebab-case
# Deleted 10 underscore-named directories
# Kept 10 kebab-case directories
```

4. **Validation**:
```bash
# Verify directory count
$ ls -d static/assets/lands/*/ | wc -l
11  # 10 lands + 1 summoner directory ✓

# Verify naming convention
$ python scripts/validate_naming.py static/assets/lands/ --convention kebab-case
✓ All directories follow kebab-case convention

# Test path helpers
$ npm test
✓ All 10 land paths resolve correctly
```

### Results

- **Before**: 20 directories, 50% path failure rate, integration blocked
- **After**: 11 directories, 0% path failure rate, integration unblocked
- **Cost**: ~500KB removed (empty duplicate directories)
- **Developer impact**: Path helpers now trustworthy, components integrate cleanly

---

## Reusable Decision Tree

```
┌─────────────────────────────────────┐
│ Directory structure issue detected? │
└─────────────┬───────────────────────┘
              │
              ├─ YES ─→ Run duplicate detection script
              │         │
              │         ├─ Duplicates found?
              │         │  │
              │         │  ├─ YES ─→ For each duplicate pair:
              │         │  │         │
              │         │  │         ├─ Compare contents (hash-based)
              │         │  │         │  │
              │         │  │         │  ├─ Identical? ─→ Delete either (prefer kebab-case)
              │         │  │         │  │
              │         │  │         │  ├─ One is superset? ─→ Keep superset, delete subset
              │         │  │         │  │
              │         │  │         │  ├─ Both have unique files? ─→ Merge to canonical, delete duplicate
              │         │  │         │  │
              │         │  │         │  └─ Content differs? ─→ Manual diff required
              │         │  │
              │         │  └─ NO ─→ Check naming convention compliance
              │         │            │
              │         │            ├─ Non-compliant? ─→ Rename to kebab-case
              │         │            │
              │         │            └─ Compliant? ─→ Validate path helpers work
              │
              └─ NO ─→ Preventive validation
                       │
                       ├─ Add pre-commit hook (detect new duplicates)
                       │
                       ├─ Add CI validation (naming convention check)
                       │
                       └─ Add path helper tests (filesystem match)
```

---

## Key Takeaways

1. **Detect early**: Naming inconsistencies compound over time — catch them before they spread
2. **Automate validation**: Pre-commit hooks and CI prevent new duplicates from entering codebase
3. **Prefer kebab-case**: URL-safe, cross-platform, framework-aligned convention
4. **Content comparison is critical**: Don't assume directories with similar names contain identical files
5. **Merge, don't delete blindly**: Some duplicate directories have complementary content
6. **Test path helpers**: Integration failures cascade from directory structure issues
7. **Document canonical convention**: Make naming standard explicit in project README/CLAUDE.md

---

## Tools Reference

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `find_duplicate_directories.py` | Detect duplicate directory names | Base path | Dict of duplicate groups |
| `compare_directory_contents.py` | Hash-based content comparison | Two directory paths | Comparison report |
| `analyze_duplicate_pair.py` | Recommend consolidation action | Two directory paths | Action + reason |
| `batch_consolidate_duplicates.py` | Bulk consolidation | Base path + convention preference | Summary report |
| `rename_to_kebab_case.py` | Batch rename to kebab-case | Base path | List of renamed paths |
| `validate_naming_convention.py` | Convention compliance check | Base path + convention | Pass/fail report |
| `validate_no_duplicates.py` | Post-cleanup verification | Base path | Pass/fail |

---

## Integration Points

**Upstream Dependencies**:
- File system scanning (Python pathlib, bash find)
- Content hashing (hashlib SHA256)

**Downstream Consumers**:
- Path helper functions (TypeScript/JavaScript component integration)
- Asset validation workflows (CI/CD pipelines)
- Developer handoff documentation (integration guides)

**Complementary Patterns**:
- `indexed_color.md` — File size optimization via color mode conversion
- `file_size.md` — Duplicate detection via content hashing (same technique)
- `asset_inventory.md` (upcoming) — Directory structure as inventory organization
