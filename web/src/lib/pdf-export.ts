import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  options?: { orientation?: 'portrait' | 'landscape' }
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#12081E',
    logging: false,
  });

  const orientation = options?.orientation ?? 'landscape';
  const pdf = new jsPDF(orientation, 'mm', 'a4');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= usableHeight) {
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
  } else {
    // Multi-page: slice the canvas into page-sized chunks
    const scaleFactor = canvas.width / imgWidth;
    const sliceHeightPx = usableHeight * scaleFactor;
    let srcY = 0;
    let page = 0;

    while (srcY < canvas.height) {
      if (page > 0) pdf.addPage();

      const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - srcY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceHeight;

      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, srcY, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);
      }

      const sliceImgHeight = (currentSliceHeight * imgWidth) / canvas.width;
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, sliceImgHeight, undefined, 'FAST');

      srcY += sliceHeightPx;
      page++;
    }
  }

  pdf.save(`${filename}.pdf`);
}

export async function exportMultipleElementsToPdf(
  elements: Array<{ element: HTMLElement; title: string }>,
  filename: string,
  options?: { orientation?: 'portrait' | 'landscape' }
): Promise<void> {
  const orientation = options?.orientation ?? 'landscape';
  const pdf = new jsPDF(orientation, 'mm', 'a4');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  for (let i = 0; i < elements.length; i++) {
    const { element, title } = elements[i];

    if (i > 0) pdf.addPage();

    // Section title
    pdf.setFontSize(16);
    pdf.setTextColor(149, 102, 242); // primary purple
    pdf.text(title, margin, margin + 6);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#12081E',
      logging: false,
    });

    const contentTop = margin + 12;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const availableHeight = pageHeight - contentTop - margin;

    if (imgHeight <= availableHeight) {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, contentTop, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      const scaleFactor = canvas.width / imgWidth;
      const firstSliceHeightPx = availableHeight * scaleFactor;

      // First slice on same page as title
      const firstSlice = document.createElement('canvas');
      firstSlice.width = canvas.width;
      firstSlice.height = Math.min(firstSliceHeightPx, canvas.height);
      const ctx1 = firstSlice.getContext('2d');
      if (ctx1) {
        ctx1.drawImage(canvas, 0, 0, canvas.width, firstSlice.height, 0, 0, canvas.width, firstSlice.height);
      }
      const firstImgH = (firstSlice.height * imgWidth) / canvas.width;
      pdf.addImage(firstSlice.toDataURL('image/png'), 'PNG', margin, contentTop, imgWidth, firstImgH, undefined, 'FAST');

      // Remaining slices
      let srcY = firstSliceHeightPx;
      const sliceHeightPx = usableHeight * scaleFactor;

      while (srcY < canvas.height) {
        pdf.addPage();
        const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - srcY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, srcY, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);
        }
        const sliceImgH = (currentSliceHeight * imgWidth) / canvas.width;
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, sliceImgH, undefined, 'FAST');
        srcY += sliceHeightPx;
      }
    }
  }

  // Footer on every page
  const totalPages = pdf.getNumberOfPages();
  const now = new Date().toLocaleDateString('pt-BR');
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.setTextColor(160, 160, 184); // muted
    pdf.text(`SuperGerente — ${now} — Página ${p}/${totalPages}`, margin, pageHeight - 5);
  }

  pdf.save(`${filename}.pdf`);
}
