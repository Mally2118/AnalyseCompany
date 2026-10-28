import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
it('не изменяет проверенный market.json и raw-историю при отказе внешнего источника', () => {
  const snapshot = readFileSync(new URL('../public/data/market.json', import.meta.url)),
    raw = readFileSync(new URL('../public/data/raw/T.json', import.meta.url));
  const result = spawnSync(
    process.execPath,
    ['--import', './tests/fixtures/reject-fetch.mjs', 'scripts/update-market.mjs', '--accept'],
    { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 15000 },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Обновление отклонено');
  expect(
    readFileSync(new URL('../public/data/market.json', import.meta.url)).equals(snapshot),
  ).toBe(true);
  expect(readFileSync(new URL('../public/data/raw/T.json', import.meta.url)).equals(raw)).toBe(
    true,
  );
}, 16000);
