/** Section headings that already carry the author's own numbering: "1. …", "一、…", "第二部分…", "Step 3 …". */
const OWN_NUMBER = /^(\d+[.、:：)]\s*|[一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十\d]+[章节部分步]|(Step|Part|Chapter)\s+\d)/;

/**
 * True when most of an article's h2 headings are numbered by hand. Such articles skip the
 * automatic §01 counter (and the TOC's index column) so readers never see "§01 1. …".
 */
export function numberedByAuthor(headings: string[]): boolean {
  const own = headings.filter((h) => OWN_NUMBER.test(h.trim())).length;
  return own > 0 && own * 2 >= headings.length;
}
