// Audio credits summary for the credits page (from data/audio/credits.json, written by scripts/audio/build.py).
const fs = require('node:fs');
const path = require('node:path');
module.exports = function () {
  let c = {}; try { c = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/audio/credits.json'), 'utf8')); } catch { /* not generated yet */ }
  const NAMES = { zh: 'Mandarin', es: 'Spanish', en: 'English', fr: 'French', it: 'Italian', pt: 'Portuguese', de: 'German' };
  return ['zh', 'es', 'en', 'fr', 'it', 'pt', 'de'].filter(id => c[id]).map(id => ({
    id, name: NAMES[id], tts: c[id].tts, llClips: c[id].ll.clips,
    speakers: Object.entries(c[id].ll.speakers).map(([name, v]) => ({ name, n: v.n, licenses: v.licenses.join(', ') })),
    sentClips: c[id].sentences?.clips || 0,
    sentSpeakers: Object.entries(c[id].sentences?.speakers || {}).map(([k, n]) => { const [name, license, url] = k.split('|'); return { name, license, url: url || `https://tatoeba.org/user/profile/${encodeURIComponent(name)}`, n }; }),
    clips: c[id].clips, files: c[id].files,
  }));
};
