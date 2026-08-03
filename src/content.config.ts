import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'zod';
import {
  CATEGORY_IDS,
  SIGN_LANGUAGES,
  SIGN_SOURCES,
  VIDEO_DELIVERIES,
  type Language,
} from './lib/types.ts';

/** `{ ca, es, en }` — every string must exist in all three interface languages. */
const localizedText = z.object({
  ca: z.string().min(1),
  es: z.string().min(1),
  en: z.string().min(1),
});

// Compile-time guard: adding a Language without updating localizedText fails here.
type LocalizedTextKeys = keyof z.infer<typeof localizedText>;
type _AllLanguagesCovered = Language extends LocalizedTextKeys ? true : never;
const _allLanguagesCovered: _AllLanguagesCovered = true;
void _allLanguagesCovered;

/**
 * One signed realisation of a concept. Attribution fields are required: a video
 * without a verifiable source cannot ship.
 */
const signVideo = z
  .object({
    signLanguage: z.enum(SIGN_LANGUAGES),
    delivery: z.enum(VIDEO_DELIVERIES),
    videoUrl: z.url(),
    posterUrl: z.string().min(1).optional(),
    source: z.enum(SIGN_SOURCES),
    sourceUrl: z.url(),
    license: z.string().min(1),
    updatedAt: z.iso.date(),
    // The lemma the source dictionary uses for this exact entry (e.g. Gencat's
    // own "Llit" for our "cama"). Attribution metadata, not a UI label: it
    // used to be called `variant` and rendered as one on every sign page, which
    // told the reader a Catalan word was "a variant" of itself. Purely
    // informational now — nothing reads it to make a decision.
    sourceTerm: z.string().min(1).optional(),
  })
  .strict();

const signs = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/signs' }),
  schema: z
    .object({
      labels: localizedText,
      category: z.enum(CATEGORY_IDS),
      isFirstSign: z.boolean().default(false),
      firstSignOrder: z.number().int().positive().optional(),
      // 0..n: a concept may have no video yet, or one per sign language.
      videos: z.array(signVideo).default([]),
    })
    .strict()
    .refine((entry) => !entry.isFirstSign || entry.firstSignOrder !== undefined, {
      message: 'Entries in the "first signs" path need a firstSignOrder',
      path: ['firstSignOrder'],
    })
    .refine(
      (entry) => {
        // Two videos for the same sign language used to be allowed when
        // labelled as a "variant", on the premise that a future selector would
        // let the reader choose. It never shipped: both `SignCard` and
        // `SignView` always take the first video and ignore the rest, so the
        // exception only ever produced unreachable data (16 videos across 14
        // concepts, found by audit). A real second meaning, like the
        // hearing/Deaf-community forms of "aplaudir", gets its own concept and
        // its own page instead.
        const languages = entry.videos.map((video) => video.signLanguage);
        return new Set(languages).size === languages.length;
      },
      {
        message: 'A sign cannot have two videos for the same sign language',
        path: ['videos'],
      },
    ),
});

const categories = defineCollection({
  loader: file('./src/content/categories.json'),
  schema: z
    .object({
      id: z.enum(CATEGORY_IDS),
      labels: localizedText,
      icon: z.string().min(1),
      order: z.number().int().nonnegative(),
    })
    .strict(),
});

export const collections = { signs, categories };
