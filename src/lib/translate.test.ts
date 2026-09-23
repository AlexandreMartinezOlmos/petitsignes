import { describe, expect, it } from 'vitest';
import { interpolate, translatorFrom } from './translate.ts';

describe('interpolate', () => {
  it('fills every placeholder it has a value for', () => {
    expect(interpolate('{count} de {total}', { count: 3, total: 11 })).toBe('3 de 11');
  });

  it('leaves a placeholder untouched when no value is given', () => {
    expect(interpolate('{count} signes', {})).toBe('{count} signes');
    expect(interpolate('{count} signes')).toBe('{count} signes');
  });
});

describe('translatorFrom', () => {
  it('reads only the strings it was handed', () => {
    const t = translatorFrom({
      'player.close': 'Tanca el vídeo',
      'search.resultCount': '{count} signes',
    });

    expect(t('player.close')).toBe('Tanca el vídeo');
    expect(t('search.resultCount', { count: 5 })).toBe('5 signes');
  });
});
