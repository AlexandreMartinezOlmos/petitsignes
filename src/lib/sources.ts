/**
 * What each official source is, in the terms a video's data has to agree with.
 *
 * A sign video carries its source by name and its addresses as URLs, and the
 * schema used to check only that each URL was a URL. A DILSE link filed under
 * the Generalitat's source, or a YouTube id recorded as LSE, passed the build
 * and would have been published with the wrong attribution — or, worse, as the
 * gesture of the wrong sign language. The two languages sign differently, so
 * that is not a cosmetic error.
 *
 * The rules describe the sources as they are used today; a new source, or a new
 * address for an existing one, is a reviewed change to this table.
 */

import type { SignLanguage, SignSource, SignVideo, VideoDelivery } from './types.ts';
import { youtubeId } from './youtube.ts';

interface SourceRule {
  signLanguage: SignLanguage;
  delivery: VideoDelivery;
  /** Host of `sourceUrl`: where the attribution sends the reader. */
  sourceHost: string;
  /** Whether `videoUrl` is an address this source actually publishes at. */
  isVideoUrl: (url: string) => boolean;
  /** How to describe a valid `videoUrl` in an error message. */
  videoUrlShape: string;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const DILSE_HOST = 'fundacioncnse-dilse.org';

export const SOURCE_RULES: Readonly<Record<SignSource, SourceRule>> = {
  // The Generalitat publishes its LSC vocabulary on YouTube; the attribution
  // points at the vocabulary's own page.
  'Gencat-VocabulariLSC': {
    signLanguage: 'lsc',
    delivery: 'youtube-embed',
    sourceHost: 'llengua.gencat.cat',
    isVideoUrl: (url) => youtubeId(url) !== null,
    videoUrlShape: 'a YouTube video URL',
  },
  // DILSE does not allow embedding: the video is its own dictionary entry,
  // reached by link.
  'CNSE-DILSE': {
    signLanguage: 'lse',
    delivery: 'external-link',
    sourceHost: DILSE_HOST,
    isVideoUrl: (url) => hostOf(url) === DILSE_HOST,
    videoUrlShape: `a ${DILSE_HOST} URL`,
  },
};

type Provenance = Pick<
  SignVideo,
  'source' | 'signLanguage' | 'delivery' | 'videoUrl' | 'sourceUrl'
>;

/** Every way a video's data contradicts its declared source; empty when none. */
export function provenanceProblems(video: Provenance): string[] {
  const rule = SOURCE_RULES[video.source];
  const problems: string[] = [];

  if (video.signLanguage !== rule.signLanguage) {
    problems.push(
      `${video.source} publishes ${rule.signLanguage.toUpperCase()}, not ${video.signLanguage.toUpperCase()}`,
    );
  }
  if (video.delivery !== rule.delivery) {
    problems.push(`${video.source} videos are delivered as "${rule.delivery}"`);
  }
  if (!rule.isVideoUrl(video.videoUrl)) {
    problems.push(`${video.source} videoUrl must be ${rule.videoUrlShape}: ${video.videoUrl}`);
  }
  if (hostOf(video.sourceUrl) !== rule.sourceHost) {
    problems.push(`${video.source} sourceUrl must be on ${rule.sourceHost}: ${video.sourceUrl}`);
  }

  return problems;
}
