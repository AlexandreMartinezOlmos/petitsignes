/**
 * Naming and download of the exported progress file.
 *
 * Kept out of the island so the filename contract is unit-tested: the file is
 * the only way a visitor can move their progress between devices, and a name
 * that collides or that an operating system rejects would silently ruin that.
 */

export const PROGRESS_FILE_PREFIX = 'petitsignes-progres';
export const PROGRESS_FILE_TYPE = 'application/json';

/**
 * `petitsignes-progres-2026-07-24.json`. Dated, so successive exports do not
 * overwrite each other in the downloads folder, and sortable by name.
 */
export function progressFileName(now: Date = new Date()): string {
  const [date] = now.toISOString().split('T');
  return `${PROGRESS_FILE_PREFIX}-${date}.json`;
}

/**
 * Triggers a download of `contents` without leaving the page. The object URL is
 * revoked immediately: the browser has already taken its own reference by the
 * time the click returns, and leaving it alive would pin the blob in memory.
 */
export function downloadJson(contents: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: PROGRESS_FILE_TYPE }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
