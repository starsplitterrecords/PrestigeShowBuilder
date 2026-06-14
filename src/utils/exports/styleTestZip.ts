import JSZip from 'jszip';
import { StyleTestResult } from '../../ai/imageGeneration/generateStyleTestImage';

export async function generateStyleTestZip(
  showTitle: string,
  results: StyleTestResult[]
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('style-tests')!;
  const manifestLines: string[] = [
    `STYLE TEST — ${showTitle}`,
    `Generated: ${new Date().toISOString()}`,
    `${results.length} styles`,
    '',
  ];

  results.forEach((r, i) => {
    const idx = String(i + 1).padStart(2, '0');
    // Sanitise name for filename
    const safeName = r.preset.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeReg  = r.preset.register.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${idx}_${safeName}_${safeReg}.png`;
    folder.file(filename, r.blob);

    manifestLines.push(`--- ${idx}. ${r.preset.name} (${r.preset.register}) ---`);
    manifestLines.push(`Category: ${r.preset.category}`);
    manifestLines.push(`File: ${filename}`);
    manifestLines.push('PROMPT:');
    manifestLines.push(r.prompt);
    manifestLines.push('');
  });

  folder.file('MANIFEST.txt', manifestLines.join('\n'));
  return zip.generateAsync({ type: 'blob' });
}
