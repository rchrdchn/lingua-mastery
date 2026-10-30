// Outbound link tagging (standing rule, Oct 29 2026). Pure functions, safe in Node and in a browser bundle.
// Every external <a>/<area> href gets utm_source=<this site's domain>&utm_medium=referral, so the
// sites we send readers to see us in their analytics. scripts/tag-outbound.mjs runs tagHtml over the built
// HTML after every build, so new pages are covered with no per-link edits. Keep this file identical
// across the sites (racesnear, howtowatchsoccerusa, howtowatchnba, cantonese-soups, founders-library,
// hexkey, lingua-mastery, portfolio-react).
//
// Not tagged: internal links (relative paths, this site's own hosts), mailto:/tel:/javascript: and
// other non-http links, links that already carry any utm_ parameter, affiliate or payment links
// (Amazon/amzn.to, any tag= or RunSignup aflt_token= parameter, Awin, Impact, ShareASale, CJ, Rakuten, Skimlinks,
// buy.stripe.com, beehiiv), share/compose/calendar action links (X intent, Facebook sharer, WhatsApp,
// Gmail/Outlook compose, Google Calendar...), and any <a> with a data-no-utm attribute.
// Only the href value changes; rel, target and every other attribute stay as they were.

// Hosts (or parent domains) whose links must never be changed: tracked affiliate and payment links.
export const SKIP_DOMAINS = [
  // Amazon Associates
  'amazon.com', 'amazon.ca', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it',
  'amazon.co.jp', 'amazon.com.au', 'amazon.com.mx', 'amazon.in', 'amzn.to', 'amzn.com', 'a.co',
  // Awin
  'awin1.com', 'awin.com', 'zenaps.com',
  // Impact (shared tracking hosts; brands also use vanity hosts, caught by the query check below)
  'impact.com', 'sjv.io', 'pxf.io', 'ojrq.net', 'evyy.net', 'ftjcfx.com', '7eer.net', 'r.ftjcfx.com',
  // ShareASale
  'shareasale.com', 'shrsl.com',
  // CJ
  'anrdoezrs.net', 'jdoqocy.com', 'tkqlhce.com', 'dpbolvw.net', 'kqzyfj.com', 'emjcd.com', 'qksrv.net', 'apmebf.com',
  // Rakuten / LinkShare
  'linksynergy.com', 'click.linksynergy.com',
  // Skimlinks
  'skimresources.com', 'redirectingat.com',
  // Stripe payment links and checkout
  'buy.stripe.com', 'checkout.stripe.com',
  // beehiiv subscribe pages and embeds
  'beehiiv.com',
];

// Share, compose and add-to-calendar endpoints: these are actions, not referrals, so leave them.
// [host (or parent domain), path prefix]
export const SKIP_ACTIONS = [
  ['x.com', '/intent'], ['twitter.com', '/intent'], ['x.com', '/share'], ['twitter.com', '/share'],
  ['facebook.com', '/sharer'], ['facebook.com', '/dialog'], ['wa.me', '/'], ['api.whatsapp.com', '/send'],
  ['linkedin.com', '/sharing'], ['linkedin.com', '/shareArticle'], ['reddit.com', '/submit'],
  ['pinterest.com', '/pin/create'], ['t.me', '/share'], ['bsky.app', '/intent'], ['threads.net', '/intent'],
  ['news.ycombinator.com', '/submitlink'], ['mail.google.com', '/'], ['outlook.office.com', '/'],
  ['outlook.live.com', '/'], ['calendar.google.com', '/'],
];

// Query parameters that mark a link as affiliate-tracked (aflt_token = RunSignup affiliate links).
const AFFILIATE_PARAMS = /[?&](tag|affid|aff_id|affiliate_id|aff|irgwc|irclickid|clickref|subid|sub_id|ascsubtag|aflt_token)=/i;

function hostMatches(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

// Hosts that count as "this site": the canonical host, www., and any aliases passed in.
function selfHosts(site, aliases = []) {
  const base = site.replace(/^www\./, '');
  return new Set([base, 'www.' + base, ...aliases]);
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&#x26;/gi, '&');

// Raw URL in (not HTML-escaped), tagged raw URL out, or null when the link must be left alone.
// Use this for URLs that end up in JSON or JS; use tagHref for href values taken from HTML.
export function tagUrl(href, { site, aliases = [] }) {
  href = String(href).trim();
  let url;
  if (/^https?:\/\//i.test(href)) url = href;
  else if (href.startsWith('//')) url = 'https:' + href;
  else return null; // relative, #anchor, mailto:, tel:, javascript:, data: ...
  let host;
  let path;
  try { const u = new URL(url); host = u.hostname.toLowerCase(); path = u.pathname; } catch { return null; }
  if (selfHosts(site, aliases).has(host)) return null;
  if (SKIP_DOMAINS.some((d) => hostMatches(host, d))) return null;
  if (SKIP_ACTIONS.some(([d, pre]) => hostMatches(host, d) && path.startsWith(pre))) return null;
  const hashAt = href.indexOf('#');
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : href.slice(hashAt);
  if (/[?&]utm_[a-z]+=/i.test(beforeHash)) return null;
  if (AFFILIATE_PARAMS.test(beforeHash)) return null;
  const base = site.replace(/^www\./, '');
  const sep = beforeHash.includes('?') ? (/[?&]$/.test(beforeHash) ? '' : '&') : '?';
  return `${beforeHash}${sep}utm_source=${base}&utm_medium=referral${hash}`;
}

// Same, but for an href value as written in HTML (&amp; escaped). Returns HTML-escaped, or null.
export function tagHref(rawHref, opts) {
  const out = tagUrl(decode(rawHref), opts);
  return out == null ? null : out.replace(/&(?!amp;|#38;|#x26;)/gi, '&amp;');
}

// Matches an <a ...> or <area ...> start tag.
const TAG_RE = /<(a|area)\b([^>]*)>/gi;
const HREF_RE = /(\shref\s*=\s*)("([^"]*)"|'([^']*)')/i;

export function tagHtml(html, opts) {
  let count = 0;
  // Leave <script>, <style>, <template>, <textarea> and comment bodies alone.
  const parts = html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<textarea\b[\s\S]*?<\/textarea>|<!--[\s\S]*?-->)/i);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(TAG_RE, (whole, name, attrs) => {
      if (/\sdata-no-utm\b/i.test(attrs)) return whole;
      const m = attrs.match(HREF_RE);
      if (!m) return whole;
      const raw = m[3] ?? m[4];
      const next = tagHref(raw, opts);
      if (next == null) return whole;
      count++;
      const q = m[3] != null ? '"' : "'";
      return `<${name}${attrs.replace(HREF_RE, `$1${q}${next.replace(/\$/g, '$$$$')}${q}`)}>`;
    });
  }
  return { html: parts.join(''), count };
}

