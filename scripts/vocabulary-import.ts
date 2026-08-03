/**
 * Applies the edited manifest back into the per-sign JSON.
 *
 *   1. edit content/vocabulary.tsv in a spreadsheet (add rows, fill LSC/LSE)
 *   2. npm run content:import
 *   3. npm run build
 *
 * The merge preserves each video's verification status and source dictionary
 * lemma when its id/term is unchanged (see scripts/lib/vocabulary.ts). Files
 * for concepts that are no longer in the manifest are left in place and
 * reported, so a deletion is always a deliberate manual step.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyRow, parseTsv, type SignData } from './lib/vocabulary.ts';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const SIGNS_DIR = path.join(ROOT, 'src/content/signs');
const MANIFEST = path.join(ROOT, 'content/vocabulary.tsv');
const TODAY = new Date().toISOString().slice(0, 10);

/** Stable key order keeps the JSON diffs readable in review. */
function serialize(data: SignData): string {
  const ordered: SignData = {
    labels: data.labels,
    category: data.category,
    isFirstSign: data.isFirstSign,
    ...(data.firstSignOrder !== undefined ? { firstSignOrder: data.firstSignOrder } : {}),
    videos: data.videos,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

async function readExisting(id: string): Promise<SignData | null> {
  try {
    return JSON.parse(await readFile(path.join(SIGNS_DIR, `${id}.json`), 'utf8')) as SignData;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const rows = parseTsv(await readFile(MANIFEST, 'utf8'));

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = await readExisting(row.id);
    const next = applyRow(row, existing, TODAY);
    await writeFile(path.join(SIGNS_DIR, `${row.id}.json`), serialize(next), 'utf8');
    if (existing) updated += 1;
    else created += 1;
  }

  const known = new Set(rows.map((r) => r.id));
  const orphans = (await readdir(SIGNS_DIR))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((id) => !known.has(id));

  console.log(`Imported ${rows.length} concepts: ${created} created, ${updated} updated.`);
  if (orphans.length > 0) {
    console.log(
      `Not in the manifest, left untouched (delete by hand if intended): ${orphans.join(', ')}`,
    );
  }
}

await main();
