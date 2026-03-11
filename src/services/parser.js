// ========================================================================
// File parser — DOCX, PDF, TXT, Excel
// ========================================================================
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

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

    // Set the worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
    ).toString();

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
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheets = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        // Convert to array-of-arrays for structured extraction
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length === 0) continue;

        let sheetText = `## ${sheetName}\n\n`;

        // Detect if the first row looks like headers
        const firstRow = rows[0];
        const hasHeaders = firstRow.every(
            (cell) => typeof cell === 'string' && cell.length > 0 && cell.length < 200
        );

        if (hasHeaders && rows.length > 1) {
            // Structured: use headers as question keys
            const headers = firstRow.map((h) => String(h).trim());
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                // Skip completely empty rows
                if (row.every((cell) => !cell && cell !== 0)) continue;
                for (let c = 0; c < headers.length; c++) {
                    const val = row[c] != null ? String(row[c]).trim() : '';
                    if (val) {
                        sheetText += `${headers[c]}: ${val}\n`;
                    }
                }
                sheetText += '\n';
            }
        } else {
            // Unstructured: just join all cells
            for (const row of rows) {
                const line = row
                    .map((cell) => (cell != null ? String(cell).trim() : ''))
                    .filter(Boolean)
                    .join(' | ');
                if (line) sheetText += line + '\n';
            }
        }

        sheets.push(sheetText);
    }

    return { text: sheets.join('\n\n'), type: 'xlsx' };
}

async function parseTxt(file) {
    const text = await file.text();
    return { text, type: 'txt' };
}
