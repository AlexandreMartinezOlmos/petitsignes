import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'zod';
import {
  CATEGORY_IDS,
  SIGN_LANGUAGES,
  SIGN_SOURCES,
  VIDEO_DELIVERIES,
  VIDEO_STATUSES,
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
    status: z.enum(VIDEO_STATUSES).default('draft'),
    variant: z.string().min(1).optional(),
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
      difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      tips: localizedText.optional(),
      // 0..n: a concept may have no video yet, or one per sign language, or
      // several when a sign language documents territorial variants (§6.4).
      videos: z.array(signVideo).default([]),
    })
    .strict()
    .refine((entry) => !entry.isFirstSign || entry.firstSignOrder !== undefined, {
      message: 'Entries in the "first signs" path need a firstSignOrder',
      path: ['firstSignOrder'],
    })
    .refine(
      (entry) => {
        // Never two videos for the same sign language unless they are labelled
        // as distinct variants — the UI would have no way to choose (§4.2).
        const unlabelled = entry.videos.filter((video) => video.variant === undefined);
        return new Set(unlabelled.map((video) => video.signLanguage)).size === unlabelled.length;
      },
      {
        message: 'Duplicate videos for one sign language must declare a `variant`',
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
