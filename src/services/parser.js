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

/**
 * Convert an HTML element to plain text preserving paragraph breaks.
 */
function htmlCellToText(element) {
    let text = '';
    for (const child of element.childNodes) {
        if (child.nodeType === 3 /* TEXT_NODE */) {
            text += child.textContent;
        } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
            const tag = child.tagName.toLowerCase();
            if (['p', 'br', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                if (text.length > 0 && !text.endsWith('\n')) text += '\n';
            }
            text += htmlCellToText(child);
            if (['p', 'div', 'li', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                if (!text.endsWith('\n')) text += '\n';
            }
        }
    }
    return text;
}

/** Header keywords for detecting question/answer columns. */
const Q_KEYWORDS = ['question', 'query', 'requirement', 'requested information', 'ask', 'information requested'];
const A_KEYWORDS = ['answer', 'response', 'vendor response', 'reply', 'vendor answer', 'comment'];

async function parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table');
    let text = '';

    if (tables.length > 0) {
        for (const table of tables) {
            const allRows = [...table.querySelectorAll('tr')];
            if (allRows.length === 0) continue;

            // Detect headers from first row
            const headerCells = [...allRows[0].querySelectorAll('th, td')];
            const headers = headerCells.map((c) => c.textContent.trim());
            const qIdx = headers.findIndex((h) => Q_KEYWORDS.some((k) => h.toLowerCase().includes(k)));
            const aIdx = headers.findIndex((h) => A_KEYWORDS.some((k) => h.toLowerCase().includes(k)));

            const startRow = headers.length > 0 ? 1 : 0;

            for (let i = startRow; i < allRows.length; i++) {
                const cells = [...allRows[i].querySelectorAll('td')];
                if (cells.length === 0) continue;

                if (qIdx !== -1 && aIdx !== -1) {
                    const q = htmlCellToText(cells[qIdx] || cells[0]).trim();
                    const a = htmlCellToText(cells[aIdx] || cells[cells.length - 1]).trim();
                    if (!q && !a) continue;
                    if (q) text += `Q: ${q}\n`;
                    if (a) text += `A: ${a}\n`;
                    // Extra columns as context
                    for (let c = 0; c < cells.length; c++) {
                        if (c === qIdx || c === aIdx) continue;
                        const val = htmlCellToText(cells[c]).trim();
                        if (val && headers[c]) text += `${headers[c]}: ${val}\n`;
                    }
                    text += '\n';
                } else {
                    // No Q/A headers detected — output all cells
                    for (let c = 0; c < cells.length; c++) {
                        const header = headers[c] || `Column ${c + 1}`;
                        const val = htmlCellToText(cells[c]).trim();
                        if (val) text += `${header}: ${val}\n`;
                    }
                    text += '\n';
                }
            }
        }

        // Also extract non-table content
        tables.forEach((t) => t.remove());
        const remaining = doc.body.textContent.trim();
        if (remaining) text = remaining + '\n\n' + text;
    } else {
        // No tables — fallback to plain text extraction
        text = doc.body.textContent || '';
    }

    return { text: text.trim(), type: 'docx' };
}

/**
 * Clean PDF-extracted text: fix ligature encoding issues and stray characters.
 * Many PDFs use custom font encodings where ligatures like "ti", "ft", "fi"
 * are mapped to non-standard characters (Θ, Ō, etc.).
 */
function cleanPdfText(text) {
    return text
        // Standard Unicode ligatures → ASCII
        .replace(/\uFB01/g, 'fi')
        .replace(/\uFB02/g, 'fl')
        .replace(/\uFB00/g, 'ff')
        .replace(/\uFB03/g, 'ffi')
        .replace(/\uFB04/g, 'ffl')
        .replace(/\uFB05/g, 'st')
        .replace(/\uFB06/g, 'st')
        // Custom font ligature: Θ (theta) — try "ti" or "t" depending on context
        .replace(/(\S)\s*Θ\s*(\S)/g, (m, before, after) => {
            // If followed by a vowel-like continuation, likely "ti" (e.g., "Solu_Θ_on" → "Solution")
            if (/[oeianu]/.test(after.toLowerCase())) return before + 'ti' + after;
            // Otherwise just "t" (e.g., "sta_Θ_e" → "state")
            return before + 't' + after;
        })
        // Standalone Θ (no surrounding word chars matched above)
        .replace(/Θ/g, 'ti')
        // Custom font ligature: Ō commonly mapped for "ft"
        .replace(/(\S)\s*Ō\s*(\S)/g, '$1ft$2')
        .replace(/Ō/g, 'ft')
        // Collapse runs of 3+ spaces to a single space
        .replace(/ {3,}/g, ' ')
        .trim();
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

        let pageText = '';
        let lastY = null;
        let lastItemHeight = 12;

        for (const item of content.items) {
            if (!item.str && !item.hasEOL) continue;

            const y = item.transform ? item.transform[5] : null;
            const h = item.height || lastItemHeight;

            if (lastY !== null && y !== null) {
                const gap = Math.abs(lastY - y);
                if (gap > h * 1.8) {
                    // Large Y gap → paragraph break
                    pageText += '\n\n';
                } else if (gap > h * 0.3) {
                    // Small Y gap → line break
                    pageText += '\n';
                } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
                    pageText += ' ';
                }
            }

            pageText += item.str;
            if (y !== null) lastY = y;
            if (item.height) lastItemHeight = item.height;
        }

        pages.push(pageText.trim());
    }

    return { text: cleanPdfText(pages.join('\n\n')), type: 'pdf' };
}

