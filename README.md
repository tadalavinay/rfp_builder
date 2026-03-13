# RFP Response Library

A modern, browser-based application for building and managing a searchable library of RFP (Request for Proposal) responses. Upload past RFP documents, automatically extract Q&A pairs, and quickly reuse answers for future proposals.

## ✨ Features

- **Multi-Format Upload** — Drag & drop or browse to upload DOCX, PDF, Excel (XLSX/XLS), TXT, Markdown, and CSV files.
- **Automatic Extraction** — Parses uploaded documents and extracts question-answer pairs into a structured library.
- **Searchable Library** — Smart, offline full-text search powered by Lunr.js (supports stemming, fuzzy matching, and relevance scoring).
- **Categories & Tags** — Organize responses by category and tag for quick filtering.
- **Inline Editing** — Edit questions, answers, categories, and tags directly from the library.
- **Copy to Clipboard** — One-click copy of any answer for pasting into new proposals.
- **Export** — Export your library as JSON (full backup), CSV (spreadsheet), or Markdown.
- **Document Management** — Track all uploaded source documents with metadata.
- **Offline-First** — All data is stored locally in the browser using IndexedDB. No server required.
- **Responsive Design** — Works on desktop and mobile with a collapsible sidebar.

## 🛠 Tech Stack

| Layer       | Technology                                   |
| ----------- | -------------------------------------------- |
| Build Tool  | [Vite](https://vitejs.dev/)                  |
| Language    | Vanilla JavaScript (ES Modules)              |
| Styling     | Vanilla CSS with custom properties           |
| Storage     | IndexedDB via [idb](https://github.com/nicedoc/idb) |
| PDF Parsing | [pdfjs-dist](https://github.com/nicedoc/pdfjs-dist) |
| DOCX Parsing| [mammoth](https://github.com/nicedoc/mammoth) |
| Excel Parsing| [ExcelJS](https://github.com/exceljs/exceljs)       |
| Search Engine| [Lunr.js](https://lunrjs.com/)               |
| Typography  | [Inter](https://rsms.me/inter/) via Google Fonts |

## 📁 Project Structure

```
rfp_builder/
├── index.html                  # App entry HTML
├── package.json
├── vite.config.js              # Dev & standard build config
├── vite.singlefile.config.js   # Self-contained HTML build config
├── scripts/
│   └── inline-worker.mjs       # PDF worker inlining script
└── src/
    ├── main.js                 # App shell, routing, sidebar
    ├── index.css               # Global styles & design tokens
    ├── components/
    │   ├── icons.js            # SVG icon library
    │   ├── modal.js            # Reusable modal component
    │   └── toast.js            # Toast notification component
    ├── services/
    │   ├── db.js               # IndexedDB data layer (CRUD)
    │   ├── parser.js           # File parsing (DOCX, PDF, Excel, TXT)
    │   ├── extractor.js        # Q&A pair extraction logic
    │   └── export.js           # Export to JSON / CSV / Markdown
    └── views/
        ├── upload.js           # Upload view (drag & drop)
        ├── library.js          # Response library (search, filter, edit)
        ├── categories.js       # Category management
        └── documents.js        # Uploaded document management
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm (included with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/tadalavinay/rfp_builder.git
cd rfp_builder

# Install dependencies
npm install
```

### Development

```bash
# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173` (default Vite port).

### Production Build

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

The optimized output will be in the `dist/` directory.

### 📦 Portable Single-File Build

Create a **self-contained HTML file** that works anywhere — just double-click to open. No server, no Python, no command line needed.

```bash
npm run build:single
```

This generates `rfp-library.html` in the project root (~7MB). Copy this single file to any computer (Windows, Mac, Linux) and open it directly in a browser. All features work offline, including PDF, DOCX, and Excel file parsing.

> **Note:** Data is stored locally in the browser's IndexedDB. To move data between machines, use **Export** (JSON) on one machine and upload it on the other.

## 📖 Usage

1. **Upload Documents** — Navigate to the **Upload** tab and drag & drop your past RFP response files (DOCX, PDF, XLSX, TXT).
2. **Browse Library** — Switch to the **Response Library** tab to see all extracted Q&A pairs.
3. **Search & Filter** — Use the search bar to find specific responses, or click category chips to filter.
4. **Copy & Reuse** — Click the copy icon on any response card to copy the answer to your clipboard.
5. **Edit & Organize** — Click the edit icon to modify questions, answers, categories, or tags.
6. **Export** — Click the **Export** button to download your library as JSON, CSV, or Markdown.

## 📄 License

This project is for personal use.
