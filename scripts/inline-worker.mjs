// Post-build script: inlines the PDF worker into the HTML as a data URL
// so the self-contained HTML works without a server or CDN.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'standalone');
const htmlPath = path.join(outDir, 'index.html');

// Find the worker file in standalone/assets/
const assetsDir = path.join(outDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const workerFile = files.find(f => f.includes('pdf.worker'));

  if (workerFile) {
    const workerCode = fs.readFileSync(path.join(assetsDir, workerFile), 'utf8');
    const base64 = Buffer.from(workerCode).toString('base64');
    const dataUrl = `data:text/javascript;base64,${base64}`;

    // Inject into the HTML
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace(
      '</head>',
      `<script>window.__PDF_WORKER_URL__="${dataUrl}";</script>\n</head>`
    );
    fs.writeFileSync(htmlPath, html);

    // Clean up separate worker file
    fs.unlinkSync(path.join(assetsDir, workerFile));
    if (fs.readdirSync(assetsDir).length === 0) {
      fs.rmdirSync(assetsDir);
    }

    console.log(`✅ PDF worker inlined (${(workerCode.length / 1024 / 1024).toFixed(1)}MB)`);
  } else {
    console.log('⚠️  No PDF worker file found in assets — it may already be inlined.');
  }
} else {
  console.log('⚠️  No assets directory found — worker may already be inlined.');
}
