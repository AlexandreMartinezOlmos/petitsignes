/**
 * Translation for code that runs in the browser.
 *
 * `i18n.ts` holds every interface string in every language, and a React island
 * that imported it took all of them to the visitor: the three dictionaries,
 * about 6 kB compressed, on every page, to show a player with eight labels in
 * one language. Worse than the weight, a Catalan page carried the Spanish and
 * English interface as code it would never run.
 *
 * So an island never imports the dictionaries. It declares the keys it uses;
 * the page, rendered at build time, picks those strings in its own language
 * (`pickMessages` in `i18n.ts`) and passes them as a prop; the island reads
 * them through `translatorFrom`. The only import from `i18n.ts` here is a
 * type, which the compiler erases.
 *
 * Typing the translator by the declared keys keeps the list honest in both
 * directions: an island that uses a key it did not declare does not compile,
 * and the page cannot pass a string the island did not ask for.
 */

import type { MessageKey } from './i18n.ts';

/** The strings one island needs, in the page's language. */
export type Messages<Key extends MessageKey = MessageKey> = Readonly<Record<Key, string>>;

export type Translate<Key extends MessageKey = MessageKey> = (
  key: Key,
  values?: Record<string, string | number>,
) => string;

/** Replaces `{name}` placeholders. Missing values are left untouched. */
export function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function translatorFrom<Key extends MessageKey>(messages: Messages<Key>): Translate<Key> {
  return (key, values) => interpolate(messages[key], values);
}
