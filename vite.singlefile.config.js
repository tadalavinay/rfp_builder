import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'fs';
import { createRequire } from 'module';

// Plugin: reads pdf.worker.mjs from node_modules and injects it
// into the HTML as a base64 data URL global variable.
function inlinePdfWorkerPlugin() {
  return {
    name: 'inline-pdf-worker',
    enforce: 'post',
    transformIndexHtml(html) {
      try {
        const require = createRequire(import.meta.url);
        const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
        const workerCode = fs.readFileSync(workerPath, 'utf8');
        const base64 = Buffer.from(workerCode).toString('base64');
        const tag = `<script>window.__PDF_WORKER_URL__="data:text/javascript;base64,${base64}";</script>`;
        return html.replace('</head>', `${tag}\n</head>`);
      } catch (e) {
        console.warn('[inline-pdf-worker] Could not inline worker:', e.message);
        return html;
      }
    },
  };
}

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  plugins: [inlinePdfWorkerPlugin(), viteSingleFile()],
  build: {
    outDir: 'standalone',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
