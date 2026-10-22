// Home page demo and example cards. The 3-question micro-lessons are hand-written;
// example cards pull real Tatoeba sentences (with author credit) from data/packs.
const fs = require('node:fs');
const path = require('node:path');

const NAMES = { zh: 'Mandarin', es: 'Spanish', en: 'English', fr: 'French', it: 'Italian', pt: 'Portuguese', de: 'German' };
const EN = ['hello', 'thank you', 'water', 'goodbye', 'friend', 'cat', 'tea', 'bread'];
const ES = ['hola', 'gracias', 'agua', 'adiós', 'amigo', 'gato', 'té', 'pan'];
// [word, romanization, answer index into the choice list]
const Q = {
  zh: [['你好', 'nǐ hǎo'], ['谢谢', 'xièxie'], ['水', 'shuǐ']],
  es: [['hola'], ['gracias'], ['agua']],
  en: [['hello'], ['thank you'], ['water']],
  fr: [['bonjour'], ['merci'], ['eau']],
  it: [['ciao'], ['grazie'], ['acqua']],
  pt: [['olá'], ['obrigado'], ['água']],
  de: [['Hallo'], ['danke'], ['Wasser']],
};
// Distractors per question (indexes into EN / ES), mixed so the answer moves around.
const MIX = [[3, 0, 6], [4, 5, 1], [2, 7, 6]];
// Example cards: [word as in the pack, sentence text as in the pack].
const CARDS = {
  zh: [['喜欢', '我喜欢猫。'], ['明天', '明天见。'], ['漂亮', '你真漂亮！'], ['水', '喝水。'], ['高兴', '我很高兴。'], ['家', '来我家吧。'], ['猫', '猫有九命。']],
  es: [['amigo', '¡Hola, amigo!'], ['gracias', 'No, gracias.'], ['mañana', 'Hasta mañana.'], ['bonito', '¡Qué bonito!'], ['agua', 'Quiero agua.'], ['feliz', '¿Estás feliz?'], ['música', 'Necesitamos música.']],
  en: [['friend', 'Hi, friend!'], ['happy', 'Be happy!'], ['water', 'Water, please.'], ['tomorrow', 'Come tomorrow.'], ['book', 'Read this book.'], ['beautiful', 'Life is beautiful.'], ['music', 'We like music.']],
  fr: [['ami', 'Bonjour, mon ami.'], ['merci', 'Non, merci.'], ['chien', 'Bon chien !'], ['demain', 'À demain.'], ['heureux', 'Je suis heureux.'], ['musique', 'Aimes-tu la musique ?'], ['maison', 'Où est ta maison ?']],
  it: [['amico', 'Ciao, amico!'], ['grazie', 'Bene, grazie.'], ['cane', 'Ho un cane.'], ['domani', 'A domani.'], ['felice', 'Sono felice!'], ['mangiare', 'Vuoi mangiare?'], ['casa', 'Sono a casa.']],
  pt: [['amigo', 'Obrigado, meu amigo.'], ['obrigado', 'Muito obrigado!'], ['casa', 'Vamos para casa!'], ['água', 'Água, por favor.'], ['feliz', 'Seja feliz!'], ['amanhã', 'Até amanhã.'], ['bonito', 'Que bonito!']],
  de: [['Freund', 'Hallo, Freund!'], ['Wasser', 'Wasser bitte.'], ['glücklich', 'Sei glücklich!'], ['Hund', 'Ich habe einen Hund.'], ['Musik', 'Ich liebe Musik.'], ['schön', 'Danke schön.'], ['Haus', 'Komm nach Hause!']],
};

module.exports = function () {
  const dir = path.join(__dirname, '../../data/packs');
  const langs = [], cards = [];
  for (const id of Object.keys(Q)) {
    const P = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
    const b = id === 'en' ? 'es' : 'en'; const pool = b === 'es' ? ES : EN;
    const qs = Q[id].map(([w, r], i) => {
      const choices = MIX[i].map(k => pool[k]);
      return { w, r: r || '', a: pool[i], choices };
    });
    langs.push({ id, name: NAMES[id], speech: P.speech, base: b, start: `/learn/?pack=${id}&placement=1`, hub: `/${P.slug}/`, qs });
    for (const [w, st] of CARDS[id]) {
      const it = P.items.find(x => x.t === w); if (!it) continue;
      const sid = (it.ex || []).find(s => P.sentences[s] && P.sentences[s].t === st); const s = sid && P.sentences[sid];
      if (!s || !s.tr[b]) continue;
      cards.push({ id, name: NAMES[id], speech: P.speech, w, r: it.r || '', t: s.t, tr: s.tr[b], by: [s.a, s.ta && s.ta[b]].filter(Boolean).join(' / '), url: `/${P.slug}/words/${it.slug}/` });
    }
  }
  // Interleave languages so the carousel changes language on every card.
  const byLang = {}; for (const c of cards) (byLang[c.id] ||= []).push(c);
  const mixed = []; for (let i = 0; i < 8; i++) for (const id of Object.keys(byLang)) if (byLang[id][i]) mixed.push(byLang[id][i]);
  return { langs, cards: mixed, byLang };
};
