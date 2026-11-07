// The homepage sticky note writes itself in reading order (global.css, "Paper motion"). Each Chinese
// character, and each Latin word with the spaces after it, gets its start and length in ms, a
// character taking about twice as long as a letter. Words rather than letters: 49 letter spans on
// the English homepage tipped the headline's font swap past the first paint (CLS 0.007 -> 0.05).
const pace = (ch: string) => (/\s/.test(ch) ? 40 : /\p{P}/u.test(ch) ? 80 : /\p{Script=Han}/u.test(ch) ? 115 : 55);

export function inkPieces(text: string) {
  let at = 0;
  return (text.match(/\p{Script=Han}|[^\s\p{Script=Han}]+\s*|\s+/gu) ?? []).map((piece) => {
    const chars = Array.from(new Intl.Segmenter().segment(piece), (s) => s.segment);
    const w = chars.reduce((sum, ch) => sum + pace(ch), 0);
    at += w;
    return { text: piece, style: `--t:${String(at - w)}ms;--w:${String(w)}ms` };
  });
}
