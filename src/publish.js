import { normalizeChordMap } from './chordMap.js';

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function monoStack() {
  return String.raw`ui-monospace, "Cascadia Mono", "Segoe UI Mono", "Noto Sans Mono", "Liberation Mono", monospace`;
}

function systemStack() {
  return String.raw`system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
}

function renderLyricsWithChords(lyrics, chordMap, cfg) {
  const ch = normalizeChordMap(chordMap);
  const lines = lyrics.split('\n');
  const parts = [];
  let offset = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const cells = [];
    for (let i = 0; i < line.length; i++) {
      const idx = offset + i;
      const glyph = line[i];
      const chord = ch[idx] ? escapeHtml(ch[idx]) : '';
      cells.push(
        chord
          ? `<span class="cell"><span class="chord-slot">${chord}</span><span class="glyph">${escapeHtml(glyph)}</span></span>`
          : `<span class="cell"><span class="glyph">${escapeHtml(glyph)}</span></span>`,
      );
    }
    parts.push(`<div class="line">${cells.join('')}</div>`);
    offset += line.length;
    if (li < lines.length - 1) offset += 1;
  }
  if (parts.length === 0) {
    parts.push('<div class="line"></div>');
  }
  return `<div class="lyric-with-chords" style="font-size:${cfg.lyricFontSize}px">${parts.join('')}</div>`;
}

function renderHeaderLine(text, cfg) {
  const safe = escapeHtml((text || '').trim() || 'Section');
  return `<div class="header-line" style="font-size:${cfg.lyricFontSize}px">${safe}</div>`;
}

function renderChordsOnly(chords, fallbackText, cfg) {
  const normalized = normalizeChordMap(chords);
  let sorted = Object.entries(normalized)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, v]) => `<span class="chord-name">${escapeHtml(v)}</span>`);

  // Fallback for rows where users typed chord progression as plain text.
  if (sorted.length === 0) {
    const fromText = String(fallbackText || '')
      .split(/\r?\n/)
      .flatMap((line) => line.trim().split(/\s+/))
      .filter(Boolean)
      .map((v) => `<span class="chord-name">${escapeHtml(v)}</span>`);
    sorted = fromText;
  }

  if (sorted.length === 0) return '<div class="chord-progression"></div>';
  return `<div class="chord-progression">${sorted.join('')}</div>`;
}

function renderRowBlock(row, cfg) {
  const lyricDir = row.dir === 'rtl' ? 'rtl' : 'ltr';
  if (row.kind === 'header') {
    const inner = renderHeaderLine(row.lyrics ?? '', cfg);
    return `<section class="block header-block" dir="${lyricDir}">${inner}</section>`;
  }
  if (row.kind === 'chords') {
    const inner = renderChordsOnly(row.chords ?? {}, row.lyrics ?? '', cfg);
    return `<section class="block chords-block" dir="${lyricDir}">${inner}</section>`;
  }
  const inner = renderLyricsWithChords(row.lyrics ?? '', row.chords ?? {}, cfg);
  return `<section class="block" dir="${lyricDir}">${inner}</section>`;
}

function buildSectionsFromSnapshots(snapshots) {
  const sections = [];
  let current = null;
  let unnamedCount = 0;

  const pushCurrent = () => {
    if (current) sections.push(current);
    current = null;
  };

  for (let i = 0; i < snapshots.length; i += 1) {
    const row = snapshots[i] || {};
    const kind = row.kind === 'header' || row.kind === 'chords' ? row.kind : 'line';
    const sectionEnd = row.sectionEnd === true;
    const safeRow = { ...row, kind, sectionEnd };

    if (kind === 'header') {
      pushCurrent();
      const name = String(row.lyrics || '').trim().split(/\r?\n/)[0] || `Section ${sections.length + 1}`;
      current = {
        id: `h:${i}`,
        title: name,
        rows: [safeRow],
      };
      continue;
    }

    if (!current) {
      unnamedCount += 1;
      current = {
        id: `u:${i}:${unnamedCount}`,
        title: `Section ${sections.length + 1}`,
        rows: [],
      };
    }
    current.rows.push(safeRow);
    if (sectionEnd) {
      pushCurrent();
    }
  }
  pushCurrent();
  return sections;
}

/**
 * @param {{ lyrics: string; chords: Record<string, string>; dir: string; kind?: string }[]} snapshots
 * @param {{ chordMinHeight: number; lyricMinHeight: number; chordFontSize: number; lyricFontSize: number; useMonospace: boolean }} cfg
 * @param {{ title?: string }} options
 */
export function buildPublishDocument(snapshots, cfg, options = {}) {
  const rawTitle = String(options.title?.trim() || 'Lyrics & chords');
  const title = escapeHtml(rawTitle);
  const isHebrewTitle = /[\u0590-\u05FF]/.test(rawTitle);
  const titleClass = isHebrewTitle ? 'title-rtl' : 'title-ltr';
  const titleDir = isHebrewTitle ? 'rtl' : 'ltr';
  const fontFamily = cfg.useMonospace ? monoStack() : systemStack();
  const layoutCols = Math.min(3, Math.max(1, Number(options?.layout?.columns) || 1));
  const layoutOrder = Array.isArray(options?.layout?.order) ? options.layout.order : [];
  const layoutPages = Array.isArray(options?.layout?.pages) ? options.layout.pages : null;
  const sections = buildSectionsFromSnapshots(Array.isArray(snapshots) ? snapshots : []);
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const orderedSections = [
    ...layoutOrder.map((id) => sections.find((s) => s.id === id)).filter(Boolean),
    ...sections.filter((s) => !layoutOrder.includes(s.id)),
  ];

  const blocks = (() => {
    if (layoutCols <= 1) {
      return orderedSections
        .map((s) => `<section class="layout-section">${s.rows.map((r) => renderRowBlock(r, cfg)).join('')}</section>`)
        .join('\n');
    }

    if (layoutPages && layoutPages.length > 0) {
      const used = new Set();
      const pagesHtml = layoutPages
        .map((page) => {
          const cols = Array.isArray(page?.columns) ? page.columns : [];
          const colsHtml = cols
            .slice(0, layoutCols)
            .map((col) => {
              const ids = Array.isArray(col) ? col : [];
              const items = ids
                .map((id) => sectionById.get(id))
                .filter(Boolean)
                .map((s) => {
                  used.add(s.id);
                  return `<section class="layout-section">${s.rows.map((r) => renderRowBlock(r, cfg)).join('')}</section>`;
                })
                .join('');
              return `<div class="layout-col">${items}</div>`;
            })
            .join('');
          return `<section class="layout-page"><div class="layout-columns cols-${layoutCols}">${colsHtml}</div></section>`;
        })
        .join('');

      const leftovers = orderedSections
        .filter((s) => !used.has(s.id))
        .map((s) => `<section class="layout-section">${s.rows.map((r) => renderRowBlock(r, cfg)).join('')}</section>`)
        .join('');

      if (leftovers) {
        return `${pagesHtml}<section class="layout-page"><div class="layout-columns cols-${layoutCols}"><div class="layout-col">${leftovers}</div></div></section>`;
      }
      return pagesHtml;
    }

    return `<div class="layout-grid cols-${layoutCols}">${orderedSections
      .map((s) => `<section class="layout-section">${s.rows.map((r) => renderRowBlock(r, cfg)).join('')}</section>`)
      .join('')}</div>`;
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 1.25rem 1.5rem 2rem;
      font-family: ${fontFamily};
      background: #fff;
      color: #111;
      line-height: 1.4;
    }
    h1 {
      font-family: system-ui, "Segoe UI", sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 1.25rem;
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.5rem;
    }
    h1.title-ltr {
      text-align: left;
      direction: ltr;
    }
    h1.title-rtl {
      text-align: right;
      direction: rtl;
    }
    .block {
      margin-bottom: 0.75rem;
      page-break-inside: avoid;
    }
    .layout-grid {
      display: grid;
      gap: 0.7rem 1rem;
      align-items: start;
      direction: ltr;
    }
    .layout-columns {
      display: grid;
      gap: 0.7rem 1rem;
      align-items: start;
      direction: ltr;
    }
    .layout-grid.cols-2 { grid-template-columns: 1fr 1fr; }
    .layout-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .layout-columns.cols-2 { grid-template-columns: 1fr 1fr; }
    .layout-columns.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .layout-page {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 0.5rem;
    }
    .layout-col {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .layout-section {
      page-break-inside: avoid;
      break-inside: avoid;
      padding: 0;
      background: transparent;
    }
    .header-block {
      margin-top: 0.25rem;
      margin-bottom: 0.4rem;
    }
    .header-line {
      display: inline-block;
      font-family: system-ui, "Segoe UI", sans-serif;
      font-weight: 700;
      color: #1d4ed8;
      border-bottom: 2px solid #93c5fd;
      padding-bottom: 0.05rem;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .lyric-with-chords {
      min-height: ${cfg.lyricMinHeight}px;
      color: #111;
    }
    .line {
      position: relative;
      padding-top: ${cfg.chordMinHeight}px;
      margin-bottom: 0.25rem;
    }
    .cell {
      display: inline-block;
      position: relative;
      vertical-align: top;
    }
    .chord-slot {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      font-size: ${cfg.chordFontSize}px;
      font-weight: 600;
      color: #9a3412;
      line-height: 1.1;
    }
    .glyph {
      font-family: inherit;
      white-space: pre;
      line-height: 1.4;
    }
    .chords-block {
      margin-bottom: 0.5rem;
    }
    .chord-progression {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 1.75rem;
      padding: 0.15rem 0 0.25rem;
      font-size: ${cfg.chordFontSize}px;
      font-weight: 600;
      color: #9a3412;
    }
    .chord-name {
      white-space: nowrap;
    }
    @media print {
      body {
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      h1 { border-bottom-color: #999; }
      .chord-slot {
        color: #9a3412;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .header-line {
        color: #1d4ed8;
        border-bottom-color: #93c5fd;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .layout-grid {
        break-inside: auto;
      }
      .layout-section {
        break-inside: avoid;
      }
    }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <h1 class="${titleClass}" dir="${titleDir}">${title}</h1>
  <main>
${blocks}
  </main>
</body>
</html>`;
}

