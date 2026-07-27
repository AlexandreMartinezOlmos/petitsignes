/**
 * Exports the sign content to two files:
 *
 *   content/vocabulary.tsv  — the editable manifest (open it in any spreadsheet)
 *   docs/vocabulari.md      — a read-only catalogue with every clickable link
 *
 * Both are regenerated from the per-sign JSON, which stays the source of truth.
 *
 *   npm run content:export
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_IDS, type CategoryId } from '../src/lib/types.ts';
import {
  entryToRow,
  serializeTsv,
  youtubeWatchUrl,
  dilseSearchUrl,
  dilseTermFromUrl,
  youTubeIdFromUrl,
  type SignData,
  type VocabularyRow,
} from './lib/vocabulary.ts';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const SIGNS_DIR = path.join(ROOT, 'src/content/signs');

const CATEGORY_LABEL: Record<CategoryId, string> = {
  food: 'Menjar i beure',
  routines: 'Rutines i cura',
  family: 'Persones i família',
  emotions: 'Emocions',
  animals: 'Animals',
  objects: 'Objectes i joguines',
  actions: 'Accions',
  qualities: 'Qualitats',
  nature: 'Natura i exterior',
  courtesy: 'Cortesia',
  body: 'Cos',
  clothing: 'Roba',
  colors: 'Colors',
  numbers: 'Números',
  time: 'Temps i conceptes',
};

async function readAll(): Promise<{ id: string; data: SignData }[]> {
  const files = (await readdir(SIGNS_DIR)).filter((f) => f.endsWith('.json'));
  const entries = await Promise.all(
    files.map(async (file) => {
      const data = JSON.parse(await readFile(path.join(SIGNS_DIR, file), 'utf8')) as SignData;
      return { id: file.replace(/\.json$/, ''), data };
    }),
  );
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

function link(url: string, text: string): string {
  return `[${text}](${url})`;
}

function markdownDoc(entries: { id: string; data: SignData }[]): string {
  const total = entries.length;
  const withLsc = entries.filter((e) => e.data.videos.some((v) => v.signLanguage === 'lsc')).length;
  const withLse = entries.filter((e) => e.data.videos.some((v) => v.signLanguage === 'lse')).length;

  const out: string[] = [
    '# Vocabulari — totes les paraules i els seus vídeos',
    '',
    '> Document generat automàticament amb `npm run content:export`. **No l’editis a mà**: els',
    "> canvis es fan a `content/vocabulary.tsv` i s'apliquen amb `npm run content:import`.",
    '',
    `Actualitzat: ${new Date().toISOString().slice(0, 10)} · ${total} conceptes · ` +
      `${withLsc} amb LSC · ${withLse} amb LSE.`,
    '',
  ];

  for (const category of CATEGORY_IDS) {
    const inCategory = entries.filter((e) => e.data.category === category);
    if (inCategory.length === 0) continue;

    out.push(`## ${CATEGORY_LABEL[category]}`, '');
    out.push('| Paraula (ca / es / en) | LSC | LSE |', '|---|---|---|');

    for (const { data } of inCategory) {
      const label = `${data.labels.ca} / ${data.labels.es} / ${data.labels.en}`;
      const lsc = data.videos.filter((v) => v.signLanguage === 'lsc');
      const lse = data.videos.find((v) => v.signLanguage === 'lse');

      const lscCell =
        lsc.length === 0
          ? '—'
          : lsc
              .map((v, i) => {
                const id = youTubeIdFromUrl(v.videoUrl) ?? '';
                return link(youtubeWatchUrl(id), lsc.length > 1 ? `▶ ${i + 1}` : '▶ vídeo');
              })
              .join(' ');
      const lseCell = lse ? link(dilseSearchUrl(dilseTermFromUrl(lse.videoUrl)), '↗ DILSE') : '—';

      out.push(`| ${label} | ${lscCell} | ${lseCell} |`);
    }
    out.push('');
  }

  return out.join('\n');
}

async function main(): Promise<void> {
  const entries = await readAll();

  const rows: VocabularyRow[] = entries.map(({ id, data }) => entryToRow(id, data));
  await writeFile(path.join(ROOT, 'content/vocabulary.tsv'), serializeTsv(rows), 'utf8');
  await writeFile(path.join(ROOT, 'docs/vocabulari.md'), markdownDoc(entries), 'utf8');

  console.log(`Exported ${rows.length} concepts → content/vocabulary.tsv and docs/vocabulari.md`);
}

await main();