/**
 * Safely extract text from an ExcelJS cell value.
 * ExcelJS can return: strings, numbers, booleans, Date objects,
 * rich-text { richText: [...] }, formulas { formula, result },
 * hyperlinks { text, hyperlink }, errors { error }, shared strings, etc.
 * This function NEVER returns '[object Object]'.
 */
function cellToString(val) {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val instanceof Date) return val.toLocaleDateString();
    if (typeof val !== 'object') return String(val);

    // Rich text: { richText: [{ text: '...' }, ...] }
    if (val.richText && Array.isArray(val.richText)) {
        return val.richText.map((part) => (part && part.text) || '').join('');
    }
    // Formula: { formula: '...', result: ... }
    if (val.result !== undefined) return cellToString(val.result);
    // Hyperlink: { text: '...', hyperlink: '...' }
    if (val.text != null) return cellToString(val.text);
    // Error: { error: '#REF!' }
    if (val.error) return '';
    // SharedString or other object with a value property
    if (val.value !== undefined) return cellToString(val.value);

    // Last resort: recursively extract all string/number values from object
    const parts = [];
    for (const v of Object.values(val)) {
        if (typeof v === 'string' && v.length > 0) parts.push(v);
        else if (typeof v === 'number') parts.push(String(v));
        else if (v && typeof v === 'object' && !Array.isArray(v)) {
            const nested = cellToString(v);
            if (nested) parts.push(nested);
        } else if (Array.isArray(v)) {
            for (const item of v) {
                const nested = cellToString(item);
                if (nested) parts.push(nested);
            }
        }
    }
    return parts.join('');
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

            // Detect question and answer column indices
            const qKeywords = ['question', 'query', 'requirement', 'ask'];
            const aKeywords = ['answer', 'response', 'vendor response', 'reply', 'vendor answer', 'comment'];
            const qIdx = headers.findIndex((h) => qKeywords.some((k) => h.toLowerCase().includes(k)));
            const aIdx = headers.findIndex((h) => aKeywords.some((k) => h.toLowerCase().includes(k)));

            if (qIdx !== -1 && aIdx !== -1) {
                // Structured Q&A mode — output as explicit Q/A pairs
                for (let r = 1; r < rows.length; r++) {
                    const row = rows[r];
                    const question = row[qIdx] ? row[qIdx].trim() : '';
                    const answer = row[aIdx] ? row[aIdx].trim() : '';
                    if (!question && !answer) continue;

                    if (question) sheetText += `Q: ${question}\n`;
                    if (answer) sheetText += `A: ${answer}\n`;

                    // Append other columns as additional context
                    for (let c = 0; c < headers.length; c++) {
                        if (c === qIdx || c === aIdx) continue;
                        const val = row[c] ? row[c].trim() : '';
                        if (val) sheetText += `${headers[c]}: ${val}\n`;
                    }
                    sheetText += '\n';
                }
            } else {
                // Generic header: value mode
                for (let r = 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (row.every((cell) => !cell)) continue;
                    for (let c = 0; c < headers.length; c++) {
                        const val = row[c] ? row[c].trim() : '';
                        if (val) {
                            // For multi-line values, put header on its own line
                            if (val.includes('\n')) {
                                sheetText += `${headers[c]}:\n${val}\n`;
                            } else {
                                sheetText += `${headers[c]}: ${val}\n`;
                            }
                        }
                    }
                    sheetText += '\n';
                }
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
