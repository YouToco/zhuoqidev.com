// Guestbook page: post a note, show the wall (functions/api/guestbook.ts). A note waits for approval,
// so the writer's own pending notes are kept in this browser and shown only to them until then.
import { apiBase } from "../site";

type Note = { id: number; name: string; body: string; color: string; date: string };
type Messages = {
  sending: string;
  sent: string;
  errors: Record<string, string>;
  pending: string;
  anonymous: string;
  loading: string;
  empty: string;
  loadFailed: string;
};

const KEY = "zq-guestbook-mine";
const form = document.querySelector<HTMLFormElement>("[data-gb-form]");
if (form) init(form);

function init(form: HTMLFormElement) {
  const endpoint = `${apiBase(location.hostname)}/api/guestbook`;
  const msg = JSON.parse(form.dataset.msg!) as Messages;
  const max = Number(form.dataset.max);
  const wall = document.querySelector<HTMLUListElement>("[data-gb-wall]")!;
  const status = form.querySelector<HTMLElement>("[data-gb-status]")!;
  const count = form.querySelector<HTMLElement>("[data-gb-count]")!;
  const body = form.querySelector<HTMLTextAreaElement>("textarea")!;
  const send = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const opened = performance.now();
  let approved: Note[] = [];

  // Counts code points, like the server's limit (server/guestbook.ts).
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- code points are what is counted
  const length = (s: string) => [...s.trim()].length;
  const say = (text: string) => {
    status.textContent = text;
  };
  const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

  const mine = (): Note[] => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
      return Array.isArray(list) ? (list as Note[]) : [];
    } catch {
      return [];
    }
  };
  const keepMine = (list: Note[]) => {
    try {
      if (list.length) localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
      else localStorage.removeItem(KEY);
    } catch {}
  };

  const count_ = () => {
    const n = length(body.value);
    count.textContent = `${n} / ${max}`;
    count.classList.toggle("over", n > max);
  };
  body.addEventListener("input", count_);

  // A slight, stable tilt per note, like paper stuck on by hand.
  const tilt = (id: number) => ((id * 37) % 7) - 3;

  function card(n: Note, pending: boolean) {
    const li = document.createElement("li");
    li.className = `gb-note ${/^(yellow|pink|blue|green)$/.test(n.color) ? n.color : "yellow"}${pending ? " pending" : ""}`;
    li.style.setProperty("--tilt", `${pending ? 0 : tilt(n.id)}deg`);
    if (pending) {
      const tag = document.createElement("span");
      tag.className = "gb-pending";
      tag.textContent = msg.pending;
      li.append(tag);
    }
    const p = document.createElement("p");
    p.textContent = n.body;
    const foot = document.createElement("div");
    foot.className = "gb-foot";
    const who = document.createElement("span");
    who.textContent = `— ${n.name || msg.anonymous}`;
    const when = document.createElement("time");
    when.dateTime = n.date;
    when.textContent = n.date;
    foot.append(who, when);
    li.append(p, foot);
    return li;
  }

  function line(text: string) {
    const li = document.createElement("li");
    li.className = "gb-msg";
    li.textContent = text;
    return li;
  }

  function render(failed = false) {
    // Notes I have approved show up on the wall; stop keeping a private copy of them.
    const onWall = new Set(approved.map((n) => n.id));
    const pending = mine().filter((n) => !onWall.has(n.id));
    keepMine(pending);
    const items = [...pending.map((n) => card(n, true)), ...approved.map((n) => card(n, false))];
    if (failed) items.unshift(line(msg.loadFailed));
    else if (!items.length) items.push(line(msg.empty));
    wall.replaceChildren(...items);
  }

  fetch(endpoint)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { notes: Note[] }) => {
      approved = d.notes;
      render();
    })
    .catch(() => render(true));

  // The handler settles every await inside try/catch/finally, so its promise never rejects.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- see above
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    // Every field here is text; FormData would only hand back a File for a file input.
    const field = (k: string, fallback = "") => {
      const v = fd.get(k);
      return typeof v === "string" ? v : fallback;
    };
    const text = field("body").trim();
    const name = field("name").replace(/\s+/g, " ").trim();
    const color = field("color", "yellow");
    if (!length(text)) { say(msg.errors.empty!); return; }
    if (length(text) > max) { say(msg.errors["too-long"]!); return; }
    send.disabled = true;
    say(msg.sending);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          name,
          color,
          lang: form.dataset.lang,
          website: fd.get("website") ?? "",
          ms: Math.round(performance.now() - opened),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok) { say(msg.errors[data.error ?? ""] ?? msg.errors.network!); return; }
      if (data.id) keepMine([{ id: data.id, name, body: text, color, date: today() }, ...mine()]);
      form.reset();
      count_();
      say(msg.sent);
      render();
    } catch {
      say(msg.errors.network!);
    } finally {
      send.disabled = false;
    }
  });
}
