/**
 * ```comic fences: a short comic written as a script and drawn at build time as HTML panels with
 * the fixed cast as pictures (./comic-html.ts, remark-comic.ts). The dialogue stays real text, and
 * index.md keeps the fence as the script.
 *
 *   ```comic cols=2          panels per row at most (default 3; narrow columns get fewer)
 *   # Title                  optional, first line only
 *   > narration              a caption at the top of the panel, at most one per panel
 *   [用户] a line            a speech bubble; [用户!] highlights it
 *   ---                      next panel
 */

/** The fixed cast: every comic on the site draws them the same way, so readers recognise them. */
export const CAST = {
  user: { zh: "用户", en: "User" },
  service: { zh: "你的服务", en: "Your service" },
  model: { zh: "大模型", en: "LLM" },
  cloud: { zh: "云厂商", en: "Cloud" },
  dev: { zh: "你", en: "You" },
} as const;
export type CastKey = keyof typeof CAST;

export interface ComicLine {
  who: CastKey;
  /** The name as the script writes it, in the script's language. */
  name: string;
  text: string;
  highlight: boolean;
}
export interface ComicPanel {
  narration?: string;
  lines: ComicLine[];
}
export interface ComicScript {
  title?: string;
  panels: ComicPanel[];
}

/** A script error; `line` counts from 1 at the first line inside the fence. */
export type ComicError = Error & { line: number };
const fail = (line: number, message: string): never => {
  throw Object.assign(new Error(message), { line });
};

const byName = new Map<string, CastKey>();
for (const [key, names] of Object.entries(CAST) as [CastKey, { zh: string; en: string }][]) {
  byName.set(names.zh, key);
  byName.set(names.en.toLowerCase(), key);
}
const castList = Object.values(CAST)
  .map((n) => `${n.zh} / ${n.en}`)
  .join(", ");

export function parseComic(body: string): ComicScript {
  const script: ComicScript = { panels: [] };
  let panel: ComicPanel = { lines: [] };
  let seen = false; // any non-blank line yet (a title must come first)
  const close = (line: number) => {
    if (!panel.narration && !panel.lines.length) fail(line, "empty panel: put a `> narration` or a `[Name] line` between the `---` separators");
    script.panels.push(panel);
  };
  const lines = body.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.trim();
    if (!line) return;
    const first = !seen;
    seen = true;
    if (line === "---") {
      close(n);
      panel = { lines: [] };
      return;
    }
    if (/^#\s/.test(line)) {
      if (!first) fail(n, "a `# title` is only allowed on the first line of the comic");
      script.title = line.replace(/^#\s+/, "");
      return;
    }
    if (line.startsWith(">")) {
      const text = line.slice(1).trim();
      if (!text) fail(n, "empty narration");
      if (panel.narration) fail(n, "a panel has at most one `> narration` box");
      panel.narration = text;
      return;
    }
    const say = /^\[([^\]]+?)(!?)\]\s*(.*)$/.exec(line);
    if (say) {
      const name = say[1]!.trim();
      const who = byName.get(name) ?? byName.get(name.toLowerCase());
      if (!who) fail(n, `unknown character "${name}"; the cast is ${castList}`);
      if (!say[3]) fail(n, `[${name}] has no line to say`);
      // English names in their usual spelling ([you] → "You"), so labels and alt text read alike
      const shown = CAST[who!].zh === name ? name : CAST[who!].en;
      panel.lines.push({ who: who!, name: shown, text: say[3]!, highlight: say[2] === "!" });
      return;
    }
    fail(n, "expected `> narration`, `[Name] line`, `[Name!] line`, `---` or a first-line `# title`");
  });
  close(lines.length);
  return script;
}

/** Panels per row, from the fence's info string (```comic cols=2). */
export function comicCols(info: string): number {
  const m = /(?:^|\s)cols=(\S*)/.exec(info);
  if (!m) return 3;
  const cols = Number(m[1]);
  if (!Number.isInteger(cols) || cols < 1 || cols > 6) fail(0, `cols=${m[1]} must be a whole number from 1 to 6`);
  return cols;
}
