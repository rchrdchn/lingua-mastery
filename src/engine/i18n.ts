// Interface strings in each base language. Keys missing in a language fall back to English.
import type { Base } from './types';

const en = {
  continue: 'Continue', start: 'Start practice', placement: 'Take the placement quiz', placementIntro: 'Skip what you know. 5 quick questions per step.', findLevel: 'Find your level', more: 'Explain more', tapFlip: 'Tap a card to flip it', unlocked: 'Unlocked',
  beginner: 'I am a beginner', next: 'Next', check: 'Check', correct: 'Correct', wrong: 'Not quite', almost: 'Almost: watch the accents',
  answerWas: 'Answer', xp: 'XP', mastered: 'Mastered', learning: 'Learning', practicing: 'Practicing', decaying: 'Needs review', unseen: 'Not started', locked: 'Locked',
  due: 'Reviews due', streak: 'Day streak', checkIn: 'Mastery check in', concepts: 'Concepts', map: 'Your map', sessionDone: 'Session complete', earned: 'You earned',
  newlyMastered: 'Newly mastered', allDone: 'All caught up! Come back later or pick any open lesson.', masteryCheck: 'Mastery check', masteryCheckIntro: 'Prove you still know it.',
  placed: 'Placement done', placedAt: 'You start at', listen: 'Listen', type: 'Type the word', write: 'Write the character stroke by stroke', tone: 'Pick the right tones', settings: 'Settings',
  audio: 'Audio', reset: 'Reset progress', resetConfirm: 'Delete all progress for this course in this browser?', export: 'Export progress', import: 'Import progress', base: 'I speak',
  noVoice: 'No voice for this language in your browser, so listening drills are off.', back: 'Back to map', words: 'Words', grammar: 'Grammar', lesson: 'Lesson', example: 'Examples', pattern: 'Pattern',
  meaning: 'What does this mean?', which: 'Which one means', fill: 'Fill the blank', progressNote: 'Progress is saved in this browser only. No account needed.', pickCourse: 'Pick a course',
  hint: 'Hint', strokes: 'strokes', mistakes: 'mistakes', practiceThis: 'Practice this', unlocks: 'Unlocks after', level: 'Level',
};
type Dict = typeof en;

