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

/**
 * Safely extract text from an ExcelJS cell value.
 * ExcelJS returns rich-text as { richText: [{text:'...'}, ...] },
 * dates as Date objects, formulas as { result }, etc.
 */
function cellToString(val) {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val instanceof Date) return val.toLocaleDateString();
    // Rich text: { richText: [{ text: '...' }, ...] }
    if (val.richText && Array.isArray(val.richText)) {
        return val.richText.map((part) => part.text || '').join('');
    }
    // Formula result
    if (val.result != null) return cellToString(val.result);
    // Hyperlink
    if (val.text) return val.text;
    // Fallback
    return String(val);
}

async function parseExcel(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheets = [];

    workbook.eachSheet((worksheet) => {
        const rows = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
            // row.values is 1-based, slice(1) to get 0-based array
            rows.push(row.values.slice(1).map(cellToString));
        });

        if (rows.length === 0) return;

        let sheetText = `## ${worksheet.name}\n\n`;

        // Detect if the first row looks like headers
        const firstRow = rows[0];
        const hasHeaders =
            firstRow.every((cell) => cell.length > 0 && cell.length < 200) &&
            rows.length > 1;

        if (hasHeaders) {
            const headers = firstRow.map((h) => h.trim());
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (row.every((cell) => !cell)) continue;
                for (let c = 0; c < headers.length; c++) {
                    const val = row[c] ? row[c].trim() : '';
                    if (val) sheetText += `${headers[c]}: ${val}\n`;
                }
                sheetText += '\n';
            }
        } else {
            for (const row of rows) {
                const line = row
                    .map((cell) => cell.trim())
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