export function downloadTextFile(content, filename, mime = 'text/html;charset=utf-8') {
  if (globalThis.desktopAPI?.saveFile) {
    const filters = mime.includes('json')
      ? [{ name: 'JSON', extensions: ['json'] }]
      : [{ name: 'HTML', extensions: ['html', 'htm'] }];
    globalThis.desktopAPI
      .saveFile({
        defaultPath: filename,
        content,
        filters,
      })
      .catch((err) => {
        alert(`Failed to save file: ${err?.message || err}`);
      });
    return;
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function openPrintWindow(html) {
  if (globalThis.desktopAPI?.exportPdf) {
    console.log('Desktop PDF export path active');
    const m = String(html || '').match(/<title>([^<]+)<\/title>/i);
    const title = (m?.[1] || 'lyrics-chords').trim().replace(/[\\/:*?"<>|]/g, '');
    const defaultPath = `${title || 'lyrics-chords'}.pdf`;
    globalThis.desktopAPI
      .exportPdf({ html, defaultPath })
      .then((res) => {
        if (!res?.ok && !res?.canceled) {
          alert(`Save PDF failed: ${res?.error || 'Unknown error'}`);
        }
      })
      .catch((err) => {
        alert(`Save PDF failed: ${err?.message || err}`);
      });
    return;
  }

  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, '_blank');
    if (!w) {
      URL.revokeObjectURL(blobUrl);
      alert('Pop-up blocked. Allow pop-ups for this site to print, or use Download HTML instead.');
      return;
    }
    const runPrint = () => {
      try {
        w.focus();
        // Small delay to ensure page is fully rendered
        setTimeout(() => {
          w.print();
        }, 250);
      } catch (e) {
        console.error('Error calling print:', e);
      }
    };
    // Try printing on load event
    w.addEventListener('load', () => {
      setTimeout(runPrint, 200);
    });
    // Also try after a fixed delay in case load event doesn't fire
    setTimeout(() => {
      if (w && !w.closed) {
        runPrint();
      }
    }, 1000);
  } catch (err) {
    alert('Error opening print window: ' + err.message);
  }
}

export function openPreviewWindow(html) {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, '_blank');
    if (!w) {
      URL.revokeObjectURL(blobUrl);
      alert('Pop-up blocked. Allow pop-ups for this site to preview HTML.');
      return;
    }
    // Revoke shortly after the new tab has consumed the blob URL.
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 3000);
  } catch (err) {
    alert('Error opening preview window: ' + err.message);
  }
}
