// ========================================================================
// Export service — JSON, CSV, Markdown
// ========================================================================

/**
 * Export responses as a JSON file download.
 */
export function exportAsJSON(data, filename = 'rfp-library-export.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, filename);
}

/**
 * Export responses as CSV.
 */
export function exportAsCSV(responses, filename = 'rfp-library-export.csv') {
    const headers = ['Question', 'Answer', 'Category', 'Tags', 'Source File', 'Created At'];
    const rows = responses.map((r) => [
        csvEscape(r.question),
        csvEscape(r.answer),
        csvEscape(r.category || ''),
        csvEscape((r.tags || []).join('; ')),
        csvEscape(r.sourceFile || ''),
        csvEscape(r.createdAt || ''),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, filename);
}

/**
 * Export responses as Markdown.
 */
export function exportAsMarkdown(responses, filename = 'rfp-library-export.md') {
    let md = '# RFP Response Library\n\n';
    md += `*Exported on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

    // Group by category
    const grouped = {};
    for (const r of responses) {
        const cat = r.category || 'Uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(r);
    }

    for (const [category, items] of Object.entries(grouped)) {
        md += `## ${category}\n\n`;
        for (const item of items) {
            md += `### ${item.question}\n\n`;
            md += `${item.answer}\n\n`;
            if (item.tags && item.tags.length > 0) {
                md += `**Tags:** ${item.tags.join(', ')}\n\n`;
            }
            md += `---\n\n`;
        }
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, filename);
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
    }
}

// ---- Helpers ----

function csvEscape(str) {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""').replace(/\n/g, ' ');
    return `"${escaped}"`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
