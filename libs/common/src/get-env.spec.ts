import { getEnv } from './get-env';

describe('getEnv', () => {
  const saved = process.env;

  beforeEach(() => {
    process.env = { ...saved };
    delete process.env.SOME_VAR;
  });

  afterAll(() => {
    process.env = saved;
  });

  it('returns the value when the variable is set', () => {
    process.env.SOME_VAR = 'value';
    expect(getEnv('SOME_VAR')).toBe('value');
  });

  it('throws naming the variable when it is missing', () => {
    expect(() => getEnv('SOME_VAR')).toThrow(
      'Missing required environment variable: SOME_VAR',
    );
  });

  it('treats an empty value as missing', () => {
    process.env.SOME_VAR = '';
    expect(() => getEnv('SOME_VAR')).toThrow('SOME_VAR');
  });

  it('returns the fallback when the variable is missing or empty', () => {
    expect(getEnv('SOME_VAR', 'dflt')).toBe('dflt');
    process.env.SOME_VAR = '';
    expect(getEnv('SOME_VAR', 'dflt')).toBe('dflt');
  });

  it('prefers the value over the fallback', () => {
    process.env.SOME_VAR = 'value';
    expect(getEnv('SOME_VAR', 'dflt')).toBe('value');
  });
});
