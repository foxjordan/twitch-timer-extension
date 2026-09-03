import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAnalyticsScript } from './analyticsScript.js';

function innerScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'expected a <script> block');
  return m[1];
}

test('renderAnalyticsScript embeds the page name and the three helpers', () => {
  const html = renderAnalyticsScript({ page: 'sound-config' });
  assert.match(html, /window\.lsh/);
  assert.match(html, /'feature_view'/);
  assert.match(html, /'feature_use'/);
  assert.match(html, /'page_view'/);
  assert.match(html, /keepalive: true/);
  assert.match(html, /"sound-config"/);
});

test('the inline script is syntactically valid and defines lsh.{track,feature,use}', () => {
  const body = innerScript(renderAnalyticsScript({ page: 'home' }));
  const win = { lsh: undefined };
  // eslint-disable-next-line no-new-func
  new Function('window', 'fetch', body)(win, () => ({ catch() {} }));
  assert.equal(typeof win.lsh.track, 'function');
  assert.equal(typeof win.lsh.feature, 'function');
  assert.equal(typeof win.lsh.use, 'function');
});

test('no page name -> no page_view call is emitted', () => {
  const body = innerScript(renderAnalyticsScript({}));
  assert.doesNotMatch(body, /page_view/);
});

test('page name is length-capped', () => {
  const html = renderAnalyticsScript({ page: 'x'.repeat(200) });
  const m = html.match(/"(x+)"/);
  assert.ok(m && m[1].length === 60);
});
