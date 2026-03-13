// ========================================================================
// IndexedDB service using idb
// ========================================================================
import { openDB } from 'idb';

const DB_NAME = 'rfp-response-library';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Responses store
                if (!db.objectStoreNames.contains('responses')) {
                    const responseStore = db.createObjectStore('responses', { keyPath: 'id' });
                    responseStore.createIndex('category', 'category', { unique: false });
                    responseStore.createIndex('sourceFile', 'sourceFile', { unique: false });
                    responseStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                // Documents store
                if (!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents', { keyPath: 'id' });
                }
                // Categories store
                if (!db.objectStoreNames.contains('categories')) {
                    db.createObjectStore('categories', { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
}

// ---- Responses ----

export async function addResponses(responses) {
    const db = await getDB();
    const tx = db.transaction('responses', 'readwrite');
    for (const r of responses) {
        await tx.store.put(r);
    }
    await tx.done;
}

export async function getAllResponses() {
    const db = await getDB();
    return db.getAll('responses');
}

export async function getResponseById(id) {
    const db = await getDB();
    return db.get('responses', id);
}

export async function updateResponse(response) {
    const db = await getDB();
    return db.put('responses', response);
}

export async function deleteResponse(id) {
    const db = await getDB();
    return db.delete('responses', id);
}

export async function deleteResponsesByDocument(documentId) {
    const db = await getDB();
    const all = await db.getAll('responses');
    const tx = db.transaction('responses', 'readwrite');
    for (const r of all) {
        if (r.documentId === documentId) {
            await tx.store.delete(r.id);
        }
    }
    await tx.done;
}

export async function getResponsesByCategory(category) {
    const db = await getDB();
    return db.getAllFromIndex('responses', 'category', category);
}

export async function searchResponses(query) {
    if (!query || !query.trim()) {
        return getAllResponses();
    }
    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    const all = await getAllResponses();
    return all.filter((r) => {
        return searchTerms.every(
            (term) =>
                r.question.toLowerCase().includes(term) ||
                r.answer.toLowerCase().includes(term) ||
                (r.tags && r.tags.some((t) => t.toLowerCase().includes(term))) ||
                (r.category && r.category.toLowerCase().includes(term))
        );
    });
}

// ---- Documents ----

export async function addDocument(doc) {
    const db = await getDB();
    return db.put('documents', doc);
}

export async function getAllDocuments() {
    const db = await getDB();
    return db.getAll('documents');
}

export async function deleteDocument(id) {
    const db = await getDB();
    await deleteResponsesByDocument(id);
    return db.delete('documents', id);
}

// ---- Categories ----

export async function addCategory(category) {
    const db = await getDB();
    return db.put('categories', category);
}

export async function getAllCategories() {
    const db = await getDB();
    return db.getAll('categories');
}

export async function deleteCategory(id) {
    const db = await getDB();
    return db.delete('categories', id);
}

// ---- Utility ----

export async function getStats() {
    const [responses, documents, categories] = await Promise.all([
        getAllResponses(),
        getAllDocuments(),
        getAllCategories(),
    ]);
    return {
        totalResponses: responses.length,
        totalDocuments: documents.length,
        totalCategories: categories.length,
    };
}

export async function exportAllData() {
    const [responses, documents, categories] = await Promise.all([
        getAllResponses(),
        getAllDocuments(),
        getAllCategories(),
    ]);
    return { responses, documents, categories, exportedAt: new Date().toISOString() };
}

export async function importData(data) {
    if (data.responses) await addResponses(data.responses);
    if (data.documents) {
        for (const doc of data.documents) await addDocument(doc);
    }
    if (data.categories) {
        for (const cat of data.categories) await addCategory(cat);
    }
}
