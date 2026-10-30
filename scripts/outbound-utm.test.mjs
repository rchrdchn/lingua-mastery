// node --test: outbound link tagging rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tagHref, tagHtml, tagUrl } from './outbound-utm.mjs';

const o = { site: 'racesnear.com', aliases: ['racesnear.pages.dev'] };
const T = 'utm_source=racesnear.com&amp;utm_medium=referral';

test('tags a plain external link', () => {
  assert.equal(tagHref('https://example.com/race', o), `https://example.com/race?${T}`);
});
test('keeps an existing query string and #fragment', () => {
  assert.equal(tagHref('https://example.com/r?id=5&amp;x=1#reg', o), `https://example.com/r?id=5&amp;x=1&amp;${T}#reg`);
  assert.equal(tagHref('https://example.com/#top', o), `https://example.com/?${T}#top`);
});
test('protocol-relative links are external', () => {
  assert.equal(tagHref('//example.com/a', o), `//example.com/a?${T}`);
});
test('leaves internal, non-http and already-tagged links', () => {
  for (const h of ['/boston/', 'boston/', '#faq', '?q=1', 'https://racesnear.com/x', 'https://www.racesnear.com/',
    'https://racesnear.pages.dev/a', 'mailto:hello@racesnear.com', 'tel:+15555550100', 'javascript:void(0)',
    'https://example.com/?utm_source=newsletter', 'https://example.com/?a=1&amp;utm_campaign=x']) {
    assert.equal(tagHref(h, o), null, h);
  }
});
test('leaves affiliate and payment links', () => {
  for (const h of ['https://www.amazon.com/dp/B00?tag=x-20', 'https://amzn.to/abc', 'https://www.awin1.com/cread.php?a=1',
    'https://goto.target.com/c/1/2/3?u=x&amp;irgwc=1', 'https://example.sjv.io/c/1', 'https://shareasale.com/r.cfm?b=1',
    'https://www.anrdoezrs.net/click-1', 'https://go.skimresources.com/?id=1', 'https://buy.stripe.com/abc',
    'https://howtowatch.beehiiv.com/subscribe', 'https://embeds.beehiiv.com/x', 'https://shop.example.com/p?tag=me-20', 'https://runsignup.com/Race/MA/Boston/X?aflt_token=abc']) {
    assert.equal(tagHref(h, o), null, h);
  }
});
test('links to our other sites are tagged', () => {
  assert.equal(tagHref('https://howtowatchnba.com/', o), `https://howtowatchnba.com/?${T}`);
});
test('html: only href changes; rel, target and other tags are kept', () => {
  const src = `<a class="b" href="https://example.com/x" rel="sponsored noopener" target="_blank">Go</a>`
    + `<link rel="preconnect" href="https://fonts.example.com"><a data-no-utm href="https://example.com/y">n</a>`
    + `<script>const s = '<a href="https://example.com/z">';</script><area href='https://maps.example.com/m'>`;
  const { html, count } = tagHtml(src, o);
  assert.equal(count, 2);
  assert.ok(html.includes(`<a class="b" href="https://example.com/x?${T}" rel="sponsored noopener" target="_blank">`));
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.example.com">'));
  assert.ok(html.includes('<a data-no-utm href="https://example.com/y">'));
  assert.ok(html.includes(`'<a href="https://example.com/z">'`));
  assert.ok(html.includes(`<area href='https://maps.example.com/m?${T}'>`));
});
test('running twice changes nothing more', () => {
  const once = tagHtml('<a href="https://example.com/">x</a>', o).html;
  assert.equal(tagHtml(once, o).count, 0);
});
test('leaves share, compose and calendar links', () => {
  for (const h of ['https://x.com/intent/tweet?text=a', 'https://twitter.com/intent/tweet?url=b', 'https://www.facebook.com/sharer/sharer.php?u=c',
    'https://wa.me/?text=d', 'https://mail.google.com/mail/?view=cm&amp;to=e', 'https://outlook.office.com/mail/deeplink/compose?to=f',
    'https://calendar.google.com/calendar/render?action=TEMPLATE', 'https://www.linkedin.com/sharing/share-offsite/?url=g']) {
    assert.equal(tagHref(h, o), null, h);
  }
  assert.equal(tagHref('https://x.com/racesnear', o), `https://x.com/racesnear?${T}`);
});
test('tagUrl works on raw URLs for JSON/JS', () => {
  assert.equal(tagUrl('https://example.com/a?b=1&c=2#d', o), 'https://example.com/a?b=1&c=2&utm_source=racesnear.com&utm_medium=referral#d');
  assert.equal(tagUrl('/boston/', o), null);
});
