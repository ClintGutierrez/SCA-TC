// Compara construcción de HTML con datos sintéticos. No mide pintura ni desplazamiento del navegador.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const count = Number(process.argv[2] || 1815);
if (!Number.isSafeInteger(count) || count < 1 || count > 20000) throw new Error('Indica entre 1 y 20000 bienes sintéticos');
const file = new URL('../src/components/InventarioList.jsx', import.meta.url);
const { code } = await transform(await fs.readFile(file, 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' });
let inventoryUtils;
try { inventoryUtils = await import('../src/utils/inventario.js'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const module = { exports: {} };
const tableModule = { exports: {} };
const tableFile = new URL('../src/components/InventarioTabla.jsx', import.meta.url);
const tableCode = await transform(await fs.readFile(tableFile, 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' });
new Function('require', 'module', 'exports', tableCode.code)(require, tableModule, tableModule.exports);
new Function('require', 'module', 'exports', code)((name) => {
  if (name.endsWith('.css')) return {};
  if (name === './InventarioTabla') return tableModule.exports;
  if (name === './Select') return { default: ({ children, searchable, searchPlaceholder, ...props }) => React.createElement('select', props, children), __esModule: true };
  if (name === '../services/api') return {};
  if (name === '../utils/inventario') return inventoryUtils;
  return require(name);
}, module, module.exports);
const bienes = Array.from({ length: count }, (_, index) => ({
  id: index + 1, codigo_patrimonial: `PRUEBA-${index}`, nombre: `Laptop de prueba ${index}`,
  tipo: 'laptop', marca: 'Marca', modelo: 'Modelo', numero_serie: `SERIE-${index}`,
  costo: '2500.00', fecha_adquisicion: '2024-01-01', estado: 'activo',
  especificaciones: JSON.stringify({ procesador: 'Intel Core i5', ram_capacidad: '16 GB', disco_tipo: 'SSD' }),
  detalles: { procesador: 'Intel Core i5', ram: '16 GB', almacenamiento: '512 GB' },
}));
const render = () => renderToStaticMarkup(React.createElement(module.exports.default, {
  bienes, onRefresh: () => {}, canCreate: false, canEdit: true, canDelete: true,
}));
render();
const times = []; let html;
for (let run = 0; run < 3; run++) { const start = performance.now(); html = render(); times.push(performance.now() - start); }
const body = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] || '';
console.log(JSON.stringify({ synthetic_assets: count, rendered_rows: (body.match(/<tr\b/g) || []).length,
  html_bytes: Buffer.byteLength(html), median_ssr_ms: Math.round(times.sort((a, b) => a - b)[1]),
  measurement: 'HTML construction only; not browser scrolling or paint' }));
