import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Page "Print / PDF" button — captures the inventory page exactly as shown on
 * screen (the app sidebar is excluded) and downloads it as a PDF file.
 * Tall content is split across multiple A4 pages.
 */
export default function PrintPageButton({ title = 'Inventory' }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    const target = document.querySelector('main');
    if (!target) return;

    setBusy(true);
    const widened = [];
    const previousWidth = target.style.width;

    // Wide tables are un-clipped for the capture so no column gets cut off.
    if (target.scrollHeight <= 16000) {
      target.querySelectorAll('.table-scroll-x').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 4) {
          widened.push({ el, style: el.getAttribute('style') || '', width: el.scrollWidth });
          el.style.overflow = 'visible';
          el.style.width = `${el.scrollWidth}px`;
        }
      });
      if (widened.length) {
        target.style.width = `${Math.max(target.clientWidth, ...widened.map(w => w.width + 48))}px`;
      }
    }

    try {
      const scale = target.clientWidth > 2200 || target.scrollHeight > 4000 ? 1.25 : 2;
      const canvas = await html2canvas(target, {
        scale,
        backgroundColor: '#eef1f6',
        useCORS: true,
        logging: false,
        windowWidth: target.clientWidth + 360,
      });

      const image = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({
        orientation: canvas.width / canvas.height > 1.25 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const headerH = 12;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const usable = pageH - headerH - margin;
      const stamp = new Date().toLocaleString();

      let offset = 0;
      let page = 1;
      while (offset < imgH) {
        if (page > 1) pdf.addPage();
        pdf.setFillColor(30, 55, 153);
        pdf.rect(0, 0, pageW, headerH, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.text(title, margin, 8);
        pdf.setFontSize(7.5);
        pdf.text(`${stamp}   •   Page ${page}`, pageW - margin, 8, { align: 'right' });
        pdf.addImage(image, 'JPEG', margin, headerH + margin - offset, imgW, imgH);
        offset += usable;
        page += 1;
      }

      pdf.save(`${title} - ${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not build the PDF',
        description: 'Press Ctrl+P (Cmd+P on Mac) and choose "Save as PDF" instead.',
      });
    } finally {
      widened.forEach(({ el, style }) => {
        if (style) el.setAttribute('style', style);
        else el.removeAttribute('style');
      });
      target.style.width = previousWidth;
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleDownload} disabled={busy}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
      {busy ? 'Preparing…' : 'Print / PDF'}
    </Button>
  );
}