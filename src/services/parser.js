// ========================================================================
// File parser — DOCX, PDF, TXT, Excel
// ========================================================================
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';

/**
 * Parse a file and return its raw text content.
 * @param {File} file
 * @returns {Promise<{text: string, type: string}>}
 */
export async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    switch (ext) {
        case 'docx':
        case 'doc':
            return parseDocx(file);
        case 'pdf':
            return parsePdf(file);
        case 'xlsx':
        case 'xls':
            return parseExcel(file);
        case 'txt':
        case 'text':
        case 'md':
        case 'csv':
            return parseTxt(file);
        default:
            throw new Error(`Unsupported file type: .${ext}`);
    }
}

async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value, type: 'docx' };
}

async function parsePdf(file) {
    const pdfjsLib = await import('pdfjs-dist');

    // Set the worker source (only once)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        if (window.__PDF_WORKER_URL__) {
            // Self-contained HTML: worker is inlined as a data URL
            pdfjsLib.GlobalWorkerOptions.workerSrc = window.__PDF_WORKER_URL__;
        } else {
            // Dev server / normal build: use file reference
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/build/pdf.worker.mjs',
                import.meta.url
            ).toString();
        }
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((item) => item.str).join(' ');
        pages.push(text);
    }

    return { text: pages.join('\n\n'), type: 'pdf' };
}

async function parseExcel(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheets = [];

    workbook.eachSheet((worksheet) => {
        const rows = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
            rows.push(row.values.slice(1)); // slice(1) removes ExcelJS's 1-based index placeholder
        });

        if (rows.length === 0) return;

        let sheetText = `## ${worksheet.name}\n\n`;

        // Detect if the first row looks like headers
        const firstRow = rows[0];
        const hasHeaders =
            firstRow.every((cell) => {
                const val = cell != null ? String(cell) : '';
                return val.length > 0 && val.length < 200;
            }) && rows.length > 1;

        if (hasHeaders) {
            const headers = firstRow.map((h) => (h != null ? String(h).trim() : ''));
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (row.every((cell) => !cell && cell !== 0)) continue;
                for (let c = 0; c < headers.length; c++) {
                    const val = row[c] != null ? String(row[c]).trim() : '';
                    if (val) sheetText += `${headers[c]}: ${val}\n`;
                }
                sheetText += '\n';
            }
        } else {
            for (const row of rows) {
                const line = row
                    .map((cell) => (cell != null ? String(cell).trim() : ''))
                    .filter(Boolean)
                    .join(' | ');
                if (line) sheetText += line + '\n';
            }
        }

        sheets.push(sheetText);
    });

    return { text: sheets.join('\n\n'), type: 'xlsx' };
}

async function parseTxt(file) {
    const text = await file.text();
    return { text, type: 'txt' };
}
