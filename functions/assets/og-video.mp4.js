// Serves the link-preview video with byte-range support.
// *.pages.dev answers Range requests with a full 200, and iMessage / Safari
// want a 206 before they will play an MP4. This function reads the static
// file from the build output and answers Range, HEAD and plain GET itself.
// It only runs for this one path (Pages builds _routes.json from functions/).
export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const asset = await env.ASSETS.fetch(new Request(new URL(request.url), { method: 'GET' }));
  if (asset.status !== 200) return asset;
  const body = await asset.arrayBuffer();
  const total = body.byteLength;
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Cache-Control': 'public, max-age=86400',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
  });
  const etag = asset.headers.get('etag');
  if (etag) headers.set('ETag', etag);

  const range = request.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (range && !m) return unsatisfiable(headers, total);
  if (!m) {
    headers.set('Content-Length', String(total));
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
  }
  let start, end;
  if (m[1] === '') {
    // Suffix range: the last N bytes.
    const n = Number(m[2]);
    if (!n) return unsatisfiable(headers, total);
    start = Math.max(0, total - n);
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (start >= total || start > end) return unsatisfiable(headers, total);
  headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers });
}

function unsatisfiable(headers, total) {
  headers.set('Content-Range', `bytes */${total}`);
  return new Response(null, { status: 416, headers });
}
