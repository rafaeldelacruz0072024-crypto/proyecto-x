import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tempDirectory = await mkdtemp(join(tmpdir(), 'geminix-referral-test-'));
const compiledModule = join(tempDirectory, 'referral.mjs');

try {
  await build({
    entryPoints: ['src/lib/referral.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: compiledModule,
    logLevel: 'silent',
  });

  const referral = await import(`${pathToFileURL(compiledModule).href}?test=${Date.now()}`);
  const { buildReferralLink, normalizeReferralCode, readReferralContext } = referral;

  assert.equal(normalizeReferralCode('GK-NOVA-ROOT'), 'GK-NOVA-ROOT');
  assert.equal(normalizeReferralCode(' gk-nova-root '), 'GK-NOVA-ROOT');
  assert.equal(normalizeReferralCode('GK-NOVA_ROOT'), null);

  for (const side of [undefined, 'LEFT', 'RIGHT']) {
    const url = new URL(buildReferralLink('GK-NOVA-ROOT', side));
    assert.equal(url.origin, 'https://app.novacopy.digital');
    assert.equal(url.pathname, '/login');
    assert.equal(url.searchParams.get('action'), 'register');
    assert.equal(url.searchParams.get('side'), side ?? null);
    assert.deepEqual(readReferralContext(url.search), { code: 'GK-NOVA-ROOT', side: side ?? 'LEFT' });
  }

  const scenarios = [
    { name: 'raíz sin lado', search: '?ref=GK-NOVA-ROOT', expected: { code: 'GK-NOVA-ROOT', side: 'LEFT' } },
    { name: 'binario izquierdo', search: '?ref=GK-NOVA-ROOT&binary=LEFT', expected: { code: 'GK-NOVA-ROOT', side: 'LEFT' } },
    { name: 'binario derecho', search: '?ref=GK-NOVA-ROOT&binary=RIGHT', expected: { code: 'GK-NOVA-ROOT', side: 'RIGHT' } },
    { name: 'aliases legado', search: '?sponsor=GK-NOVA-ROOT&position=RIGHT', expected: { code: 'GK-NOVA-ROOT', side: 'RIGHT' } },
  ];

  for (const scenario of scenarios) {
    assert.deepEqual(readReferralContext(scenario.search), scenario.expected, scenario.name);
  }

  assert.deepEqual(readReferralContext('', 'GK-NOVA-ROOT', 'RIGHT'), { code: 'GK-NOVA-ROOT', side: 'RIGHT' }, 'persistencia');
  console.log(`PASS: ${scenarios.length + 7} pruebas automatizadas del flujo de referidos`);
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
