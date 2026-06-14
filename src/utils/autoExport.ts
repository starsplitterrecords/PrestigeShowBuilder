import { Show } from '../types/models';
import { buildProductionReviewDocument } from './exportProductionReviewDocument';
import { formatProductionReviewDocument } from './formatProductionReviewDocument';
import jsPDF from 'jspdf';

export function triggerProductionReviewExport(show: Show) {
  try {
    const docData = buildProductionReviewDocument(show);
    const text = formatProductionReviewDocument(docData);
    const lines = text.split('\n');
    
    // We'll use PDF for the initial review document as it's more "formal"
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter'
    });
    
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    
    let y = 1;
    const margin = 0.75;
    const pageHeight = 11;
    const lineHeight = 0.15;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      const splitLines = doc.splitTextToSize(line, 8.5 - margin * 2);
      for (let j = 0; j < splitLines.length; j++) {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(splitLines[j], margin, y);
        y += lineHeight;
      }
    }
    
    const title = (show.titleSuggestion || show.name || 'show').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${title}_initial_production_review.pdf`);
  } catch (e) {
    console.error("Failed to auto-export production review:", e);
  }
}
