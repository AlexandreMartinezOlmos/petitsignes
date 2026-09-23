import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as PlayRequestModule from './play-request.ts';
import type { PlayRequest } from './play-request.ts';

// The module keeps one listener and one pending request for the whole page,
// so every test gets a fresh copy of it rather than inheriting the last one's.
let channel: typeof PlayRequestModule;

beforeEach(async () => {
  vi.resetModules();
  channel = await import('./play-request.ts');
});

function request(signId: string): PlayRequest {
  return channel.readPlayRequest({ dataset: { label: signId } }, signId);
}

describe('a tap before the dialog is ready', () => {
  it('is delivered when the dialog subscribes, instead of being lost', () => {
    channel.requestPlay(request('llet'));

    const listener = vi.fn();
    channel.onPlayRequest(listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ signId: 'llet' }));
  });

  it('opens the player once, on the last sign tapped', () => {
    channel.requestPlay(request('llet'));
    channel.requestPlay(request('aigua'));

    const listener = vi.fn();
    channel.onPlayRequest(listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ signId: 'aigua' }));
  });

  it('is delivered exactly once, not replayed to whoever subscribes next', () => {
    channel.requestPlay(request('llet'));

    const first = vi.fn();
    const unsubscribe = channel.onPlayRequest(first);
    unsubscribe();

    const second = vi.fn();
    channel.onPlayRequest(second);

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
});

describe('a tap once the dialog is ready', () => {
  it('is delivered straight away, and nothing is left waiting', () => {
    const listener = vi.fn();
    const unsubscribe = channel.onPlayRequest(listener);

    channel.requestPlay(request('llet'));
    expect(listener).toHaveBeenCalledOnce();

    // Had it also been kept, the next subscriber would replay it.
    unsubscribe();
    const next = vi.fn();
    channel.onPlayRequest(next);
    expect(next).not.toHaveBeenCalled();
  });

  it('waits again after the dialog unsubscribes', () => {
    const gone = vi.fn();
    channel.onPlayRequest(gone)();

    channel.requestPlay(request('llet'));
    expect(gone).not.toHaveBeenCalled();

    const back = vi.fn();
    channel.onPlayRequest(back);
    expect(back).toHaveBeenCalledOnce();
  });

  it('reaches only the latest subscriber, so one tap never opens two players', () => {
    const replaced = vi.fn();
    const unsubscribeReplaced = channel.onPlayRequest(replaced);
    const current = vi.fn();
    channel.onPlayRequest(current);

    // A stale unsubscribe must not silence the dialog that replaced it.
    unsubscribeReplaced();
    channel.requestPlay(request('llet'));

    expect(replaced).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledOnce();
  });
});

describe('readPlayRequest', () => {
  it('carries everything the dialog shows from the button that asked', () => {
    const dataset = {
      label: 'llet',
      videoUrl: 'https://www.youtube.com/watch?v=abc',
      source: 'Vocabulari bàsic',
      sourceUrl: 'https://example.org/llet',
    };

    expect(channel.readPlayRequest({ dataset }, 'leche')).toEqual({ signId: 'leche', ...dataset });
  });

  it('falls back to the id for the name, and to empty strings elsewhere', () => {
    expect(channel.readPlayRequest({ dataset: {} }, 'leche')).toEqual({
      signId: 'leche',
      label: 'leche',
      videoUrl: '',
      source: '',
      sourceUrl: '',
    });
  });
});
