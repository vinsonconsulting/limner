import type { GuidanceBlock, GuidanceEntry } from './types.js';

/**
 * A4 framing (verbatim). Limner is a third-party project on Anthropic's CMA
 * platform — never a Claude/Anthropic product. Single source for every
 * author-facing surface so the disclaimer cannot drift.
 */
export const A4_FRAMING =
  "Limner is an independent third-party project built on Anthropic's CMA platform; it is not an Anthropic or Claude product.";

function serializeBlock(block: GuidanceBlock): string {
  switch (block.kind) {
    case 'paragraph':
      return block.text;
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}`;
    case 'bullets':
      return block.items.map((item) => `- ${item}`).join('\n');
    case 'table': {
      const header = `| ${block.columns.join(' | ')} |`;
      const divider = `| ${block.columns.map(() => '---').join(' | ')} |`;
      const rows = block.rows.map((row) => `| ${row.join(' | ')} |`);
      return [header, divider, ...rows].join('\n');
    }
  }
}

/**
 * Render a GuidanceEntry to GitHub-flavored markdown. Deterministic by
 * contract — stable column order, blocks separated by one blank line, exactly
 * one trailing newline — because the skills drift-check (Path A) does an exact
 * string compare against this output.
 */
export function serializeGuidance(entry: GuidanceEntry): string {
  const parts: string[] = [`# ${entry.title}`, `> ${A4_FRAMING}`];
  for (const block of entry.body) {
    parts.push(serializeBlock(block));
  }
  return `${parts.join('\n\n')}\n`;
}
