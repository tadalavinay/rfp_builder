// ========================================================================
// Response extractor — extracts Q&A pairs and sections from raw text
// ========================================================================

/**
 * Generate a unique ID
 */
function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Categorize a question/answer pair based on keyword matching.
 */
const CATEGORY_KEYWORDS = {
    'Company Overview': [
        'company', 'organization', 'about us', 'founded', 'history', 'mission',
        'vision', 'overview', 'background', 'profile', 'corporate',
    ],
    'Technical Capabilities': [
        'technical', 'technology', 'platform', 'architecture', 'infrastructure',
        'software', 'hardware', 'system', 'tool', 'integration', 'api',
        'cloud', 'devops', 'development', 'engineering',
    ],
    'Experience & References': [
        'experience', 'reference', 'portfolio', 'case study', 'client',
        'customer', 'project', 'engagement', 'past performance', 'track record',
    ],
    'Compliance & Security': [
        'compliance', 'security', 'regulation', 'certification', 'audit',
        'privacy', 'gdpr', 'hipaa', 'sox', 'iso', 'risk', 'governance',
        'encryption', 'data protection',
    ],
    'Pricing & Commercial': [
        'pricing', 'cost', 'fee', 'rate', 'budget', 'commercial', 'financial',
        'invoice', 'payment', 'discount', 'license', 'subscription',
    ],
    'Team & Staffing': [
        'team', 'staff', 'personnel', 'resource', 'role', 'qualification',
        'certification', 'training', 'resume', 'bio', 'expert',
    ],
    'Methodology & Approach': [
        'methodology', 'approach', 'process', 'framework', 'strategy',
        'agile', 'waterfall', 'scrum', 'plan', 'phase', 'roadmap',
        'implementation', 'delivery', 'timeline', 'schedule', 'milestone',
    ],
    'Support & Maintenance': [
        'support', 'maintenance', 'sla', 'service level', 'help desk',
        'warranty', 'upgrade', 'patch', 'incident', 'escalation',
    ],
};

function categorize(text) {
    const lower = text.toLowerCase();
    let bestCategory = 'General';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        let score = 0;
        for (const kw of keywords) {
            if (lower.includes(kw)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    return bestCategory;
}

/**
 * Extract suggested tags from text.
 */
function extractTags(text) {
    const tags = new Set();
    const lower = text.toLowerCase();

    const TAG_PATTERNS = [
        'cloud', 'aws', 'azure', 'gcp', 'saas', 'paas', 'api', 'rest',
        'agile', 'scrum', 'devops', 'ci/cd', 'kubernetes', 'docker',
        'machine learning', 'ai', 'data analytics', 'big data',
        'cybersecurity', 'encryption', 'compliance',
        'project management', 'migration', 'implementation',
        'training', 'onboarding', 'change management',
        'sla', '24/7', 'uptime', 'availability',
        'hipaa', 'gdpr', 'sox', 'iso 27001', 'fedramp',
    ];

    for (const tag of TAG_PATTERNS) {
        if (lower.includes(tag)) {
            tags.add(tag.toUpperCase());
        }
    }

    return [...tags].slice(0, 6);
}

/**
 * Extract Q&A pairs from text using various patterns.
 */
export function extractResponses(text, sourceFile, documentId) {
    const entries = [];

    // Strategy 1: Explicit Q&A patterns (Q: / A:, Question: / Answer:)
    const qaRegex = /(?:^|\n)\s*(?:Q(?:uestion)?[\s.:]+\d*[\s.:]*)(.*?)(?:\n\s*(?:A(?:nswer)?[\s.:]+))([\s\S]*?)(?=(?:\n\s*(?:Q(?:uestion)?[\s.:]+))|$)/gi;
    let match;
    while ((match = qaRegex.exec(text)) !== null) {
        const question = match[1].trim();
        const answer = match[2].trim();
        if (question.length > 5 && answer.length > 10) {
            entries.push(createEntry(question, answer, sourceFile, documentId));
        }
    }

    // Strategy 2: Numbered sections (1. Title\nContent, 1.1 Sub-title\nContent)
    if (entries.length < 3) {
        const numberedRegex = /(?:^|\n)\s*(\d+(?:\.\d+)*)[.)]\s+([^\n]+)\n([\s\S]*?)(?=(?:\n\s*\d+(?:\.\d+)*[.)]\s+)|$)/g;
        while ((match = numberedRegex.exec(text)) !== null) {
            const heading = match[2].trim();
            const body = match[3].trim();
            if (heading.length > 3 && body.length > 20) {
                entries.push(createEntry(heading, body, sourceFile, documentId));
            }
        }
    }

    // Strategy 3: Header-body pairs (ALL CAPS header or Title Case header followed by content)
    if (entries.length < 3) {
        const headerRegex = /(?:^|\n)\s*([A-Z][A-Z\s&/,]{4,})\s*\n([\s\S]*?)(?=(?:\n\s*[A-Z][A-Z\s&/,]{4,}\s*\n)|$)/g;
        while ((match = headerRegex.exec(text)) !== null) {
            const heading = match[1].trim();
            const body = match[2].trim();
            if (body.length > 30 && !heading.match(/^page\s+\d+$/i)) {
                entries.push(createEntry(toTitleCase(heading), body, sourceFile, documentId));
            }
        }
    }

    // Strategy 4: Paragraph chunking (fallback — split into ~500 char chunks)
    if (entries.length < 2) {
        const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);

        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i].trim();
            // Try to extract a title from the first line
            const lines = para.split('\n');
            const firstLine = lines[0].trim();
            const rest = lines.slice(1).join('\n').trim();

            if (firstLine.length > 5 && firstLine.length < 200 && rest.length > 20) {
                entries.push(createEntry(firstLine, rest, sourceFile, documentId));
            } else if (para.length > 50) {
                const title = para.substring(0, 80).replace(/[\n\r]/g, ' ').trim() + '...';
                entries.push(createEntry(title, para, sourceFile, documentId));
            }
        }
    }

    return deduplicateEntries(entries);
}

function createEntry(question, answer, sourceFile, documentId) {
    const combined = question + ' ' + answer;
    return {
        id: uid(),
        question: cleanText(question),
        answer: cleanText(answer),
        category: categorize(combined),
        tags: extractTags(combined),
        sourceFile,
        documentId,
        createdAt: new Date().toISOString(),
    };
}

function cleanText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function toTitleCase(str) {
    return str
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function deduplicateEntries(entries) {
    const seen = new Set();
    return entries.filter((e) => {
        const key = e.question.toLowerCase().substring(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
