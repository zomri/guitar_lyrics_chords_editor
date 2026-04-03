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
        `<span class="cell"><span class="chord-slot">${chord}</span><span class="glyph">${escapeHtml(glyph)}</span></span>`,
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

/**
 * @param {{ lyrics: string; chords: Record<string, string>; dir: string; kind?: string }[]} snapshots
 * @param {{ chordMinHeight: number; lyricMinHeight: number; chordFontSize: number; lyricFontSize: number; useMonospace: boolean }} cfg
 * @param {{ title?: string }} options
 */
export function buildPublishDocument(snapshots, cfg, options = {}) {
  const title = escapeHtml(options.title?.trim() || 'Lyrics & chords');
  const fontFamily = cfg.useMonospace ? monoStack() : systemStack();
  const blocks = snapshots
    .map((row) => {
      const lyricDir = row.dir === 'rtl' ? 'rtl' : 'ltr';
      if (row.kind === 'header') {
        const inner = renderHeaderLine(row.lyrics ?? '', cfg);
        return `<section class="block header-block" dir="${lyricDir}">${inner}</section>`;
      }
      const inner = renderLyricsWithChords(row.lyrics ?? '', row.chords ?? {}, cfg);
      return `<section class="block" dir="${lyricDir}">${inner}</section>`;
    })
    .join('\n');

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
    .block {
      margin-bottom: 0.75rem;
      page-break-inside: avoid;
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
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      min-height: calc(${cfg.chordMinHeight}px + 1em);
      margin-bottom: 0.15rem;
    }
    .cell {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      vertical-align: bottom;
    }
    .chord-slot {
      min-height: ${cfg.chordMinHeight}px;
      font-size: ${cfg.chordFontSize}px;
      font-weight: 600;
      color: #9a3412;
      white-space: nowrap;
      line-height: 1.1;
      padding-bottom: 0.1rem;
    }
    .glyph {
      font-family: inherit;
      white-space: pre;
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
    }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <main>
${blocks}
  </main>
</body>
</html>`;
}

export function downloadTextFile(content, filename, mime = 'text/html;charset=utf-8') {
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
