import { safeDecodeURIComponent, withReturnTo, enterPokemonDetail } from '../lib/navigation';

describe('safeDecodeURIComponent', () => {
  it('decodes a normally-encoded string', () => {
    expect(safeDecodeURIComponent('%2Fpokedex')).toBe('/pokedex');
  });

  it('falls back to the raw value on a malformed percent-encoding', () => {
    expect(safeDecodeURIComponent('%')).toBe('%');
    expect(safeDecodeURIComponent('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('withReturnTo', () => {
  it('appends ?from= when the href has no existing query string', () => {
    expect(withReturnTo('/pokedex', '/dashboard')).toBe('/pokedex?from=%2Fdashboard');
  });

  it('appends &from= when the href already has a query string', () => {
    expect(withReturnTo('/pokedex?wishes=1', '/dashboard')).toBe('/pokedex?wishes=1&from=%2Fdashboard');
  });

  it('encodes special characters in the from value', () => {
    expect(withReturnTo('/pokemon/1', '/pokedex?type=grass&gen=1')).toBe(
      '/pokemon/1?from=%2Fpokedex%3Ftype%3Dgrass%26gen%3D1',
    );
  });
});

describe('enterPokemonDetail', () => {
  it('pushes href?from= when the href has no existing query string', () => {
    const router = { push: jest.fn() };
    enterPokemonDetail(router as never, '/pokemon/1', '/dashboard');
    expect(router.push).toHaveBeenCalledWith('/pokemon/1?from=%2Fdashboard');
  });

  it('pushes href&from= when the href already has a query string', () => {
    const router = { push: jest.fn() };
    enterPokemonDetail(router as never, '/pokemon/1?wishes=1', '/dashboard');
    expect(router.push).toHaveBeenCalledWith('/pokemon/1?wishes=1&from=%2Fdashboard');
  });
});
