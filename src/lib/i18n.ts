/**
 * Interface translations (docs/requisitos.md §4.7).
 *
 * The routing side of i18n (`/ca`, `/es`, `/en`) is Phase 2, but every string
 * already goes through this module so that adding the routes later is a change
 * to pages only — not to every component.
 *
 * This is the TEXT axis. It is unrelated to the sign language of the videos
 * (CLAUDE.md §4.2).
 */

import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './types.ts';

const MESSAGES = {
  ca: {
    'site.title': 'Petits Signes',
    'site.tagline': 'Aprèn signes per comunicar-te amb el teu nadó abans que parli',
    'nav.catalogue': 'Catàleg',
    'nav.firstSigns': 'Primers signes',
    'nav.credits': 'Fonts i crèdits',
    'nav.skipToContent': 'Vés al contingut',
    'nav.language': 'Idioma i llengua de signes',
    'nav.home': 'Inici',
    'nav.accessibility': 'Accessibilitat',

    'hero.title': "Comunica't amb el teu nadó",
    'hero.titleAccent': 'molt abans de la primera paraula',
    'hero.lead': 'Signes reals de la llengua de signes catalana per al dia a dia amb el teu nadó.',
    'hero.stat.signs': 'signes',
    'hero.stat.learned': 'apresos',

    'search.label': 'Cerca un signe',
    'search.placeholder': 'Cerca un signe…',
    'search.clear': 'Esborra la cerca',
    'search.noResults': 'Cap signe coincideix amb «{query}».',
    'search.resultCount': '{count} signes',
    'search.resultCountOne': '1 signe',

    'filter.categories': 'Categories',
    'filter.all': 'Tots',
    'filter.firstSigns': 'Primers signes',
    'filter.favorites': 'Preferits',
    'filter.learned': 'Apresos',
    'filter.pending': 'Pendents',
    'filter.clear': 'Treu els filtres',

    'card.watchSign': 'Veure el signe',
    'card.addFavorite': 'Afegeix a preferits',
    'card.removeFavorite': 'Treu de preferits',
    'card.markLearned': 'Marca com a après',
    'card.unmarkLearned': 'Marca com a no après',
    'card.noVideo': 'Sense vídeo en {signLanguage}',
    'card.watchAtSource': 'Veure a {source}',
    'card.posterPending': 'Encara no tenim la imatge d’aquest signe',

    'signLanguage.label': 'Llengua de signes',
    'signLanguage.lsc': 'LSC',
    'signLanguage.lse': 'LSE',
    'signLanguage.lscFull': 'Llengua de Signes Catalana',
    'signLanguage.lseFull': 'Llengua de Signes Espanyola',

    'player.close': 'Tanca el vídeo',
    'player.speedNormal': 'Velocitat normal',
    'player.speedSlow': 'Càmera lenta',
    'player.source': 'Font d’aquest signe',

    'progress.export': 'Exporta el progrés',
    'progress.import': 'Importa el progrés',
    'progress.reset': 'Reinicia el progrés',
    'progress.resetConfirm': 'Segur que vols esborrar preferits i signes apresos?',

    'firstSigns.title': 'Primers signes',
    'firstSigns.intro':
      'Dotze signes per començar, en l’ordre que sol funcionar millor. No cal fer-los tots alhora: amb dos o tres ja n’hi ha prou per començar.',
    'firstSigns.step': 'Pas {order}',

    'notice.babyPrecision':
      'Els primers signes que faci el nadó seran imprecisos, igual que les primeres paraules. És normal: el reconeixeràs pel context.',
  },

  es: {
    'site.title': 'Petits Signes',
    'site.tagline': 'Aprende signos para comunicarte con tu bebé antes de que hable',
    'nav.catalogue': 'Catálogo',
    'nav.firstSigns': 'Primeros signos',
    'nav.credits': 'Fuentes y créditos',
    'nav.skipToContent': 'Ir al contenido',
    'nav.language': 'Idioma y lengua de signos',
    'nav.home': 'Inicio',
    'nav.accessibility': 'Accesibilidad',

    'hero.title': 'Comunícate con tu bebé',
    'hero.titleAccent': 'mucho antes de la primera palabra',
    'hero.lead': 'Signos reales de la lengua de signos española para el día a día con tu bebé.',
    'hero.stat.signs': 'signos',
    'hero.stat.learned': 'aprendidos',

    'search.label': 'Buscar un signo',
    'search.placeholder': 'Buscar un signo…',
    'search.clear': 'Borrar la búsqueda',
    'search.noResults': 'Ningún signo coincide con «{query}».',
    'search.resultCount': '{count} signos',
    'search.resultCountOne': '1 signo',

    'filter.categories': 'Categorías',
    'filter.all': 'Todos',
    'filter.firstSigns': 'Primeros signos',
    'filter.favorites': 'Favoritos',
    'filter.learned': 'Aprendidos',
    'filter.pending': 'Pendientes',
    'filter.clear': 'Quitar los filtros',

    'card.watchSign': 'Ver el signo',
    'card.addFavorite': 'Añadir a favoritos',
    'card.removeFavorite': 'Quitar de favoritos',
    'card.markLearned': 'Marcar como aprendido',
    'card.unmarkLearned': 'Marcar como no aprendido',
    'card.noVideo': 'Sin vídeo en {signLanguage}',
    'card.watchAtSource': 'Ver en {source}',
    'card.posterPending': 'Todavía no tenemos la imagen de este signo',

    'signLanguage.label': 'Lengua de signos',
    'signLanguage.lsc': 'LSC',
    'signLanguage.lse': 'LSE',
    'signLanguage.lscFull': 'Lengua de Signos Catalana',
    'signLanguage.lseFull': 'Lengua de Signos Española',

    'player.close': 'Cerrar el vídeo',
    'player.speedNormal': 'Velocidad normal',
    'player.speedSlow': 'Cámara lenta',
    'player.source': 'Fuente de este signo',

    'progress.export': 'Exportar el progreso',
    'progress.import': 'Importar el progreso',
    'progress.reset': 'Reiniciar el progreso',
    'progress.resetConfirm': '¿Seguro que quieres borrar favoritos y signos aprendidos?',

    'firstSigns.title': 'Primeros signos',
    'firstSigns.intro':
      'Doce signos para empezar, en el orden que suele funcionar mejor. No hace falta hacerlos todos a la vez: con dos o tres ya es suficiente para empezar.',
    'firstSigns.step': 'Paso {order}',

    'notice.babyPrecision':
      'Los primeros signos que haga el bebé serán imprecisos, igual que las primeras palabras. Es normal: lo reconocerás por el contexto.',
  },

  en: {
    'site.title': 'Petits Signes',
    'site.tagline': 'Learn signs to communicate with your baby before they can speak',
    'nav.catalogue': 'Catalogue',
    'nav.firstSigns': 'First signs',
    'nav.credits': 'Sources and credits',
    'nav.skipToContent': 'Skip to content',
    'nav.language': 'Language and sign language',
    'nav.home': 'Home',
    'nav.accessibility': 'Accessibility',

    'hero.title': 'Connect with your baby',
    'hero.titleAccent': 'long before their first word',
    'hero.lead': 'Real signs for everyday moments with your baby.',
    'hero.stat.signs': 'signs',
    'hero.stat.learned': 'learned',

    'search.label': 'Search for a sign',
    'search.placeholder': 'Search for a sign…',
    'search.clear': 'Clear the search',
    'search.noResults': 'No sign matches “{query}”.',
    'search.resultCount': '{count} signs',
    'search.resultCountOne': '1 sign',

    'filter.categories': 'Categories',
    'filter.all': 'All',
    'filter.firstSigns': 'First signs',
    'filter.favorites': 'Favourites',
    'filter.learned': 'Learned',
    'filter.pending': 'To learn',
    'filter.clear': 'Clear filters',

    'card.watchSign': 'Watch the sign',
    'card.addFavorite': 'Add to favourites',
    'card.removeFavorite': 'Remove from favourites',
    'card.markLearned': 'Mark as learned',
    'card.unmarkLearned': 'Mark as not learned',
    'card.noVideo': 'No video in {signLanguage}',
    'card.watchAtSource': 'Watch at {source}',
    'card.posterPending': 'We do not have the image for this sign yet',

    'signLanguage.label': 'Sign language',
    'signLanguage.lsc': 'LSC',
    'signLanguage.lse': 'LSE',
    'signLanguage.lscFull': 'Catalan Sign Language',
    'signLanguage.lseFull': 'Spanish Sign Language',

    'player.close': 'Close the video',
    'player.speedNormal': 'Normal speed',
    'player.speedSlow': 'Slow motion',
    'player.source': 'Source of this sign',

    'progress.export': 'Export progress',
    'progress.import': 'Import progress',
    'progress.reset': 'Reset progress',
    'progress.resetConfirm': 'Delete favourites and learned signs?',

    'firstSigns.title': 'First signs',
    'firstSigns.intro':
      'Twelve signs to start with, in the order that usually works best. You do not need all of them at once: two or three is enough to begin.',
    'firstSigns.step': 'Step {order}',

    'notice.babyPrecision':
      'The first signs your baby makes will be imprecise, just like first words. That is normal: you will recognise them from context.',
  },
} as const satisfies Record<Language, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)['ca'];

export type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

/** Replaces `{name}` placeholders. Missing values are left untouched. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function createTranslator(language: Language = DEFAULT_LANGUAGE): Translator {
  const dictionary = MESSAGES[language];
  return (key, values) => interpolate(dictionary[key], values);
}

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

export { MESSAGES };
