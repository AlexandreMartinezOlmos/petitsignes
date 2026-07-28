/**
 * Interface translations.
 *
 * The routing side of i18n (`/ca`, `/es`, `/en`) is Phase 2, but every string
 * already goes through this module so that adding the routes later is a change
 * to pages only — not to every component.
 *
 * This is the TEXT axis. It is unrelated to the sign language of the videos.
 */

import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './types.ts';

const MESSAGES = {
  ca: {
    'site.title': 'Petits Signes',
    'site.tagline': 'Aprèn signes per comunicar-te amb el teu nadó abans que parli',
    'nav.credits': 'Fonts i crèdits',
    'nav.skipToContent': 'Vés al contingut',
    'nav.language': 'Idioma i llengua de signes',
    'nav.accessibility': 'Accessibilitat',
    'nav.about': 'El projecte',
    'nav.sourceCode': 'Codi font',
    'nav.footer': 'Peu de pàgina',
    'nav.site': 'Pàgines del lloc',
    'nav.skipCatalogue': 'Salta el catàleg',
    'nav.catalogue': 'Catàleg',

    'notFound.title': 'Aquí no hi ha res',
    'notFound.lead':
      'Aquesta pàgina no existeix o ha canviat d’adreça. Ja que hi ets, aquest signe et pot servir.',
    'notFound.back': 'Torna al catàleg',
    'nav.breadcrumb': 'On ets',
    'nav.onThisPage': 'En aquesta pàgina',

    'hero.title': "Comunica't amb el teu nadó",
    'hero.titleAccent': 'molt abans de la primera paraula',
    'hero.lead': 'Signes reals de la llengua de signes catalana per al dia a dia amb el teu nadó.',

    'search.label': 'Cerca un signe',
    'search.placeholder': 'Cerca un signe…',
    'search.clear': 'Esborra la cerca',
    'search.resultCount': '{count} signes',
    'search.resultCountOne': '1 signe',
    'search.scopeAll': 'tot el catàleg',
    'search.scopeSearch': 'cerca «{query}», a tot el catàleg',

    'empty.search.title': 'Cap signe per «{query}»',
    'empty.search.hint': 'Prova amb una altra paraula o mira totes les categories.',
    'empty.favorites.title': 'Encara no tens preferits',
    'empty.favorites.hint': 'Toca el cor d’una targeta per desar-la aquí i tenir-la a mà.',
    'empty.learned.title': 'Encara no has après cap signe',
    'empty.learned.hint': 'Marca’ls com a apresos a mesura que els vagis fent servir amb el nadó.',
    'empty.pending.title': 'Ho tens tot après!',
    'empty.pending.hint': 'No et queda cap signe pendent. Quin crac.',
    'empty.generic.title': 'Cap signe aquí',
    'empty.generic.hint': 'Prova de treure algun filtre.',

    'filter.categories': 'Filtra per categoria',
    'filter.status': 'Filtra pel teu progrés',
    'filter.all': 'Tots',
    'filter.firstSigns': 'Primers signes',
    'filter.favorites': 'Preferits',
    'filter.learned': 'Apresos',
    'filter.pending': 'Pendents',
    'filter.clear': 'Treu els filtres',
    'filter.showCategories': '+{count} més',
    'filter.showCategoriesLabel': '+{count} més: mostra totes les categories',
    'filter.hideCategories': 'Amaga les categories',
    'filter.searchScope': 'La cerca mira tot el catàleg, no la categoria triada.',

    'card.watchSign': 'Veure el signe',
    'card.addFavorite': 'Afegeix a preferits',
    'card.removeFavorite': 'Treu de preferits',
    'card.markLearned': 'Marca com a après',
    'card.unmarkLearned': 'Marca com a no après',
    'card.noVideo': 'Sense vídeo en {signLanguage}',
    'card.watchAtSource': 'Veure a {source}',
    'card.posterPending': 'Encara no tenim la imatge d’aquest signe',

    'signLanguage.lsc': 'LSC',
    'signLanguage.lse': 'LSE',
    'signLanguage.lscFull': 'Llengua de Signes Catalana',
    'signLanguage.lseFull': 'Llengua de Signes Espanyola',

    'player.close': 'Tanca el vídeo',
    'player.speed': 'Velocitat de reproducció',
    'player.speedNormal': 'Velocitat normal',
    'player.speedSlow': 'Càmera lenta',
    'player.source': 'Font d’aquest signe',
    'player.unavailable':
      'No hem pogut carregar el reproductor. Pot ser una extensió del navegador o la connexió: el signe també es pot veure al lloc original.',

    'progress.title': 'Les teves dades',
    'progress.intro':
      'El teu progrés es desa només en aquest navegador: no hi ha comptes ni servidor. Si canvies de dispositiu o esborres les dades del navegador, es perd. Amb aquests botons te’l pots endur.',
    'progress.favoritesCount': '{count} preferits',
    'progress.favoritesCountOne': '1 preferit',
    'progress.learnedCount': '{count} signes apresos',
    'progress.learnedCountOne': '1 signe après',
    'progress.export': 'Exporta el progrés',
    'progress.exportHint': 'Descarrega un fitxer JSON amb els teus preferits i signes apresos.',
    'progress.import': 'Importa el progrés',
    'progress.importHint':
      'Tria un fitxer exportat abans. Substituirà el progrés d’aquest navegador.',
    'progress.imported': 'Progrés importat: {summary}.',
    'progress.importError': 'Aquest fitxer no sembla una exportació de Petits Signes.',
    'progress.reset': 'Reinicia el progrés',
    'progress.resetHint':
      'Esborra preferits i signes apresos d’aquest navegador. No es pot desfer.',
    'progress.resetDone': 'S’ha esborrat el progrés d’aquest navegador.',
    'progress.resetConfirm': 'Segur que vols esborrar preferits i signes apresos?',
  },

  es: {
    'site.title': 'Petits Signes',
    'site.tagline': 'Aprende signos para comunicarte con tu bebé antes de que hable',
    'nav.credits': 'Fuentes y créditos',
    'nav.skipToContent': 'Ir al contenido',
    'nav.language': 'Idioma y lengua de signos',
    'nav.accessibility': 'Accesibilidad',
    'nav.about': 'El proyecto',
    'nav.sourceCode': 'Código fuente',
    'nav.footer': 'Pie de página',
    'nav.site': 'Páginas del sitio',
    'nav.skipCatalogue': 'Saltar el catálogo',
    'nav.catalogue': 'Catálogo',

    'notFound.title': 'Aquí no hay nada',
    'notFound.lead':
      'Esta página no existe o ha cambiado de dirección. Ya que estás, este signo te puede servir.',
    'notFound.back': 'Vuelve al catálogo',
    'nav.breadcrumb': 'Dónde estás',
    'nav.onThisPage': 'En esta página',

    'hero.title': 'Comunícate con tu bebé',
    'hero.titleAccent': 'mucho antes de la primera palabra',
    'hero.lead': 'Signos reales de la lengua de signos española para el día a día con tu bebé.',

    'search.label': 'Buscar un signo',
    'search.placeholder': 'Buscar un signo…',
    'search.clear': 'Borrar la búsqueda',
    'search.resultCount': '{count} signos',
    'search.resultCountOne': '1 signo',
    'search.scopeAll': 'todo el catálogo',
    'search.scopeSearch': 'búsqueda «{query}», en todo el catálogo',

    'empty.search.title': 'Ningún signo para «{query}»',
    'empty.search.hint': 'Prueba con otra palabra o mira todas las categorías.',
    'empty.favorites.title': 'Aún no tienes favoritos',
    'empty.favorites.hint': 'Toca el corazón de una tarjeta para guardarla aquí y tenerla a mano.',
    'empty.learned.title': 'Aún no has aprendido ningún signo',
    'empty.learned.hint': 'Márcalos como aprendidos a medida que los vayas usando con el bebé.',
    'empty.pending.title': '¡Lo tienes todo aprendido!',
    'empty.pending.hint': 'No te queda ningún signo pendiente. Qué crack.',
    'empty.generic.title': 'Ningún signo aquí',
    'empty.generic.hint': 'Prueba a quitar algún filtro.',

    'filter.categories': 'Filtrar por categoría',
    'filter.status': 'Filtrar por tu progreso',
    'filter.all': 'Todos',
    'filter.firstSigns': 'Primeros signos',
    'filter.favorites': 'Favoritos',
    'filter.learned': 'Aprendidos',
    'filter.pending': 'Pendientes',
    'filter.clear': 'Quitar los filtros',
    'filter.showCategories': '+{count} más',
    'filter.showCategoriesLabel': '+{count} más: mostrar todas las categorías',
    'filter.hideCategories': 'Ocultar las categorías',
    'filter.searchScope': 'La búsqueda mira todo el catálogo, no la categoría elegida.',

    'card.watchSign': 'Ver el signo',
    'card.addFavorite': 'Añadir a favoritos',
    'card.removeFavorite': 'Quitar de favoritos',
    'card.markLearned': 'Marcar como aprendido',
    'card.unmarkLearned': 'Marcar como no aprendido',
    'card.noVideo': 'Sin vídeo en {signLanguage}',
    'card.watchAtSource': 'Ver en {source}',
    'card.posterPending': 'Todavía no tenemos la imagen de este signo',

    'signLanguage.lsc': 'LSC',
    'signLanguage.lse': 'LSE',
    'signLanguage.lscFull': 'Lengua de Signos Catalana',
    'signLanguage.lseFull': 'Lengua de Signos Española',

    'player.close': 'Cerrar el vídeo',
    'player.speed': 'Velocidad de reproducción',
    'player.speedNormal': 'Velocidad normal',
    'player.speedSlow': 'Cámara lenta',
    'player.source': 'Fuente de este signo',
    'player.unavailable':
      'No hemos podido cargar el reproductor. Puede ser una extensión del navegador o la conexión: el signo también se puede ver en el sitio original.',

    'progress.title': 'Tus datos',
    'progress.intro':
      'Tu progreso se guarda solo en este navegador: no hay cuentas ni servidor. Si cambias de dispositivo o borras los datos del navegador, se pierde. Con estos botones puedes llevártelo.',
    'progress.favoritesCount': '{count} favoritos',
    'progress.favoritesCountOne': '1 favorito',
    'progress.learnedCount': '{count} signos aprendidos',
    'progress.learnedCountOne': '1 signo aprendido',
    'progress.export': 'Exportar el progreso',
    'progress.exportHint': 'Descarga un archivo JSON con tus favoritos y signos aprendidos.',
    'progress.import': 'Importar el progreso',
    'progress.importHint':
      'Elige un archivo exportado antes. Sustituirá el progreso de este navegador.',
    'progress.imported': 'Progreso importado: {summary}.',
    'progress.importError': 'Este archivo no parece una exportación de Petits Signes.',
    'progress.reset': 'Reiniciar el progreso',
    'progress.resetHint':
      'Borra favoritos y signos aprendidos de este navegador. No se puede deshacer.',
    'progress.resetDone': 'Se ha borrado el progreso de este navegador.',
    'progress.resetConfirm': '¿Seguro que quieres borrar favoritos y signos aprendidos?',
  },

  en: {
    'site.title': 'Petits Signes',
    'site.tagline': 'Learn signs to communicate with your baby before they can speak',
    'nav.credits': 'Sources and credits',
    'nav.skipToContent': 'Skip to content',
    'nav.language': 'Language and sign language',
    'nav.accessibility': 'Accessibility',
    'nav.about': 'The project',
    'nav.sourceCode': 'Source code',
    'nav.footer': 'Footer',
    'nav.site': 'Site pages',
    'nav.skipCatalogue': 'Skip the catalogue',
    'nav.catalogue': 'Catalogue',

    'notFound.title': 'Nothing here',
    'notFound.lead':
      'This page does not exist, or it moved. While you are here, this sign might come in handy.',
    'notFound.back': 'Back to the catalogue',
    'nav.breadcrumb': 'Breadcrumb',
    'nav.onThisPage': 'On this page',

    'hero.title': 'Connect with your baby',
    'hero.titleAccent': 'long before their first word',
    'hero.lead': 'Real signs for everyday moments with your baby.',

    'search.label': 'Search for a sign',
    'search.placeholder': 'Search for a sign…',
    'search.clear': 'Clear the search',
    'search.resultCount': '{count} signs',
    'search.resultCountOne': '1 sign',
    'search.scopeAll': 'the whole catalogue',
    'search.scopeSearch': 'search “{query}”, across the whole catalogue',

    'empty.search.title': 'No signs for “{query}”',
    'empty.search.hint': 'Try another word or browse the categories.',
    'empty.favorites.title': 'No favourites yet',
    'empty.favorites.hint': 'Tap the heart on a card to keep it here.',
    'empty.learned.title': 'Nothing learned yet',
    'empty.learned.hint': 'Mark signs as learned as you start using them with your baby.',
    'empty.pending.title': 'You’ve learned them all!',
    'empty.pending.hint': 'Nothing left to learn. Nice.',
    'empty.generic.title': 'No signs here',
    'empty.generic.hint': 'Try clearing a filter.',

    'filter.categories': 'Filter by category',
    'filter.status': 'Filter by your progress',
    'filter.all': 'All',
    'filter.firstSigns': 'First signs',
    'filter.favorites': 'Favourites',
    'filter.learned': 'Learned',
    'filter.pending': 'To learn',
    'filter.clear': 'Clear filters',
    'filter.showCategories': '+{count} more',
    'filter.showCategoriesLabel': '+{count} more: show all categories',
    'filter.hideCategories': 'Hide categories',
    'filter.searchScope': 'Search looks at the whole catalogue, not the chosen category.',

    'card.watchSign': 'Watch the sign',
    'card.addFavorite': 'Add to favourites',
    'card.removeFavorite': 'Remove from favourites',
    'card.markLearned': 'Mark as learned',
    'card.unmarkLearned': 'Mark as not learned',
    'card.noVideo': 'No video in {signLanguage}',
    'card.watchAtSource': 'Watch at {source}',
    'card.posterPending': 'We do not have the image for this sign yet',

    'signLanguage.lsc': 'LSC',
    'signLanguage.lse': 'LSE',
    'signLanguage.lscFull': 'Catalan Sign Language',
    'signLanguage.lseFull': 'Spanish Sign Language',

    'player.close': 'Close the video',
    'player.speed': 'Playback speed',
    'player.speedNormal': 'Normal speed',
    'player.speedSlow': 'Slow motion',
    'player.source': 'Source of this sign',
    'player.unavailable':
      'The player could not be loaded. It may be a browser extension or the connection: the sign can also be watched at its original site.',

    'progress.title': 'Your data',
    'progress.intro':
      'Your progress is stored in this browser only: there are no accounts and no server. Change device or clear your browser data and it is gone. These buttons let you take it with you.',
    'progress.favoritesCount': '{count} favourites',
    'progress.favoritesCountOne': '1 favourite',
    'progress.learnedCount': '{count} learned signs',
    'progress.learnedCountOne': '1 learned sign',
    'progress.export': 'Export progress',
    'progress.exportHint': 'Downloads a JSON file with your favourites and learned signs.',
    'progress.import': 'Import progress',
    'progress.importHint':
      'Pick a file you exported earlier. It replaces the progress in this browser.',
    'progress.imported': 'Progress imported: {summary}.',
    'progress.importError': 'This file does not look like a Petits Signes export.',
    'progress.reset': 'Reset progress',
    'progress.resetHint':
      'Deletes favourites and learned signs from this browser. This cannot be undone.',
    'progress.resetDone': 'The progress in this browser has been deleted.',
    'progress.resetConfirm': 'Delete favourites and learned signs?',
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
