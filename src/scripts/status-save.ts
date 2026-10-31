// "Save image" / "Save PDF" on /status/ (src/scripts/ai-status.ts loads this on the first click, so
// the page itself never carries it). The newspaper sheet is drawn into a canvas at twice its CSS
// size in the theme it is shown in, with the page's own fonts embedded (modern-screenshot copies
// the @font-face rules, including the per-page subsets inlined as data: URLs), then downloaded as
// a PNG or as a one-page PDF of the same picture (jspdf, loaded only for the PDF).
import { domToCanvas } from "modern-screenshot";

/** The PDF page is A4 wide and as tall as the picture; PDF pages stop at 200 inches (5080 mm). */
const PAGE_W = 210;
const PAGE_MAX = 5080;

/** Left out: the save buttons themselves, and <noscript>, whose text the clone would print. */
const keep = (n: Node) => !(n instanceof Element && (n.hasAttribute("data-save") || n.localName === "noscript"));

/** The lead story's drop cap is a ::first-letter, which the clone doesn't copy (it copies ::before and
 * ::after), and `initial-letter` doesn't take on a plain span: set the first letter in a floated span,
 * as global.css does for browsers without `initial-letter`, in the original's face and colour. */
function dropCap(sheet: HTMLElement) {
  const orig = sheet.querySelector(".np-first");
  const cs = orig && getComputedStyle(orig, "::first-letter");
  return (cloned: Node) => {
    if (!cs || !(cloned instanceof HTMLElement) || !cloned.classList.contains("np-first")) return;
    const text = cloned.firstChild;
    if (!(text instanceof Text)) return;
    const letter = /^[\p{P}\s]*./u.exec(text.data)?.[0];
    if (!letter) return;
    const span = document.createElement("span");
    span.textContent = letter;
    Object.assign(span.style, {
      float: "left",
      margin: ".1em .12em 0 -.02em",
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      fontSize: "4.3em",
      lineHeight: ".88",
      color: cs.color,
    });
    // The clone writes every computed value inline, -webkit-text-fill-color too (it inherits).
    span.style.setProperty("-webkit-text-fill-color", cs.color);
    text.data = text.data.slice(letter.length);
    cloned.prepend(span);
  };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function saveSheet(sheet: HTMLElement, kind: "png" | "pdf", name: string): Promise<void> {
  await document.fonts.ready;
  const canvas = await domToCanvas(sheet, {
    scale: 2,
    filter: keep,
    onCloneEachNode: dropCap(sheet),
    timeout: 15_000,
  });
  if (kind === "png") {
    const blob = await new Promise<Blob | null>((r) => {
      canvas.toBlob(r, "image/png");
    });
    if (!blob) throw new Error("toBlob");
    download(blob, name);
    return;
  }
  const { jsPDF } = await import("jspdf");
  let w = PAGE_W;
  let h = (w * canvas.height) / canvas.width;
  if (h > PAGE_MAX) {
    w = (w * PAGE_MAX) / h;
    h = PAGE_MAX;
  }
  const pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: h >= w ? "portrait" : "landscape", compress: true });
  pdf.addImage(canvas, "PNG", 0, 0, w, h, undefined, "FAST");
  download(pdf.output("blob"), name);
}
