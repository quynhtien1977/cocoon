/**
 * Client-side PDF of the dashboard: the element is rasterised (html-to-image keeps the web fonts,
 * Vietnamese diacritics and Recharts SVG intact) and laid onto A4 pages with jsPDF.
 * Both libraries load only when an export starts.
 */

const A4 = { width: 210, height: 297, margin: 10 };

/**
 * Page cuts in canvas pixels. Each page ends at the lowest block bottom that fits, so cards are not
 * split; a block taller than half a page falls back to a hard cut at the page height.
 */
export function pageCuts(total: number, pageHeight: number, blockBottoms: number[]): number[] {
  const bottoms = [...new Set(blockBottoms.map(Math.round))].sort((a, b) => a - b);
  const cuts: number[] = [];
  for (let top = 0; top < total;) {
    const limit = top + pageHeight;
    if (limit >= total) { cuts.push(total); break; }
    const fit = bottoms.filter((bottom) => bottom > top + pageHeight / 2 && bottom <= limit).pop();
    top = fit ?? limit;
    cuts.push(top);
  }
  return cuts;
}

/** Elements marked data-export="skip" are left out; data-exporting is set on the root while capturing. */
export async function downloadElementPdf(element: HTMLElement, fileName: string): Promise<void> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  element.dataset.exporting = "";
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const background = getComputedStyle(document.body).backgroundColor;
    const canvas = await toCanvas(element, {
      pixelRatio: 2,
      backgroundColor: !background || background === "rgba(0, 0, 0, 0)" ? "#ffffff" : background,
      filter: (node) => !(node instanceof HTMLElement && node.dataset.export === "skip"),
    });

    const scale = canvas.width / element.getBoundingClientRect().width;
    const origin = element.getBoundingClientRect().top;
    const blocks = element.querySelectorAll<HTMLElement>("header, section, dl, [data-slot=card], [data-pdf-block], table tr");
    const bottoms = Array.from(blocks, (block) => (block.getBoundingClientRect().bottom - origin) * scale);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const contentWidth = A4.width - 2 * A4.margin;
    const pxPerMm = canvas.width / contentWidth;
    const pageHeight = Math.floor((A4.height - 2 * A4.margin) * pxPerMm);
    let top = 0;
    pageCuts(canvas.height, pageHeight, bottoms).forEach((cut, index) => {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = cut - top;
      const context = slice.getContext("2d")!;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (index > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", A4.margin, A4.margin, contentWidth, slice.height / pxPerMm);
      top = cut;
    });
    pdf.save(fileName);
  } finally {
    delete element.dataset.exporting;
  }
}
