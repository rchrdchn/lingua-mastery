// Shared by the site build, the audio generator and (mirrored in src/engine/audio.ts) the browser:
// maps an audio "owner" (a word, character, lesson or demo) to its bundle file name.
const AUDIO_V = 1;
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const bundlePath = (pack, owner) => `/a/${pack}/${cyrb53(`${owner}|${AUDIO_V}`).toString(36)}.bin`;
module.exports = { AUDIO_V, cyrb53, bundlePath };
