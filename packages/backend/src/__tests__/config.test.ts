import { describe, expect, it, beforeEach } from 'vitest';
import { _resetConfigForTests, loadConfig } from '../config.js';

describe('config', () => {
  beforeEach(() => _resetConfigForTests());

  it('applies sensible defaults when env is empty', () => {
    const cfg = loadConfig({});
    expect(cfg.PORT).toBe(8080);
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.LL2_BASE).toBe('https://lldev.thespacedevs.com/2.3.0');
    expect(cfg.features.openWeather).toBe(false);
    expect(cfg.features.windy).toBe(false);
    expect(cfg.features.telegramBot).toBe(false);
  });

  it('enables telegram only when BOTH token and chat id are set', () => {
    expect(loadConfig({ TELEGRAM_BOT_TOKEN: 'x' }).features.telegramBot).toBe(false);
    _resetConfigForTests();
    expect(loadConfig({ TELEGRAM_CHAT_ID: 'y' }).features.telegramBot).toBe(false);
    _resetConfigForTests();
    expect(
      loadConfig({ TELEGRAM_BOT_TOKEN: 'x', TELEGRAM_CHAT_ID: 'y' }).features.telegramBot,
    ).toBe(true);
  });

  it('enables OWM/Windy only when key is non-empty', () => {
    const cfg = loadConfig({ OPENWEATHER_KEY: 'abc', WINDY_KEY: '' });
    expect(cfg.features.openWeather).toBe(true);
    expect(cfg.features.windy).toBe(false);
  });

  it('rejects an invalid LL2 base URL', () => {
    expect(() => loadConfig({ LL2_BASE: 'not-a-url' })).toThrow(/Invalid environment/);
  });
});
