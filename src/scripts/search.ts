// Client for the Pagefind index built into dist/pagefind/ after `astro build`.
// Pagefind picks the index matching <html lang>, so the Chinese page only searches Chinese posts
// (with word segmentation) and the English page only English ones.
interface SubResult {
  title: string;
  url: string;
  excerpt: string;
}
interface Result {
  url: string;
  excerpt: string;
  meta: { title?: string; date?: string };
  sub_results: SubResult[];
}
interface Pagefind {
  init(): Promise<void>;
  debouncedSearch(q: string, opts?: object, ms?: number): Promise<{ results: { data(): Promise<Result> }[] } | null>;
}

const form = document.querySelector<HTMLFormElement>(".search-box")!;
const input = form.querySelector<HTMLInputElement>("#q")!;
const statusEl = document.querySelector<HTMLElement>(".search-status")!;
const list = document.querySelector<HTMLOListElement>(".search-results")!;
const zh = document.documentElement.lang.startsWith("zh");
const count = (n: number) => (zh ? `找到 ${n} 篇` : `${n} ${n === 1 ? "post" : "posts"}`);

let pagefind: Promise<Pagefind> | null = null;
const load = () =>
  (pagefind ??= import(/* @vite-ignore */ `${location.origin}/pagefind/pagefind.js`).then(async (m: Pagefind) => {
    await m.init();
    return m;
  }));

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function run(q: string) {
  const query = q.trim();
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  history.replaceState(null, "", url);
  if (!query) {
    statusEl.textContent = "";
    list.replaceChildren();
    return;
  }
  let search;
  try {
    search = await (await load()).debouncedSearch(query, {}, 200);
  } catch {
    statusEl.textContent = form.dataset.failed!;
    return;
  }
  if (search === null) return; // superseded by a newer keystroke
  const results = await Promise.all(search.results.slice(0, 20).map((r) => r.data()));
  statusEl.textContent = results.length ? count(search.results.length) : form.dataset.empty!.replace("%q", query);
  list.replaceChildren(
    ...results.map((r) => {
      const li = document.createElement("li");
      li.className = "card search-hit";
      // Pagefind already HTML-escapes excerpts before adding <mark>; titles and meta are raw.
      const subs = r.sub_results
        .filter((s) => s.url !== r.url)
        .slice(0, 3)
        .map((s) => `<li><a href="${esc(s.url)}">§ ${esc(s.title)}</a><p>${s.excerpt}</p></li>`)
        .join("");
      li.innerHTML =
        `<a class="hit-title" href="${esc(r.url)}">${esc(r.meta.title ?? r.url)}</a>` +
        (r.meta.date ? `<time>${esc(r.meta.date)}</time>` : "") +
        `<p>${r.excerpt}</p>` +
        (subs ? `<ul>${subs}</ul>` : "");
      return li;
    }),
  );
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  void run(input.value);
});
input.addEventListener("input", () => void run(input.value));
input.addEventListener("focus", () => void load().catch(() => {}), { once: true });

const initial = new URLSearchParams(location.search).get("q");
if (initial) {
  input.value = initial;
  void run(initial);
}
input.focus();

export {};
