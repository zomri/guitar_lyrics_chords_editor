import { buildPublishDocument, downloadTextFile, openPrintWindow } from './publish.js';
import { getCaretCoordinates } from './caret.js';
import { findEditRange, remapChordMap, normalizeChordMap } from './chordMap.js';

const STORAGE_V1 = 'lyrics-chords-doc-v1';
const STORAGE_V2 = 'lyrics-chords-doc-v2';
const STORAGE_CFG = 'lyrics-chords-config-v1';
const STORAGE_SONGS = 'lyrics-chords-songs';
const STORAGE_CURRENT_SONG = 'lyrics-chords-current-song';

const defaultConfig = () => ({
  chordMinHeight: 28,
  lyricMinHeight: 40,
  chordFontSize: 13,
  lyricFontSize: 16,
  defaultDirection: 'ltr',
  useMonospace: true,
});

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_CFG);
    if (!raw) return defaultConfig();
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_CFG, JSON.stringify(cfg));
}

function normalizeKind(v) {
  if (v === 'header') return 'header';
  if (v === 'chords') return 'chords';
  return 'line';
}

function loadSongList() {
  try {
    const raw = localStorage.getItem(STORAGE_SONGS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveSongList(list) {
  localStorage.setItem(STORAGE_SONGS, JSON.stringify(list));
}

function saveSong(name, rowData) {
  const key = `song:${name}`;
  localStorage.setItem(key, JSON.stringify(rowData));
}

function loadSong(name) {
  const key = `song:${name}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function deleteSong(name) {
  const key = `song:${name}`;
  localStorage.removeItem(key);
}

function getCurrentSongName() {
  return localStorage.getItem(STORAGE_CURRENT_SONG) || null;
}

function setCurrentSongName(name) {
  if (name == null || name === '') {
    localStorage.removeItem(STORAGE_CURRENT_SONG);
    return;
  }
  localStorage.setItem(STORAGE_CURRENT_SONG, name);
}

function migrateV1ToV2(raw) {
  try {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return null;
    return rows.map((r) => ({
      lyrics: r.lyrics ?? '',
      chords: {},
      dir: r.dir === 'rtl' ? 'rtl' : 'ltr',
    }));
  } catch {
    return null;
  }
}

function loadDoc() {
  const currentName = getCurrentSongName();
  let data = null;
  
  if (currentName) {
    data = loadSong(currentName);
  }
  
  if (data) {
    return data.map((r) => ({
      lyrics: r.lyrics ?? '',
      chords: normalizeChordMap(r.chords),
      dir: r.dir === 'rtl' ? 'rtl' : 'ltr',
      kind: normalizeKind(r.kind),
    }));
  }

  try {
    let raw = localStorage.getItem(STORAGE_V2);
    if (!raw) {
      const v1 = localStorage.getItem(STORAGE_V1);
      if (v1) {
        const migrated = migrateV1ToV2(v1);
        if (migrated) {
          localStorage.setItem(STORAGE_V2, JSON.stringify(migrated));
          return migrated;
        }
      }
      return [{ lyrics: '', chords: {}, dir: 'ltr' }];
    }
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length === 0) {
      return [{ lyrics: '', chords: {}, dir: 'ltr' }];
    }
    return rows.map((r) => ({
      lyrics: r.lyrics ?? '',
      chords: normalizeChordMap(r.chords),
      dir: r.dir === 'rtl' ? 'rtl' : 'ltr',
      kind: normalizeKind(r.kind),
    }));
  } catch {
    return [{ lyrics: '', chords: {}, dir: 'ltr' }];
  }
}

function saveDoc(rows) {
  const payload = rows.map((r) => ({
    lyrics: r.lyricsEl.value,
    chords: normalizeChordMap(r.chords),
    dir: r.wrap.dataset.dir === 'rtl' ? 'rtl' : 'ltr',
    kind: normalizeKind(r.wrap.dataset.kind),
  }));
  
  const currentName = getCurrentSongName();
  if (currentName) {
    saveSong(currentName, payload);
  }
  
  localStorage.setItem(STORAGE_V2, JSON.stringify(payload));
}

function applyConfigToRoot(cfg, root, body) {
  root.style.setProperty('--chord-min-height', `${cfg.chordMinHeight}px`);
  root.style.setProperty('--lyric-min-height', `${cfg.lyricMinHeight}px`);
  root.style.setProperty('--chord-font-size', `${cfg.chordFontSize}px`);
  root.style.setProperty('--lyric-font-size', `${cfg.lyricFontSize}px`);
  body.classList.toggle('use-system-font', !cfg.useMonospace);
}

function exportText(rows) {
  return rows
    .map((r) => {

    const chordLineIndex = lines.findIndex((l) => l.startsWith('CHORDS:'));
    if (chordLineIndex >= 0) {
      lyrics = lines.slice(0, chordLineIndex).join('\n');
      const part = lines[chordLineIndex].slice('CHORDS:'.length).trim();
      if (part) {
        for (const pair of part.split(',')) {
          const idx = pair.indexOf(':');
          if (idx === -1) continue;
          const k = pair.slice(0, idx).trim();
          const v = pair.slice(idx + 1).trim();
          const n = Number(k);
          if (Number.isFinite(n) && v) chords[n] = v;
        }
      }
    } else {
      lyrics = lines.join('\n');
    }

    return { lyrics, chords: normalizeChordMap(chords), dir };
  });
}

function collectSnapshots(rows) {
  return rows.map((r) => ({
    lyrics: r.lyricsEl.value,
    chords: normalizeChordMap(r.chords),
    dir: r.wrap.dataset.dir === 'rtl' ? 'rtl' : 'ltr',
    kind: normalizeKind(r.wrap.dataset.kind),
  }));
}

function safeHtmlFilename(title) {
  const base = (title || '').trim() || 'lyrics-chords';
  const safe = base.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '-').slice(0, 80);
  return `${safe || 'lyrics-chords'}.html`;
}

function createRow(editor, data, getCfg, onChange, insertBefore = null, layoutSchedule) {
  const wrap = document.createElement('div');
  wrap.className = 'stanza-row';
  wrap.dataset.dir = data.dir === 'rtl' ? 'rtl' : 'ltr';
  wrap.dataset.kind = normalizeKind(data.kind);

  const rowMeta = document.createElement('div');
  rowMeta.className = 'row-meta';
  const kindLabel = document.createElement('label');
  kindLabel.className = 'row-kind-label';
  kindLabel.textContent = 'Row type';
  const kindSelect = document.createElement('select');
  kindSelect.className = 'row-kind-select';
  kindSelect.innerHTML = `
    <option value="line">Lyrics + Chords</option>
    <option value="chords">Chords only (transition)</option>
    <option value="header">Header (Verse / Chorus)</option>
  `;
  kindSelect.value = wrap.dataset.kind;
  rowMeta.appendChild(kindLabel);
  rowMeta.appendChild(kindSelect);

  const stage = document.createElement('div');
  stage.className = 'lyric-stage';

  const lyricsEl = document.createElement('textarea');
  lyricsEl.className = 'lyric-input';
  lyricsEl.placeholder = 'Lyrics — place the caret on a letter, then set a chord above it.';
  lyricsEl.value = data.lyrics ?? '';
  lyricsEl.rows = 2;
  lyricsEl.spellcheck = false;

  const chordOverlay = document.createElement('div');
  chordOverlay.className = 'chord-overlay';
  const lyricMirror = document.createElement('div');
  lyricMirror.className = 'lyric-mirror';
  const chordZone = document.createElement('div');
  chordZone.className = 'chord-zone';
  chordZone.title = 'Double-click above lyrics to add chord';

  stage.appendChild(lyricsEl);
  stage.appendChild(lyricMirror);
  stage.appendChild(chordOverlay);
  stage.appendChild(chordZone);
  wrap.appendChild(rowMeta);
  wrap.appendChild(stage);

  if (insertBefore != null) {
    editor.insertBefore(wrap, insertBefore);
  } else {
    editor.appendChild(wrap);
  }

  const row = {
    wrap,
    lyricsEl,
    chordOverlay,
    lyricMirror,
    chords: normalizeChordMap(data.chords),
    _lastValue: data.lyrics ?? '',
    _caretMap: [],
    _selectedChord: null,
    _pendingEditIndex: null,
    _editingIndex: null,
  };

  Object.defineProperty(row, 'dir', {
    get: () => wrap.dataset.dir,
    set: (v) => {
      wrap.dataset.dir = v === 'rtl' ? 'rtl' : 'ltr';
      onChange();
      layoutSchedule(row);
    },
  });

  Object.defineProperty(row, 'kind', {
    get: () => wrap.dataset.kind,
    set: (v) => {
      const next = normalizeKind(v);
      wrap.dataset.kind = next;
      kindSelect.value = next;
      onChange();
      layoutSchedule(row);
    },
  });

  const syncRowKindUI = () => {
    if (row.kind === 'header') {
      lyricsEl.placeholder = 'Section header (e.g., Verse 1 / Chorus)';
    } else if (row.kind === 'chords') {
      lyricsEl.placeholder = 'Type letters/spaces to position chords (text hidden in output)';
    } else {
      lyricsEl.placeholder = 'Lyrics — place the caret on a letter, then set a chord above it.';
    }
  };
  kindSelect.addEventListener('change', () => {
    row.kind = kindSelect.value;
    syncRowKindUI();
  });
  syncRowKindUI();

  const chordLift = () => Math.max(14, getCfg().chordFontSize + 6);
  const fitBubbleWidth = (input) => {
    input.size = Math.max(2, input.value.length + 1);
    input.style.width = 'auto';
  };
  const syncMirrorStyle = () => {
    const cs = getComputedStyle(lyricsEl);
    lyricMirror.style.font = cs.font;
    lyricMirror.style.letterSpacing = cs.letterSpacing;
    lyricMirror.style.lineHeight = cs.lineHeight;
    lyricMirror.style.padding = cs.padding;
    lyricMirror.style.border = cs.border;
    lyricMirror.style.boxSizing = cs.boxSizing;
    lyricMirror.style.direction = cs.direction;
    lyricMirror.style.textAlign = cs.textAlign;
    lyricMirror.style.width = `${lyricsEl.clientWidth}px`;
  };
  const buildCaretMap = () => {
    syncMirrorStyle();
    lyricMirror.innerHTML = '';
    const text = lyricsEl.value;
    const frag = document.createDocumentFragment();
    for (let i = 0; i <= text.length; i += 1) {
      const marker = document.createElement('span');
      marker.className = 'caret-marker';
      marker.dataset.i = String(i);
      marker.textContent = '\u200b';
      frag.appendChild(marker);
      if (i < text.length) {
        frag.appendChild(document.createTextNode(text[i]));
      }
    }
    lyricMirror.appendChild(frag);
    const markers = lyricMirror.querySelectorAll('.caret-marker');
    const map = new Array(text.length + 1);
    markers.forEach((m) => {
      const idx = Number(m.dataset.i);
      map[idx] = { left: m.offsetLeft, top: m.offsetTop };
    });
    row._caretMap = map;
  };
  const pickIndexAtX = (clientX) => {
    const rect = lyricsEl.getBoundingClientRect();
    const localX = clientX - rect.left;
    const map = row._caretMap;
    if (!map || map.length === 0) return lyricsEl.value.length;
    let bestIdx = 0;
    let bestDx = Number.POSITIVE_INFINITY;
    for (let i = 0; i < map.length; i += 1) {
      const p = map[i];
      if (!p) continue;
      const dx = Math.abs(p.left - localX);
      if (dx < bestDx) {
        bestDx = dx;
        bestIdx = i;
      }
    }
    return bestIdx;
  };
  const caretPos = (idx) => {
    const map = row._caretMap;
    if (map && map[idx]) return map[idx];
    return getCaretCoordinates(lyricsEl, idx);
  };

  const layoutChords = () => {
    chordOverlay.innerHTML = '';
    row._selectedChord = null;
    if (row.kind === 'header') {
      return;
    }
    buildCaretMap();
    const ta = lyricsEl;
    const val = ta.value;
    const map = normalizeChordMap(row.chords);
    const preserveIdx = row._pendingEditIndex ?? row._editingIndex;
    if (
      preserveIdx !== null &&
      Object.prototype.hasOwnProperty.call(row.chords, preserveIdx) &&
      String(row.chords[preserveIdx]).trim() === ''
    ) {
      map[preserveIdx] = '';
    }
    row.chords = map;

    for (const [kStr, text] of Object.entries(map)) {
      const idx = Number(kStr);
      if (!Number.isFinite(idx) || idx < 0 || idx > val.length) continue;
      const coords = caretPos(idx);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'chord-bubble';
      input.value = text;
      input.dataset.index = String(idx);
      input.setAttribute('aria-label', 'Chord');
      input.autocomplete = 'off';
      input.readOnly = true;
      input.style.left = `${coords.left}px`;
      input.style.top = `${coords.top - ta.scrollTop - chordLift()}px`;
      fitBubbleWidth(input);

      let dragStart = null;
      const onPointerMove = (e) => {
        if (!dragStart) return;
        const dx = e.clientX - dragStart.startX;
        const dy = e.clientY - dragStart.startY;
        if (!dragStart.moved && Math.hypot(dx, dy) < 4) return;
        dragStart.moved = true;
        const from = dragStart.index;
        buildCaretMap();
        const to = pickIndexAtX(e.clientX);
        if (from === to) return;
        const value = row.chords[from];
        delete row.chords[from];
        row.chords[to] = value;
        dragStart.index = to;
        input.dataset.index = String(to);
        onChange();
        layoutSchedule(row);
      };
      const onPointerUp = () => {
        if (!dragStart) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        dragStart = null;
      };
      const selectChord = () => {
        if (row._selectedChord !== null && row._selectedChord !== idx) {
          const prevEl = chordOverlay.querySelector(`.chord-bubble[data-index="${row._selectedChord}"]`);
          if (prevEl) prevEl.classList.remove('selected');
        }
        row._selectedChord = idx;
        input.classList.add('selected');
      };
      input.addEventListener('pointerdown', (e) => {
        if (input.readOnly) {
          e.stopPropagation();
          dragStart = {
            startX: e.clientX,
            startY: e.clientY,
            index: Number(input.dataset.index),
            moved: false,
          };
          selectChord();
          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp, { once: true });
        }
      });
      input.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        dragStart = null;
        if (row._selectedChord !== null && row._selectedChord !== idx) {
          const prevEl = chordOverlay.querySelector(`.chord-bubble[data-index="${row._selectedChord}"]`);
          if (prevEl) prevEl.classList.remove('selected');
        }
        row._selectedChord = null;
        row._editingIndex = idx;
        input.classList.remove('selected');
        input.readOnly = false;
        input.focus();
        input.select();
      });
      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      input.addEventListener('input', () => {
        const i = Number(input.dataset.index);
        const t = input.value.trim();
        if (!t) {
          // Don't delete while the user is actively typing – wait for blur
          row.chords[i] = '';
          fitBubbleWidth(input);
        } else {
          row.chords[i] = t;
          fitBubbleWidth(input);
        }
        onChange();
      });
      input.addEventListener('blur', () => {
        input.readOnly = true;
        input.classList.remove('selected');
        row._selectedChord = null;
        row._editingIndex = null;
        const i = Number(input.dataset.index);
        if (!input.value.trim()) {
          delete row.chords[i];
          onChange();
          layoutSchedule(row);
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          input.readOnly = true;
          input.blur();
          lyricsEl.focus();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          input.readOnly = true;
          lyricsEl.focus();
        }
      });

      if (row._pendingEditIndex === idx) {
        row._pendingEditIndex = null;
        row._editingIndex = idx;
        requestAnimationFrame(() => {
          input.readOnly = false;
          input.focus();
        });
      }

      chordOverlay.appendChild(input);
    }
  };

  const onLyricsInput = () => {
    const newVal = lyricsEl.value;
    const edit = findEditRange(row._lastValue, newVal);
    row.chords = remapChordMap(row.chords, edit);
    row._lastValue = newVal;
    onChange();
    layoutSchedule(row);
  };

  lyricsEl.addEventListener('input', onLyricsInput);
  lyricsEl.addEventListener('scroll', () => layoutSchedule(row));
  lyricsEl.addEventListener('click', () => {
    if (row._selectedChord !== null) {
      const el = chordOverlay.querySelector(`.chord-bubble.selected`);
      if (el) el.classList.remove('selected');
      row._selectedChord = null;
    }
    layoutSchedule(row);
  });
  lyricsEl.addEventListener('keyup', () => layoutSchedule(row));
  lyricsEl.addEventListener('focus', () => layoutSchedule(row));

  lyricsEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      row.onInsertAfter?.();
    }
  });

  const ro = new ResizeObserver(() => layoutSchedule(row));
  ro.observe(lyricsEl);

  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && row._selectedChord !== null) {
      e.preventDefault();
      delete row.chords[row._selectedChord];
      const chordEl = chordOverlay.querySelector(`.chord-bubble[data-index="${row._selectedChord}"]`);
      if (chordEl) chordEl.remove();
      row._selectedChord = null;
      onChange();
      layoutSchedule(row);
    }
  });

  chordZone.addEventListener('dblclick', (e) => {
    if (row.kind === 'header') return;
    e.preventDefault();
    e.stopPropagation();
    buildCaretMap();
    const idx = pickIndexAtX(e.clientX);
    if (!row.chords[idx]) {
      row.chords[idx] = '';
    }
    row._pendingEditIndex = idx;
    onChange();
    layoutSchedule(row);
  });

  lyricMirror.addEventListener('click', (e) => {
    if (row._selectedChord !== null) {
      const el = chordOverlay.querySelector(`.chord-bubble.selected`);
      if (el) el.classList.remove('selected');
      row._selectedChord = null;
    }
  });

  row.layoutChords = layoutChords;
  row.dispose = () => {
    ro.disconnect();
  };

  return row;
}

function mount() {
  const app = document.getElementById('app');
  let cfg = loadConfig();
  let rows = [];

  const root = document.documentElement;

  app.innerHTML = `
    <header class="toolbar">
      <h1>Lyrics &amp; chords</h1>
      <div class="toolbar-group">
        <label for="sel-song">Song:</label>
        <select id="sel-song">
          <option value="">New song</option>
        </select>
        <button type="button" id="btn-song-save">Save</button>
        <button type="button" id="btn-song-save-as">Save As</button>
        <button type="button" id="btn-song-delete">Delete</button>
      </div>
      <div class="toolbar-group">
        <button type="button" id="btn-song-export">Export to file</button>
        <button type="button" id="btn-song-import">Import from file</button>
      </div>
      <div class="toolbar-group">
        <button type="button" class="primary" id="btn-add">Add line</button>
        <button type="button" id="btn-del">Remove last line</button>
      </div>
      <div class="toolbar-group">
        <label for="sel-dir">Direction (new lines)</label>
        <select id="sel-dir">
          <option value="ltr">LTR (English)</option>
          <option value="rtl">RTL (Hebrew)</option>
        </select>
        <button type="button" id="btn-apply-dir">Apply direction to all</button>
      </div>
      <div class="toolbar-group">
        <button type="button" id="btn-config">Row settings</button>
        <button type="button" id="btn-export">Copy as text</button>
        <button type="button" id="btn-import">Paste import</button>
        <button type="button" id="btn-export-html">Download HTML</button>
        <button type="button" id="btn-print-pdf">Print / Save PDF</button>
      </div>
    </header>
    <div class="config-panel" id="config-panel" aria-hidden="true"></div>
    <p class="hint">
      Type lyrics in the box, then <strong>double-click above the text</strong> to add a chord and type immediately.
      <strong>Click a chord to select it</strong>, then drag to move or press <kbd>Delete</kbd> to remove.
      <strong>Double-click a chord</strong> to edit it. <kbd>Escape</kbd> to cancel or <kbd>Enter</kbd> to save.
      Use each row's <strong>Row type</strong> to mark headers (Verse, Chorus, Bridge).
      Press <kbd>Enter</kbd> to create a new line box after the current one.
      <strong>Download HTML</strong> / <strong>Print / Save PDF</strong> use the same layout.
    </p>
    <div class="editor" id="editor"></div>
  `;

  const configPanel = app.querySelector('#config-panel');
  configPanel.innerHTML = `
    <fieldset>
      <legend>Row height (min)</legend>
      <div class="config-row">
        <label for="cfg-ch-h">Chord box</label>
        <input type="number" id="cfg-ch-h" min="16" max="120" step="1" />
        <span>px</span>
      </div>
      <div class="config-row">
        <label for="cfg-ly-h">Lyrics</label>
        <input type="number" id="cfg-ly-h" min="20" max="160" step="1" />
        <span>px</span>
      </div>
    </fieldset>
    <fieldset>
      <legend>Font size</legend>
      <div class="config-row">
        <label for="cfg-ch-fs">Chords</label>
        <input type="number" id="cfg-ch-fs" min="10" max="28" step="1" />
        <span>px</span>
      </div>
      <div class="config-row">
        <label for="cfg-ly-fs">Lyrics</label>
        <input type="number" id="cfg-ly-fs" min="10" max="32" step="1" />
        <span>px</span>
      </div>
    </fieldset>
    <fieldset>
      <legend>Font</legend>
      <div class="config-row">
        <label for="cfg-mono">Alignment</label>
        <select id="cfg-mono">
          <option value="mono">Monospace (stable columns)</option>
          <option value="system">System UI (softer look)</option>
        </select>
      </div>
    </fieldset>
  `;

  const editor = app.querySelector('#editor');
  const selDir = app.querySelector('#sel-dir');
  selDir.value = cfg.defaultDirection;

  let layoutFrame = 0;
  const layoutSchedule = (row) => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      row.layoutChords?.();
    });
  };

  const bindConfigInputs = () => {
    configPanel.querySelector('#cfg-ch-h').value = String(cfg.chordMinHeight);
    configPanel.querySelector('#cfg-ly-h').value = String(cfg.lyricMinHeight);
    configPanel.querySelector('#cfg-ch-fs').value = String(cfg.chordFontSize);
    configPanel.querySelector('#cfg-ly-fs').value = String(cfg.lyricFontSize);
    configPanel.querySelector('#cfg-mono').value = cfg.useMonospace ? 'mono' : 'system';
  };

  const readConfigFromInputs = () => {
    cfg.chordMinHeight = Number(configPanel.querySelector('#cfg-ch-h').value) || cfg.chordMinHeight;
    cfg.lyricMinHeight = Number(configPanel.querySelector('#cfg-ly-h').value) || cfg.lyricMinHeight;
    cfg.chordFontSize = Number(configPanel.querySelector('#cfg-ch-fs').value) || cfg.chordFontSize;
    cfg.lyricFontSize = Number(configPanel.querySelector('#cfg-ly-fs').value) || cfg.lyricFontSize;
    cfg.useMonospace = configPanel.querySelector('#cfg-mono').value === 'mono';
  };

  const persistAll = () => {
    saveConfig(cfg);
    saveDoc(rows);
  };

  const onRowChange = () => persistAll();

  const wireInsertHandler = (row) => {
    row.onInsertAfter = () => insertRowAfter(row);
  };

  const insertRowAfter = (afterRow) => {
    const idx = rows.indexOf(afterRow);
    const d = {
      lyrics: '',
      chords: {},
      dir: afterRow?.wrap?.dataset?.dir || cfg.defaultDirection,
      kind: normalizeKind(afterRow?.wrap?.dataset?.kind),
    };
    const next = afterRow?.wrap?.nextSibling ?? null;
    const newRow = createRow(editor, d, () => cfg, onRowChange, next, layoutSchedule);
    if (idx >= 0) {
      rows.splice(idx + 1, 0, newRow);
    } else {
      rows.push(newRow);
    }
    wireInsertHandler(newRow);
    persistAll();
    newRow.lyricsEl.focus();
  };

  const rebuild = (data) => {
    for (const r of rows) {
      r.dispose?.();
    }
    editor.innerHTML = '';
    rows = data.map((d) => createRow(editor, d, () => cfg, onRowChange, null, layoutSchedule));
    rows.forEach((r) => {
      wireInsertHandler(r);
      r.layoutChords?.();
    });
    persistAll();
  };

  applyConfigToRoot(cfg, root, document.body);
  bindConfigInputs();
  rebuild(loadDoc());

  selDir.addEventListener('change', () => {
    cfg.defaultDirection = selDir.value;
    saveConfig(cfg);
  });

  app.querySelector('#btn-add').addEventListener('click', () => {
    const d = { lyrics: '', chords: {}, dir: cfg.defaultDirection, kind: 'line' };
    const row = createRow(editor, d, () => cfg, onRowChange, null, layoutSchedule);
    rows.push(row);
    wireInsertHandler(row);
    persistAll();
    row.lyricsEl.focus();
    layoutSchedule(row);
  });

  app.querySelector('#btn-del').addEventListener('click', () => {
    if (rows.length <= 1) return;
    const last = rows.pop();
    last.dispose?.();
    last.wrap.remove();
    persistAll();
  });

  app.querySelector('#btn-apply-dir').addEventListener('click', () => {
    const d = selDir.value;
    for (const r of rows) {
      r.wrap.dataset.dir = d;
      layoutSchedule(r);
    }
    persistAll();
  });

  app.querySelector('#btn-config').addEventListener('click', () => {
    const open = !configPanel.classList.contains('open');
    configPanel.classList.toggle('open', open);
    configPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    bindConfigInputs();
  });

  ['#cfg-ch-h', '#cfg-ly-h', '#cfg-ch-fs', '#cfg-ly-fs', '#cfg-mono'].forEach((sel) => {
    configPanel.querySelector(sel).addEventListener('change', () => {
      readConfigFromInputs();
      applyConfigToRoot(cfg, root, document.body);
      saveConfig(cfg);
      rows.forEach((r) => layoutSchedule(r));
    });
  });

  app.querySelector('#btn-export').addEventListener('click', async () => {
    const text = exportText(rows);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      prompt('Copy:', text);
      return;
    }
    const b = app.querySelector('#btn-export');
    const prev = b.textContent;
    b.textContent = 'Copied!';
    setTimeout(() => {
      b.textContent = prev;
    }, 1500);
  });

  app.querySelector('#btn-import').addEventListener('click', () => {
    const text = prompt('Paste exported text (v2 blocks or legacy chord/lyric pairs):');
    if (text == null) return;
    const pairs = importText(text, cfg.defaultDirection);
    rebuild(pairs);
  });

  const publishTitle = () => {
    const t = prompt('Title (optional, shown at top of page):', '');
    if (t === null) return null;
    return t;
  };

  app.querySelector('#btn-export-html').addEventListener('click', () => {
    const title = publishTitle();
    if (title === null) return;
    const snapshots = collectSnapshots(rows);
    const html = buildPublishDocument(snapshots, cfg, { title });
    downloadTextFile(html, safeHtmlFilename(title));
    const b = app.querySelector('#btn-export-html');
    const prev = b.textContent;
    b.textContent = 'Downloaded';
    setTimeout(() => {
      b.textContent = prev;
    }, 1500);
  });

  app.querySelector('#btn-print-pdf').addEventListener('click', () => {
    const title = publishTitle();
    if (title === null) return;
    const snapshots = collectSnapshots(rows);
    const html = buildPublishDocument(snapshots, cfg, { title });
    openPrintWindow(html);
  });

  // Song management
  const selSong = app.querySelector('#sel-song');
  
  const updateSongList = () => {
    const list = loadSongList();
    const currentName = getCurrentSongName();
    selSong.innerHTML = '<option value="">New song</option>';
    list.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === currentName) opt.selected = true;
      selSong.appendChild(opt);
    });
  };

  const switchSong = (name) => {
    if (!name) {
      setCurrentSongName(null);
      rebuild([{ lyrics: '', chords: {}, dir: cfg.defaultDirection, kind: 'line' }]);
      selSong.value = '';
      return;
    }
    
    const data = loadSong(name);
    if (data) {
      setCurrentSongName(name);
      rebuild(data);
      selSong.value = name;
    }
  };

  selSong.addEventListener('change', () => {
    const name = selSong.value.trim();
    switchSong(name || null);
  });

  const flashButtonText = (selector, text, duration = 1200) => {
    const b = app.querySelector(selector);
    const prev = b.textContent;
    b.textContent = text;
    setTimeout(() => {
      b.textContent = prev;
    }, duration);
  };

  const saveSongByName = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return false;
    const list = loadSongList();
    if (!list.includes(trimmed)) {
      list.push(trimmed);
      saveSongList(list);
    }
    saveSong(trimmed, collectSnapshots(rows));
    setCurrentSongName(trimmed);
    updateSongList();
    return true;
  };

  app.querySelector('#btn-song-save').addEventListener('click', () => {
    const current = getCurrentSongName();
    if (!current) {
      const name = prompt('Song name:');
      if (!name || !name.trim()) return;
      if (saveSongByName(name)) {
        flashButtonText('#btn-song-save', 'Saved!');
      }
      return;
    }
    if (saveSongByName(current)) {
      flashButtonText('#btn-song-save', 'Saved!');
    }
  });

  app.querySelector('#btn-song-save-as').addEventListener('click', () => {
    const current = getCurrentSongName();
    const name = prompt('Save song as:', current || '');
    if (!name || !name.trim()) return;
    if (saveSongByName(name)) {
      flashButtonText('#btn-song-save-as', 'Saved!');
    }
  });

  app.querySelector('#btn-song-delete').addEventListener('click', () => {
    const name = getCurrentSongName();
    if (!name) {
      alert('No song selected');
      return;
    }
    if (!confirm(`Delete song "${name}"?`)) return;
    const list = loadSongList();
    saveSongList(list.filter((n) => n !== name));
    deleteSong(name);
    setCurrentSongName(null);
    updateSongList();
    rebuild([{ lyrics: '', chords: {}, dir: cfg.defaultDirection, kind: 'line' }]);
  });

  app.querySelector('#btn-song-export').addEventListener('click', () => {
    const name = getCurrentSongName() || 'song';
    const snapshots = collectSnapshots(rows);
    const payload = {
      name: name,
      data: snapshots.map((s) => ({
        lyrics: s.lyrics,
        chords: normalizeChordMap(s.chords),
        dir: s.dir,
        kind: s.kind,
      })),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\W+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  app.querySelector('#btn-song-import').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const payload = JSON.parse(evt.target.result);
          if (!payload.data || !Array.isArray(payload.data)) {
            alert('Invalid file format');
            return;
          }
          const songName = payload.name || prompt('Song name:') || 'imported-song';
          const list = loadSongList();
          if (!list.includes(songName)) {
            list.push(songName);
            saveSongList(list);
          }
          saveSong(songName, payload.data);
          switchSong(songName);
        } catch {
          alert('Error parsing file');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  updateSongList();
}

mount();