const es: Partial<Dict> = {
  continue: 'Continuar', start: 'Empezar a practicar', placement: 'Hacer la prueba de nivel', placementIntro: 'Salta lo que ya sabes. 5 preguntas rápidas por paso.', findLevel: 'Encuentra tu nivel', more: 'Explicar más', tapFlip: 'Toca una tarjeta para girarla', unlocked: 'Desbloqueado',
  beginner: 'Soy principiante', next: 'Siguiente', check: 'Comprobar', correct: 'Correcto', wrong: 'No exactamente', almost: 'Casi: cuidado con los acentos',
  answerWas: 'Respuesta', mastered: 'Dominado', learning: 'Aprendiendo', practicing: 'Practicando', decaying: 'Repasar', unseen: 'Sin empezar', locked: 'Bloqueado',
  due: 'Repasos pendientes', streak: 'Días seguidos', checkIn: 'Control de dominio en', concepts: 'Conceptos', map: 'Tu mapa', sessionDone: 'Sesión completada', earned: 'Has ganado',
  newlyMastered: 'Recién dominado', allDone: 'No hay nada pendiente. Vuelve más tarde o elige un concepto desbloqueado.', masteryCheck: 'Control de dominio', masteryCheckIntro: 'Un repaso rápido de lo que ya dominas.',
  placed: 'Prueba terminada', placedAt: 'Empiezas en', listen: 'Escucha', type: 'Escribe la palabra', tone: 'Elige los tonos correctos', settings: 'Ajustes', audio: 'Audio',
  reset: 'Borrar progreso', resetConfirm: '¿Borrar todo el progreso de este curso en este navegador?', export: 'Exportar progreso', import: 'Importar progreso', base: 'Hablo',
  noVoice: 'Tu navegador no tiene voz para este idioma, así que no hay ejercicios de escucha.', back: 'Volver al mapa', words: 'Palabras', grammar: 'Gramática', lesson: 'Lección', example: 'Ejemplos', pattern: 'Estructura',
  meaning: '¿Qué significa?', which: '¿Cuál significa', fill: 'Completa el hueco', progressNote: 'El progreso se guarda solo en este navegador. Sin cuenta.', pickCourse: 'Elige un curso',
  hint: 'Pista', practiceThis: 'Practicar esto', unlocks: 'Se desbloquea tras', level: 'Nivel',
};
const pt: Partial<Dict> = {
  continue: 'Continuar', start: 'Começar a praticar', placement: 'Fazer o teste de nível', placementIntro: 'Pule o que você já sabe. 5 perguntas rápidas por etapa.', findLevel: 'Encontre seu nível', more: 'Explicar mais', tapFlip: 'Toque num cartão para virar', unlocked: 'Desbloqueado',
  beginner: 'Sou iniciante', next: 'Próximo', check: 'Verificar', correct: 'Correto', wrong: 'Não exatamente', almost: 'Quase: atenção aos acentos',
  answerWas: 'Resposta', mastered: 'Dominado', learning: 'Aprendendo', practicing: 'Praticando', decaying: 'Revisar', unseen: 'Não iniciado', locked: 'Bloqueado',
  due: 'Revisões pendentes', streak: 'Dias seguidos', checkIn: 'Teste de domínio em', concepts: 'Conceitos', map: 'Seu mapa', sessionDone: 'Sessão concluída', earned: 'Você ganhou',
  newlyMastered: 'Dominado agora', allDone: 'Nada pendente agora. Volte mais tarde ou escolha um conceito desbloqueado.', masteryCheck: 'Teste de domínio', masteryCheckIntro: 'Uma revisão rápida do que você já domina.',
  placed: 'Teste concluído', placedAt: 'Você começa em', listen: 'Ouça', type: 'Digite a palavra', tone: 'Escolha os tons certos', settings: 'Configurações', audio: 'Áudio',
  reset: 'Apagar progresso', resetConfirm: 'Apagar todo o progresso deste curso neste navegador?', export: 'Exportar progresso', import: 'Importar progresso', base: 'Eu falo',
  noVoice: 'Seu navegador não tem voz para este idioma, então os exercícios de escuta estão desligados.', back: 'Voltar ao mapa', words: 'Palavras', grammar: 'Gramática', lesson: 'Lição', example: 'Exemplos', pattern: 'Estrutura',
  meaning: 'O que significa?', which: 'Qual significa', fill: 'Complete a lacuna', progressNote: 'O progresso fica salvo só neste navegador. Sem conta.', pickCourse: 'Escolha um curso',
  hint: 'Dica', practiceThis: 'Praticar isto', unlocks: 'Desbloqueia depois de', level: 'Nível',
};
const zh: Partial<Dict> = {
  continue: '继续', start: '开始练习', placement: '做分级测试', placementIntro: '会的直接跳过。每步 5 道快题。', findLevel: '找到你的水平', more: '更多解释', tapFlip: '点卡片翻面', unlocked: '已解锁', beginner: '我是初学者', next: '下一题', check: '检查',
  correct: '正确', wrong: '不对', almost: '差一点：注意重音符号', answerWas: '答案', mastered: '已掌握', learning: '学习中', practicing: '练习中', decaying: '需要复习', unseen: '未开始', locked: '未解锁',
  due: '待复习', streak: '连续天数', checkIn: '掌握测试还差', concepts: '知识点', map: '学习地图', sessionDone: '本轮完成', earned: '获得', newlyMastered: '新掌握',
  allDone: '现在没有待复习的内容。稍后再来，或选择任何已解锁的知识点。', masteryCheck: '掌握测试', masteryCheckIntro: '快速检查你已经掌握的内容。', placed: '测试完成', placedAt: '你从这里开始',
  listen: '听', type: '输入单词', tone: '选择正确的声调', settings: '设置', audio: '声音', reset: '重置进度', resetConfirm: '删除此浏览器中这门课的全部进度？', export: '导出进度', import: '导入进度', base: '我说',
  noVoice: '你的浏览器没有这种语言的语音，所以听力练习已关闭。', back: '返回地图', words: '单词', grammar: '语法', lesson: '课程', example: '例句', pattern: '句型',
  meaning: '这是什么意思？', which: '哪个意思是', fill: '填空', progressNote: '进度只保存在这个浏览器里，不需要账号。', pickCourse: '选择课程', hint: '提示', practiceThis: '练习这个', unlocks: '解锁条件', level: '级别',
};

const dicts: Record<Base, Partial<Dict>> = { en, es, pt, zh };
export type Key = keyof Dict;
export function t(base: Base, k: Key): string { return (dicts[base]?.[k] ?? en[k]) as string; }
export const BASE_NAMES: Record<Base, string> = { en: 'English', es: 'Español', pt: 'Português', zh: '中文' };
