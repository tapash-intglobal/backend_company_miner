import PDFDocument = require('pdfkit');
import type {
  CompanyMinerResult,
  SuggestedServiceWeCanProvide,
} from '../services/tools/CompanyMinerService';

export interface CompanyMinerPdfParams {
  url: string;
  instruction?: string;
  result: CompanyMinerResult;
  suggestedServices: SuggestedServiceWeCanProvide[];
}

export interface CompanyMinerPdfOutput {
  buffer: Buffer;
  filename: string;
}

export async function generateCompanyMinerPdf(
  params: CompanyMinerPdfParams
): Promise<CompanyMinerPdfOutput> {
  const { url, instruction, result, suggestedServices } = params;
  const filename = buildFilename(url, result);

  return new Promise<CompanyMinerPdfOutput>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', (err) => reject(err));
    doc.on('end', () => {
      resolve({
        buffer: Buffer.concat(chunks),
        filename,
      });
    });

    const blue = '#1d4ed8';
    const darkBlue = '#0f172a';

    // Top blue header band
    const pageWidth = doc.page.width;
    const headerHeight = 60;
    doc.save();
    doc.rect(0, 0, pageWidth, headerHeight).fill(blue);

    // Optional logo on the left
    const logoPath = process.env.COMPANY_LOGO_PATH;
    const headerPaddingX = 48;
    let contentStartY = headerHeight + 24;
    try {
      if (logoPath) {
        const logoHeight = 28;
        doc.image(logoPath, headerPaddingX, 18, {
          fit: [logoHeight * 4, logoHeight],
          height: logoHeight,
        });
      }
    } catch {
      // Logo is optional; ignore errors
    }

    // Report title in header
    doc
      .fillColor('#ffffff')
      .fontSize(18)
      .text('Company Miner Report', headerPaddingX, 18, {
        align: 'center',
      });
    doc.restore();

    doc.moveDown();
    doc.y = contentStartY;

    // Metadata block
    doc
      .fontSize(10)
      .fillColor('#4b5563')
      .text(`Website: ${url}`, { align: 'left' });
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .text(`Generated at: ${new Date().toISOString()}`, { align: 'left' });

    if (instruction?.trim()) {
      doc.moveDown(0.5);
      doc
        .roundedRect(doc.x - 4, doc.y - 4, pageWidth - 2 * headerPaddingX, 40, 6)
        .fillOpacity(0.03)
        .fillAndStroke(blue, '#dbeafe');
      doc.fillOpacity(1);
      const boxX = headerPaddingX;
      const boxY = doc.y;
      doc
        .fillColor(darkBlue)
        .fontSize(10)
        .text('User instruction (focus):', boxX, boxY, { underline: true });
      doc.moveDown(0.1);
      doc
        .fontSize(10)
        .fillColor('#111827')
        .text(instruction.trim(), { width: pageWidth - 2 * headerPaddingX });
    }

    doc.moveDown(1);

    const section = (title: string) => {
      doc.moveDown(0.75);
      doc
        .fontSize(11)
        .fillColor(darkBlue)
        .text(title, { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(10).fillColor('#111827');
    };

    // About
    section('About the Company');
    doc.text(result.aboutTheCompany || '—', { align: 'left' });

    // Products
    section('Products');
    if (result.products?.length) {
      result.products.forEach((p) => doc.text(`• ${p}`));
    } else {
      doc.text('No products identified.');
    }

    // Services
    section('Services');
    if (result.services?.length) {
      result.services.forEach((s) => doc.text(`• ${s}`));
    } else {
      doc.text('No services identified.');
    }

    // Industry
    section('Industry');
    doc.text(result.industry || '—');

    // Income sources
    section('Top 5 Sources of Income');
    if (result.top5SourcesOfIncome?.length) {
      result.top5SourcesOfIncome.forEach((s) => doc.text(`• ${s}`));
    } else {
      doc.text('No revenue sources identified.');
    }

    // Financial results
    section('Financial Results (latest 5)');
    if (result.financialResultsLatest5?.length) {
      result.financialResultsLatest5.forEach((s) => doc.text(`• ${s}`));
    } else {
      doc.text('No financial results identified.');
    }

    // Current challenges
    section('Current challenges mentioned publicly');
    if (result.currentChallenges?.length) {
      result.currentChallenges.forEach((c) => doc.text(`• ${c}`));
    } else {
      doc.text('No explicit challenges identified.');
    }

    // Competitors
    section('Competitors');
    if (result.competitors?.length) {
      result.competitors.forEach((c) => doc.text(`• ${c}`));
    } else {
      doc.text('No explicit competitors identified.');
    }

    // Suggested services
    section('Services We Can Provide');
    if (suggestedServices?.length) {
      suggestedServices.forEach((svc) => {
        doc.text(`• ${svc.serviceName}`, { continued: false });
        if (svc.rationale) {
          doc.moveDown(0.1);
          doc
            .fontSize(9)
            .fillColor('#4b5563')
            .text(`  ${svc.rationale}`);
          doc.fontSize(10).fillColor('#111827');
        }
        doc.moveDown(0.15);
      });
    } else {
      doc.text('No suggestions generated (check Master Services configuration).');
    }

    // Footer
    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor('#9ca3af')
      .text('Generated by Company Miner – Enterprise use only.', {
        align: 'center',
      });

    doc.end();
  });
}

function buildFilename(url: string, result: CompanyMinerResult): string {
  const hostname = safeHostname(url);
  const baseFromUrl = hostname?.split('.')[0] ?? 'company';

  const rawName =
    inferCompanyNameFromAbout(result.aboutTheCompany) ||
    baseFromUrl ||
    'company';

  const slug = rawName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 80) || 'company';

  return `${slug}-company-miner-report.pdf`;
}

function safeHostname(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

function inferCompanyNameFromAbout(about: string | undefined): string | null {
  if (!about) return null;
  const sentence = about.split(/[.!?]/)[0] || '';
  if (!sentence) return null;
  // Simple heuristic: first 5 words, capitalized sequence
  const match = sentence.match(/^[A-Z][A-Za-z0-9&\-\s]{2,40}/);
  return match?.[0].trim() || null;
}


