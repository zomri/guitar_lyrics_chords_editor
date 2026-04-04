import { buildPublishDocument, downloadTextFile, openPrintWindow, openPreviewWindow } from './publish.js';
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
      sectionEnd: r.sectionEnd === true,
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
      sectionEnd: r.sectionEnd === true,
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
    sectionEnd: r._sectionEnd ?? false,
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

function normalizeRowArray(data, fallbackDir = 'ltr') {
  if (!Array.isArray(data) || data.length === 0) {
    return [{ lyrics: '', chords: {}, dir: fallbackDir, kind: 'line' }];
  }
  return data.map((r) => ({
    lyrics: r?.lyrics ?? '',
    chords: normalizeChordMap(r?.chords),
    dir: r?.dir === 'rtl' ? 'rtl' : 'ltr',
    kind: normalizeKind(r?.kind),
    sectionEnd: r?.sectionEnd === true,
  }));
}

function exportText(rows) {
  const payload = {
    format: 'lyrics-chords-rows-v2',
    rows: rows.map((r) => ({
      lyrics: r.lyricsEl.value,
      chords: normalizeChordMap(r.chords),
      dir: r.wrap.dataset.dir === 'rtl' ? 'rtl' : 'ltr',
      kind: normalizeKind(r.wrap.dataset.kind),
      sectionEnd: r._sectionEnd ?? false,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

function importText(text, defaultDirection = 'ltr') {
  const raw = String(text || '').trim();
  if (!raw) {
    return [{ lyrics: '', chords: {}, dir: defaultDirection, kind: 'line' }];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeRowArray(parsed, defaultDirection);
    }
    if (parsed && Array.isArray(parsed.rows)) {
      return normalizeRowArray(parsed.rows, defaultDirection);
    }
  } catch {
    // Fallback to legacy text parsing.
  }

  const blocks = raw.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const rows = blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    let dir = defaultDirection === 'rtl' ? 'rtl' : 'ltr';
    let kind = 'line';
    let lyrics = '';
    const chords = {};

    const dirLine = lines.find((l) => l.startsWith('DIR:'));
    if (dirLine) {
      const val = dirLine.slice('DIR:'.length).trim();
      dir = val === 'rtl' ? 'rtl' : 'ltr';
    }

    const kindLine = lines.find((l) => l.startsWith('KIND:'));
    if (kindLine) {
      kind = normalizeKind(kindLine.slice('KIND:'.length).trim());
    }

    const chordLineIndex = lines.findIndex((l) => l.startsWith('CHORDS:'));
    if (chordLineIndex >= 0) {
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
      const lyricLines = lines.filter(
        (l, i) => i < chordLineIndex && !l.startsWith('DIR:') && !l.startsWith('KIND:') && l !== 'LYRICS:'
      );
      lyrics = lyricLines.join('\n');
    } else {
      lyrics = lines.filter((l) => !l.startsWith('DIR:') && !l.startsWith('KIND:') && l !== 'LYRICS:').join('\n');
    }

    return { lyrics, chords: normalizeChordMap(chords), dir, kind };
  });

  return normalizeRowArray(rows, defaultDirection);
}

function collectSnapshots(rows) {
  return rows.map((r) => ({
    lyrics: r.lyricsEl.value,
    chords: normalizeChordMap(r.chords),
    dir: r.wrap.dataset.dir === 'rtl' ? 'rtl' : 'ltr',
    kind: normalizeKind(r.wrap.dataset.kind),
    sectionEnd: r._sectionEnd ?? false,
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
  const kindButtons = document.createElement('div');
  kindButtons.className = 'row-kind-buttons';
  const btnKindHeader = document.createElement('button');
  btnKindHeader.type = 'button';
  btnKindHeader.className = 'row-kind-btn';
  btnKindHeader.dataset.kind = 'header';
  btnKindHeader.textContent = 'Section';
  const btnKindLine = document.createElement('button');
  btnKindLine.type = 'button';
  btnKindLine.className = 'row-kind-btn';
  btnKindLine.dataset.kind = 'line';
  btnKindLine.textContent = 'Lyrics&Chords';
  const btnKindChords = document.createElement('button');
  btnKindChords.type = 'button';
  btnKindChords.className = 'row-kind-btn';
  btnKindChords.dataset.kind = 'chords';
  btnKindChords.textContent = 'Chords only';
  kindButtons.appendChild(btnKindHeader);
  kindButtons.appendChild(btnKindLine);
  kindButtons.appendChild(btnKindChords);

  const sectionPresetSelect = document.createElement('select');
  sectionPresetSelect.className = 'row-section-preset';
  sectionPresetSelect.title = 'Pick a common section label';
  sectionPresetSelect.style.display = 'none';

  const dragHandle = document.createElement('button');
  dragHandle.type = 'button';
  dragHandle.className = 'row-drag-handle';
  dragHandle.textContent = '\u2261';
  dragHandle.title = 'Drag to reorder row (header moves whole section)';
  dragHandle.draggable = true;

  rowMeta.appendChild(dragHandle);
  rowMeta.appendChild(kindButtons);
  rowMeta.appendChild(sectionPresetSelect);

  const rowSelectCb = document.createElement('input');
  rowSelectCb.type = 'checkbox';
  rowSelectCb.className = 'row-select-cb';
  rowSelectCb.title = 'Select row for multi-row chord copy';

  const btnCopyChords = document.createElement('button');
  btnCopyChords.type = 'button';
  btnCopyChords.className = 'row-action-btn';
  btnCopyChords.textContent = 'Copy chords';
  btnCopyChords.title = 'Copy chords from this row (or all selected rows)';

  const btnPasteChords = document.createElement('button');
  btnPasteChords.type = 'button';
  btnPasteChords.className = 'row-action-btn';
  btnPasteChords.textContent = 'Paste chords';
  btnPasteChords.title = 'Paste copied chords to this row';
  btnPasteChords.disabled = true;

  const sectionSelectCb = document.createElement('input');
  sectionSelectCb.type = 'checkbox';
  sectionSelectCb.className = 'row-select-cb';
  sectionSelectCb.title = 'Select this section for copy/paste';
  sectionSelectCb.style.display = data.kind === 'header' ? 'block' : 'none';

  const btnCopySection = document.createElement('button');
  btnCopySection.type = 'button';
  btnCopySection.className = 'row-action-btn';
  btnCopySection.textContent = 'Copy section';
  btnCopySection.title = 'Copy all chords from rows in this section';
  btnCopySection.style.display = data.kind === 'header' ? 'block' : 'none';

  const btnCloneSection = document.createElement('button');
  btnCloneSection.type = 'button';
  btnCloneSection.className = 'row-action-btn';
  btnCloneSection.textContent = 'Clone section';
  btnCloneSection.title = 'Duplicate this section and append it to the end';
  btnCloneSection.style.display = data.kind === 'header' ? 'block' : 'none';

  const btnPasteSection = document.createElement('button');
  btnPasteSection.type = 'button';
  btnPasteSection.className = 'row-action-btn';
  btnPasteSection.textContent = 'Paste section';
  btnPasteSection.title = 'Paste to all rows in this section';
  btnPasteSection.disabled = true;
  btnPasteSection.style.display = data.kind === 'header' ? 'block' : 'none';

  const btnEndSection = document.createElement('button');
  btnEndSection.type = 'button';
  btnEndSection.className = 'row-action-btn row-end-section-btn';
  btnEndSection.textContent = '⌄ End section';
  btnEndSection.title = 'Mark end of section (next row starts new section)';
  btnEndSection.style.display = data.kind === 'header' ? 'none' : 'block';

  const btnDeleteRow = document.createElement('button');
  btnDeleteRow.type = 'button';
  btnDeleteRow.className = 'row-action-btn row-delete-btn';
  btnDeleteRow.textContent = 'Delete row';
  btnDeleteRow.title = 'Delete this row';

  rowMeta.appendChild(rowSelectCb);
  rowMeta.appendChild(sectionSelectCb);
  rowMeta.appendChild(btnCopyChords);
  rowMeta.appendChild(btnCopySection);
  rowMeta.appendChild(btnCloneSection);
  rowMeta.appendChild(btnPasteChords);
  rowMeta.appendChild(btnPasteSection);
  rowMeta.appendChild(btnEndSection);
  rowMeta.appendChild(btnDeleteRow);

  const sectionTag = document.createElement('span');
  sectionTag.className = 'row-section-tag';
  sectionTag.textContent = '';
  rowMeta.appendChild(sectionTag);

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

  const sectionDivider = document.createElement('div');
  sectionDivider.className = 'section-divider';
  sectionDivider.style.display = 'none';
  wrap.appendChild(sectionDivider);

  const insertBetweenBtn = document.createElement('button');
  insertBetweenBtn.type = 'button';
  insertBetweenBtn.className = 'row-insert-between';
  insertBetweenBtn.textContent = '+';
  insertBetweenBtn.title = 'Insert a new row below this row';
  insertBetweenBtn.addEventListener('click', () => {
    row.onInsertAfter?.();
  });
  wrap.appendChild(insertBetweenBtn);

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
    _sectionEnd: data.sectionEnd ?? false,
  };

  const sectionKinds = [
    { key: 'verse', ltr: 'Verse', rtl: 'בית', aliases: ['Verse', 'בית'] },
    { key: 'chorus', ltr: 'Chorus', rtl: 'פזמון', aliases: ['Chorus', 'פזמון'] },
    { key: 'bridge', ltr: 'Bridge', rtl: 'גשר', aliases: ['Bridge', 'גשר'] },
    { key: 'pre-chorus', ltr: 'Pre-Chorus', rtl: 'קדם-פזמון', aliases: ['Pre-Chorus', 'קדם-פזמון'] },
    { key: 'outro', ltr: 'Outro/Coda', rtl: 'סיום/קודה', aliases: ['Outro/Coda', 'סיום/קודה'] },
  ];
  const normalizeSectionName = (text) => String(text || '').trim().toLowerCase();
  const parseKnownSection = (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    for (const def of sectionKinds) {
      for (const alias of def.aliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const m = new RegExp(`^${escaped}(?:\\s+(\\d+))?$`, 'i').exec(trimmed);
        if (!m) continue;
        return { key: def.key, num: m[1] ? Number(m[1]) : 1 };
      }
    }
    return null;
  };
  const collectSectionSuggestions = () => {
    const maxByBase = new Map();
    const headerInputs = editor.querySelectorAll('.stanza-row[data-kind="header"] .lyric-input');
    headerInputs.forEach((el) => {
      if (!(el instanceof HTMLTextAreaElement)) return;
      const firstLine = String(el.value || '').trim().split(/\r?\n/)[0] || '';
      const parsed = parseKnownSection(firstLine);
      if (!parsed) return;
      const prev = maxByBase.get(parsed.key) || 0;
      maxByBase.set(parsed.key, Math.max(prev, parsed.num));
    });

    const isRtl = wrap.dataset.dir === 'rtl';
    return sectionKinds.map((def) => {
      const label = isRtl ? def.rtl : def.ltr;
      const maxSeen = maxByBase.get(def.key) || 0;
      return maxSeen > 0 ? `${label} ${maxSeen + 1}` : label;
    });
  };
  const refreshSectionPresetOptions = () => {
    const currentText = String(lyricsEl.value || '').trim().split(/\r?\n/)[0] || '';
    const suggestions = collectSectionSuggestions();
    sectionPresetSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = wrap.dataset.dir === 'rtl' ? 'שם מקטע...' : 'Section label...';
    placeholder.selected = true;
    sectionPresetSelect.appendChild(placeholder);

    const seen = new Set();
    const currentNorm = normalizeSectionName(currentText);
    if (currentNorm) {
      seen.add(currentNorm);
      const own = document.createElement('option');
      own.value = currentText;
      own.textContent = currentText;
      sectionPresetSelect.appendChild(own);
    }

    suggestions.forEach((s) => {
      const n = normalizeSectionName(s);
      if (!n || seen.has(n)) return;
      seen.add(n);
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sectionPresetSelect.appendChild(opt);
    });
  };
  row.refreshSectionPresetOptions = refreshSectionPresetOptions;

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
      [btnKindHeader, btnKindLine, btnKindChords].forEach((b) => {
        b.classList.toggle('active', b.dataset.kind === next);
      });
      onChange();
      layoutSchedule(row);
    },
  });

  const syncRowKindUI = () => {
    const isHeader = row.kind === 'header';
    [btnKindHeader, btnKindLine, btnKindChords].forEach((b) => {
      b.classList.toggle('active', b.dataset.kind === row.kind);
    });
    if (isHeader) {
      lyricsEl.placeholder = 'Section header (e.g., Verse 1 / Chorus)';
      rowSelectCb.style.display = 'none';
      btnCopyChords.style.display = 'none';
      btnPasteChords.style.display = 'none';
      btnEndSection.style.display = 'none';
      sectionPresetSelect.style.display = 'block';
      refreshSectionPresetOptions();
      sectionSelectCb.style.display = 'block';
      btnCopySection.style.display = 'block';
      btnCloneSection.style.display = 'block';
      btnPasteSection.style.display = 'block';
      btnDeleteRow.style.display = 'block';
    } else if (row.kind === 'chords') {
      lyricsEl.placeholder = 'Type letters/spaces to position chords (text hidden in output)';
      rowSelectCb.style.display = 'block';
      btnCopyChords.style.display = 'block';
      btnPasteChords.style.display = 'block';
      btnEndSection.style.display = 'block';
      sectionPresetSelect.style.display = 'none';
      sectionSelectCb.style.display = 'none';
      btnCopySection.style.display = 'none';
      btnCloneSection.style.display = 'none';
      btnPasteSection.style.display = 'none';
      btnDeleteRow.style.display = 'block';
    } else {
      lyricsEl.placeholder = 'Lyrics — place the caret on a letter, then set a chord above it.';
      rowSelectCb.style.display = 'block';
      btnCopyChords.style.display = 'block';
      btnPasteChords.style.display = 'block';
      btnEndSection.style.display = 'block';
      sectionPresetSelect.style.display = 'none';
      sectionSelectCb.style.display = 'none';
      btnCopySection.style.display = 'none';
      btnCloneSection.style.display = 'none';
      btnPasteSection.style.display = 'none';
      btnDeleteRow.style.display = 'block';
    }
  };
  const updateSectionEndUI = () => {
    const isEnd = row._sectionEnd;
    btnEndSection.classList.toggle('active', isEnd);
    sectionDivider.style.display = isEnd ? 'block' : 'none';
  };
  [btnKindHeader, btnKindLine, btnKindChords].forEach((b) => {
    b.addEventListener('click', () => {
      row.kind = b.dataset.kind;
      syncRowKindUI();
    });
  });
  sectionPresetSelect.addEventListener('change', () => {
    const next = sectionPresetSelect.value;
    if (!next) return;
    lyricsEl.value = next;
    row._lastValue = lyricsEl.value;
    onChange();
    layoutSchedule(row);
    sectionPresetSelect.value = '';
  });
  btnEndSection.addEventListener('click', (e) => {
    e.stopPropagation();
    row._sectionEnd = !row._sectionEnd;
    updateSectionEndUI();
    onChange();
  });
  syncRowKindUI();
  updateSectionEndUI();

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

  row.isSelected = () => rowSelectCb.checked;
  row.setSelected = (v) => { rowSelectCb.checked = Boolean(v); };
  row.setPasteEnabled = (v) => { btnPasteChords.disabled = !v; };
  row.flashCopyBtn = () => {
    const prev = btnCopyChords.textContent;
    btnCopyChords.textContent = 'Copied!';
    setTimeout(() => { btnCopyChords.textContent = prev; }, 1000);
  };
  row.isSectionEnd = () => row._sectionEnd;
  row.setSectionEnd = (v) => {
    row._sectionEnd = Boolean(v);
    updateSectionEndUI();
  };
  row.isSectionSelected = () => sectionSelectCb.checked;
  row.setSectionSelected = (v) => { sectionSelectCb.checked = Boolean(v); };
  row.setSectionPasteEnabled = (v) => { btnPasteSection.disabled = !v; };
  row.flashCopySectionBtn = () => {
    const prev = btnCopySection.textContent;
    btnCopySection.textContent = 'Copied!';
    setTimeout(() => { btnCopySection.textContent = prev; }, 1000);
  };
  row.flashCloneSectionBtn = () => {
    const prev = btnCloneSection.textContent;
    btnCloneSection.textContent = 'Cloned!';
    setTimeout(() => { btnCloneSection.textContent = prev; }, 1000);
  };
  row.setSectionTag = (text, show) => {
    sectionTag.textContent = text;
    sectionTag.style.display = show ? 'inline-block' : 'none';
  };
  row.getDragHandle = () => dragHandle;
  row.setDragTarget = (v) => wrap.classList.toggle('row-drop-target', Boolean(v));

  btnCopyChords.addEventListener('click', (e) => {
    e.stopPropagation();
    row.onCopyChords?.();
  });
  btnPasteChords.addEventListener('click', (e) => {
    e.stopPropagation();
    row.onPasteChords?.();
  });
  btnCopySection.addEventListener('click', (e) => {
    e.stopPropagation();
    row.onCopySection?.();
  });
  btnCloneSection.addEventListener('click', (e) => {
    e.stopPropagation();
    row.onCloneSection?.();
  });
  btnPasteSection.addEventListener('click', (e) => {
    e.stopPropagation();
    row.onPasteSection?.();
  });
  btnDeleteRow.addEventListener('click', (e) => {
    e.stopPropagation();
    row.onDelete?.();
  });

  row.dispose = () => {
    ro.disconnect();
  };

  return row;
}

function mount() {
  const app = document.getElementById('app');
  let cfg = loadConfig();
  let rows = [];
  let historyPast = [];
  let historyFuture = [];
  let historyCurrent = '[]';
  let suppressHistory = false;

  const root = document.documentElement;

  app.innerHTML = `
    <header class="toolbar">
      <div class="toolbar-top">
        <h1>Lyrics &amp; chords</h1>
        <button type="button" id="btn-guide">Quick guide</button>
      </div>
      <div class="toolbar-row toolbar-row-song">
        <div class="toolbar-group">
          <label for="sel-song">Song:</label>
          <select id="sel-song">
            <option value="">New song</option>
          </select>
          <button type="button" id="btn-song-save">Save</button>
          <button type="button" id="btn-song-save-as">Save As</button>
          <button type="button" id="btn-song-delete">Delete</button>
          <button type="button" id="btn-song-export">Export song</button>
          <button type="button" id="btn-song-import">Import song</button>
          <button type="button" id="btn-song-export-all">Export all songs</button>
          <button type="button" id="btn-song-import-all">Import all songs</button>
        </div>
      </div>
      <div class="toolbar-row toolbar-row-output">
        <div class="toolbar-group">
          <label for="sel-dir">Direction (new lines)</label>
          <select id="sel-dir">
            <option value="ltr">LTR (English)</option>
            <option value="rtl">RTL (Hebrew)</option>
          </select>
          <button type="button" id="btn-apply-dir">Apply direction to all</button>
          <button type="button" id="btn-config">Row settings</button>
        </div>
        <div class="toolbar-group toolbar-group-html-output">
          <button type="button" id="btn-preview-html">Preview HTML</button>
          <button type="button" id="btn-export-html">Download HTML</button>
          <button type="button" id="btn-print-pdf">Print / Save PDF</button>
        </div>
      </div>
    </header>
    <div class="config-panel" id="config-panel" aria-hidden="true"></div>
    <div class="guide-modal" id="guide-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div class="guide-sheet">
        <button type="button" class="guide-close" id="btn-guide-close" aria-label="Close guide">x</button>
        <h2 id="guide-title">Quick Start Guide</h2>
        <p class="guide-sub">Short visual walkthrough for writing and arranging songs.</p>
        <div class="guide-grid">
          <section class="guide-card">
            <h3>1. Add Lyrics + Chords</h3>
            <p>Type lyrics, then double-click above letters to place chords.</p>
            <div class="guide-visual mono"><span class="guide-accent">  G     D     Em</span><br>lyrics line</div>
          </section>
          <section class="guide-card">
            <h3>2. Build Sections</h3>
            <p>Set a row to <strong>Header</strong> for Verse/Chorus. Use <strong>End section</strong> when needed.</p>
            <div class="guide-visual">[ Header: Chorus ]<br>  line 1<br>  line 2<br><span class="guide-accent">  End section</span></div>
          </section>
          <section class="guide-card">
            <h3>3. Reuse Fast</h3>
            <p>Copy/paste row chords, or copy/clone full section from header actions.</p>
            <div class="guide-visual">Copy section -> Paste section<br>or<br>Clone section (append)</div>
          </section>
          <section class="guide-card">
            <h3>4. Reorder</h3>
            <p>Drag with <strong>=</strong>. Drag header to move whole section, row to move only row.</p>
            <div class="guide-visual">= Header (moves block)<br>= Row (moves single)</div>
          </section>
          <section class="guide-card">
            <h3>5. Export / Preview</h3>
            <p>Use <strong>Preview HTML</strong> for quick view, then print/download when ready.</p>
            <div class="guide-visual">Preview HTML -> Download HTML / Print PDF</div>
          </section>
          <section class="guide-card">
            <h3>6. Arrange Layout</h3>
            <p>After writing, use the <strong>Layout Board</strong> at the bottom to reorder sections and estimate page columns before export.</p>
            <div class="guide-visual">Write first -> Layout Board -> Preview / Print</div>
          </section>
        </div>
      </div>
    </div>
    <p class="hint">
      Type lyrics in the box, then <strong>double-click above the text</strong> to add a chord and type immediately.
      <strong>Click a chord to select it</strong>, then drag to move or press <kbd>Delete</kbd> to remove.
      <strong>Double-click a chord</strong> to edit it. <kbd>Escape</kbd> to cancel or <kbd>Enter</kbd> to save.
      Use each row's <strong>Row type</strong> to mark headers (Verse, Chorus, Bridge).
      Use the <strong>\u2261 handle</strong> to drag a row (or a whole section when dragging a header).
      Use <strong>Clone section</strong> on headers to append a copy at the end.
      Press <kbd>Enter</kbd> to create a new line box after the current one.
      <strong>Download HTML</strong> / <strong>Print / Save PDF</strong> use the same layout.
    </p>
    <div class="editor" id="editor"></div>
    <section class="layout-inline" id="layout-inline" aria-labelledby="layout-title">
      <div class="layout-sheet">
        <h2 id="layout-title">Layout Board (Estimated)</h2>
        <p class="guide-sub">Estimate section size and page usage before export.</p>
        <div class="layout-toolbar">
          <label for="sel-layout-cols">Columns</label>
          <select id="sel-layout-cols">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
          </select>
          <button type="button" id="btn-layout-reset">Reset order</button>
          <span class="layout-stats" id="layout-stats"></span>
        </div>
        <div class="layout-body">
          <section class="layout-preview" id="layout-preview-pages"></section>
        </div>
      </div>
    </section>
  `;

  const configPanel = app.querySelector('#config-panel');
  const guideModal = app.querySelector('#guide-modal');
  const btnGuide = app.querySelector('#btn-guide');
  const btnGuideClose = app.querySelector('#btn-guide-close');
  const btnLayoutReset = app.querySelector('#btn-layout-reset');
  const selLayoutCols = app.querySelector('#sel-layout-cols');
  const layoutStats = app.querySelector('#layout-stats');
  const layoutPreviewPages = app.querySelector('#layout-preview-pages');
  const DEFAULT_LAYOUT_COLS = '2';
  const btnSongSave = app.querySelector('#btn-song-save');
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
  const liveSectionPreview = document.createElement('aside');
  liveSectionPreview.className = 'section-live-preview';
  liveSectionPreview.style.display = 'none';
  liveSectionPreview.setAttribute('aria-label', 'Live section preview');
  let livePreviewHostRow = null;
  const selDir = app.querySelector('#sel-dir');
  selDir.value = cfg.defaultDirection;

  const applyToolbarTooltips = () => {
    const tips = [
      ['#btn-song-save', 'Save current song. If this is a new song, you will be asked to name it.'],
      ['#btn-song-save-as', 'Save current content under a new song name.'],
      ['#btn-song-delete', 'Delete the currently selected saved song.'],
      ['#btn-song-export', 'Export only the current song as a JSON file.'],
      ['#btn-song-import', 'Import a single song JSON file.'],
      ['#btn-song-export-all', 'Export your full song library as one JSON file.'],
      ['#btn-song-import-all', 'Import a full song library JSON file.'],
      ['#btn-apply-dir', 'Apply selected text direction to all rows.'],
      ['#btn-guide', 'Open the quick visual guide.'],
      ['#btn-guide-close', 'Close the quick guide.'],
      ['#btn-layout-reset', 'Reset section order to current song order.'],
      ['#btn-config', 'Open row height and font settings.'],
      ['#btn-preview-html', 'Open a quick HTML preview in a new tab.'],
      ['#btn-export-html', 'Download current song as an HTML file.'],
      ['#btn-print-pdf', 'Open print dialog to print or save as PDF.'],
      ['#sel-song', 'Choose an existing song or start a new one.'],
      ['#sel-dir', 'Default direction for newly created rows.'],
    ];
    for (const [sel, text] of tips) {
      const el = app.querySelector(sel);
      if (el) el.title = text;
    }
  };

  const updateSaveAttention = () => {
    const unnamed = !getCurrentSongName();
    btnSongSave.classList.toggle('attention-save', unnamed);
    if (unnamed) {
      btnSongSave.title = 'Save now: this song has no name yet.';
    } else {
      btnSongSave.title = 'Save changes to the current song.';
    }
  };

  applyToolbarTooltips();

  const setGuideOpen = (open) => {
    guideModal.classList.toggle('open', open);
    guideModal.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  btnGuide.addEventListener('click', () => setGuideOpen(true));
  btnGuideClose.addEventListener('click', () => setGuideOpen(false));
  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) setGuideOpen(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && guideModal.classList.contains('open')) {
      setGuideOpen(false);
    }
  });

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

  const getDocumentSnapshot = () => collectSnapshots(rows);
  const snapshotToKey = (snapshot) => JSON.stringify(snapshot);
  const updateHistoryButtons = () => {
    return {
      canUndo: historyPast.length > 0,
      canRedo: historyFuture.length > 0,
    };
  };
  const resetHistory = (snapshot = getDocumentSnapshot()) => {
    historyPast = [];
    historyFuture = [];
    historyCurrent = snapshotToKey(snapshot);
    updateHistoryButtons();
  };
  const commitHistory = () => {
    if (suppressHistory) return;
    const snapshot = getDocumentSnapshot();
    const nextKey = snapshotToKey(snapshot);
    if (nextKey === historyCurrent) return;
    historyPast.push(JSON.parse(historyCurrent));
    historyCurrent = nextKey;
    historyFuture = [];
    updateHistoryButtons();
  };

  let layoutOrder = [];

  const buildSectionsFromRows = () => {
    const sections = [];
    let current = null;
    let unnamedCount = 0;
    const pushCurrent = () => {
      if (current) sections.push(current);
      current = null;
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowSnap = {
        kind: normalizeKind(r.wrap.dataset.kind),
        lyrics: r.lyricsEl.value,
        chords: normalizeChordMap(r.chords),
        sectionEnd: r._sectionEnd === true,
      };

      if (rowSnap.kind === 'header') {
        pushCurrent();
        const name = String(rowSnap.lyrics || '').trim().split(/\r?\n/)[0] || `Section ${sections.length + 1}`;
        current = {
          id: `h:${i}`,
          title: name,
          startIndex: i,
          rows: [rowSnap],
        };
        continue;
      }

      if (!current) {
        unnamedCount += 1;
        current = {
          id: `u:${i}:${unnamedCount}`,
          title: `Section ${sections.length + 1}`,
          startIndex: i,
          rows: [],
        };
      }
      current.rows.push(rowSnap);
      if (rowSnap.sectionEnd) {
        pushCurrent();
      }
    }
    pushCurrent();
    return sections;
  };

  const estimateRowHeight = (rowSnap, columnWidth) => {
    if (rowSnap.kind === 'header') {
      return Math.max(34, cfg.lyricFontSize * 2.1);
    }
    if (rowSnap.kind === 'chords') {
      const chordCount =
        Object.keys(normalizeChordMap(rowSnap.chords)).length ||
        String(rowSnap.lyrics || '').trim().split(/\s+/).filter(Boolean).length ||
        1;
      const perLine = Math.max(4, Math.floor((columnWidth - 40) / 58));
      const lines = Math.max(1, Math.ceil(chordCount / perLine));
      return 16 + lines * (cfg.chordFontSize * 1.5) + 18;
    }
    const text = String(rowSnap.lyrics || '');
    const logicalLines = text.split(/\r?\n/);
    const avgChar = cfg.useMonospace ? cfg.lyricFontSize * 0.62 : cfg.lyricFontSize * 0.55;
    const capacity = Math.max(8, Math.floor((columnWidth - 34) / avgChar));
    let visualLines = 0;
    for (const ln of logicalLines) {
      visualLines += Math.max(1, Math.ceil(Math.max(1, ln.length) / capacity));
    }
    return cfg.chordMinHeight + visualLines * (cfg.lyricFontSize * 1.35) + 16;
  };

  const inferLayoutDirection = () => {
    const firstMeaningful = rows.find((r) => {
      const hasLyrics = String(r.lyricsEl?.value || '').trim().length > 0;
      const hasChords = Object.keys(normalizeChordMap(r.chords || {})).length > 0;
      return hasLyrics || hasChords;
    });
    const rowDir = firstMeaningful?.wrap?.dataset?.dir;
    if (rowDir === 'rtl' || rowDir === 'ltr') return rowDir;
    return cfg.defaultDirection === 'rtl' ? 'rtl' : 'ltr';
  };

  const buildEstimatedLayout = (sections, columns, layoutDir = 'ltr') => {
    const safeColumns = Math.min(3, Math.max(1, Number(columns) || 2));
    const isRtl = layoutDir === 'rtl' && safeColumns > 1;
    const pageHeight = 980;
    const columnWidth = Math.floor((780 - (safeColumns - 1) * 14) / safeColumns);
    const ordered = layoutOrder
      .map((id) => sections.find((s) => s.id === id))
      .filter(Boolean);
    const rest = sections.filter((s) => !layoutOrder.includes(s.id));
    const all = [...ordered, ...rest];

    layoutOrder = all.map((s) => s.id);

    for (const s of all) {
      s.estimatedHeight = s.rows.reduce((acc, r) => acc + estimateRowHeight(r, columnWidth), 12) + 14;
      s.nonHeaderRows = s.rows.filter((r) => r.kind !== 'header').length;
    }

    const buildPage = () => ({ columns: Array.from({ length: safeColumns }, () => []), heights: Array(safeColumns).fill(0) });
    const pages = [buildPage()];
    const columnOrder = isRtl
      ? Array.from({ length: safeColumns }, (_, i) => safeColumns - 1 - i)
      : Array.from({ length: safeColumns }, (_, i) => i);
    let currentColumnOrderIndex = 0;

    for (const s of all) {
      let page = pages[pages.length - 1];
      let colIndex = columnOrder[currentColumnOrderIndex];

      while (
        page.columns[colIndex].length > 0 &&
        page.heights[colIndex] + s.estimatedHeight > pageHeight
      ) {
        currentColumnOrderIndex += 1;
        if (currentColumnOrderIndex >= columnOrder.length) {
          page = buildPage();
          pages.push(page);
          currentColumnOrderIndex = 0;
        } else {
          page = pages[pages.length - 1];
        }
        colIndex = columnOrder[currentColumnOrderIndex];
      }

      page.columns[colIndex].push(s);
      page.heights[colIndex] += s.estimatedHeight + 10;
    }

    return { pages, sections: all, columns: safeColumns };
  };

  const getLayoutOptions = () => {
    const sections = buildSectionsFromRows();
    const model = buildEstimatedLayout(sections, selLayoutCols.value, inferLayoutDirection());
    return {
      columns: model.columns,
      order: [...layoutOrder],
      pages: model.pages.map((p) => ({
        columns: p.columns.map((col) => col.map((s) => s.id)),
      })),
    };
  };

  const refreshLayoutBoard = () => {
    const sections = buildSectionsFromRows();
    const { pages, sections: orderedSections, columns } = buildEstimatedLayout(
      sections,
      selLayoutCols.value,
      inferLayoutDirection()
    );

    layoutStats.textContent = `${orderedSections.length} sections · ${pages.length} pages · drag cards to reorder`;

    layoutPreviewPages.innerHTML = pages
      .map((p, pi) => {
        const colsHtml = p.columns
          .map(
            (col) =>
              `<div class="layout-col">${col
                .map(
                  (s) =>
                    `<article class="layout-card" draggable="true" data-section-id="${s.id}" title="Drag to reorder. Click to locate in editor." style="height:${Math.max(42, Math.round(s.estimatedHeight * 0.24))}px">
                      <strong>${s.title}</strong>
                      <span>${s.nonHeaderRows} lines</span>
                    </article>`
                )
                .join('')}</div>`
          )
          .join('');
        return `<section class="layout-page"><h4>Page ${pi + 1}</h4><div class="layout-page-grid cols-${columns}">${colsHtml}</div></section>`;
      })
      .join('');
  };

  btnLayoutReset.addEventListener('click', () => {
    layoutOrder = [];
    refreshLayoutBoard();
  });
  selLayoutCols.addEventListener('change', () => refreshLayoutBoard());

  let layoutDragId = null;
  layoutPreviewPages.addEventListener('click', (e) => {
    const card = e.target.closest('.layout-card[data-section-id]');
    if (!card) return;
    const id = card.dataset.sectionId;
    const sec = buildSectionsFromRows().find((s) => s.id === id);
    if (!sec) return;
    const target = rows[sec.startIndex];
    target?.lyricsEl?.focus();
    target?.wrap?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  layoutPreviewPages.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.layout-card[data-section-id]');
    if (!item) return;
    layoutDragId = item.dataset.sectionId;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layoutDragId);
  });
  layoutPreviewPages.addEventListener('dragend', () => {
    layoutDragId = null;
    layoutPreviewPages.querySelectorAll('.layout-card.dragging').forEach((el) => el.classList.remove('dragging'));
    layoutPreviewPages.querySelectorAll('.layout-card.drop-before').forEach((el) => el.classList.remove('drop-before'));
  });
  layoutPreviewPages.addEventListener('dragover', (e) => {
    if (!layoutDragId) return;
    e.preventDefault();
    const item = e.target.closest('.layout-card[data-section-id]');
    if (!item || item.dataset.sectionId === layoutDragId) return;
    layoutPreviewPages.querySelectorAll('.layout-card.drop-before').forEach((el) => el.classList.remove('drop-before'));
    item.classList.add('drop-before');
  });
  layoutPreviewPages.addEventListener('drop', (e) => {
    if (!layoutDragId) return;
    e.preventDefault();
    const item = e.target.closest('.layout-card[data-section-id]');
    if (!item) return;
    const targetId = item.dataset.sectionId;
    if (targetId === layoutDragId) return;
    const from = layoutOrder.indexOf(layoutDragId);
    const to = layoutOrder.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const copy = [...layoutOrder];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    layoutOrder = copy;
    refreshLayoutBoard();
  });

  let activeSectionId = null;

  const updateLiveSectionPreview = () => {
    if (!activeSectionId) {
      liveSectionPreview.style.display = 'none';
      return;
    }

    const sectionRows = rows.filter((r) => r.wrap?.dataset?.sectionId === activeSectionId);
    if (sectionRows.length === 0) {
      liveSectionPreview.style.display = 'none';
      return;
    }

    const focusedRow = rows.find((r) => r.lyricsEl === document.activeElement);
    const hostRow = (focusedRow && sectionRows.includes(focusedRow)) ? focusedRow : sectionRows[0];
    if (livePreviewHostRow !== hostRow) {
      liveSectionPreview.remove();
      hostRow.wrap.appendChild(liveSectionPreview);
      livePreviewHostRow = hostRow;
    }

    const dir = hostRow.wrap?.dataset?.dir === 'rtl' ? 'rtl' : 'ltr';
    liveSectionPreview.dataset.side = dir === 'rtl' ? 'left' : 'right';
    liveSectionPreview.setAttribute('dir', dir);

    const title = document.createElement('h5');
    title.textContent = dir === 'rtl' ? 'תצוגה מקדימה למקטע' : 'Section live preview';

    const body = document.createElement('div');
    body.className = 'section-live-preview-body';

    sectionRows.slice(0, 8).forEach((r) => {
      const line = document.createElement('div');
      const k = normalizeKind(r.kind);
      line.className = `section-live-row row-${k}`;
      if (k === 'header') {
        line.textContent = String(r.lyricsEl.value || '').trim().split(/\r?\n/)[0] || (dir === 'rtl' ? 'מקטע' : 'Section');
      } else if (k === 'chords') {
        const chordVals = Object.values(normalizeChordMap(r.chords || {})).filter(Boolean);
        line.textContent = chordVals.slice(0, 8).join('   ') || String(r.lyricsEl.value || '').trim() || (dir === 'rtl' ? 'מעבר אקורדים' : 'Chord transition');
      } else {
        line.textContent = String(r.lyricsEl.value || '').split(/\r?\n/)[0] || '...';
      }
      body.appendChild(line);
    });

    liveSectionPreview.replaceChildren(title, body);
    liveSectionPreview.style.display = 'block';
  };

  const refreshSectionVisuals = () => {
    let sectionCounter = 0;
    let currentSectionId = null;
    let currentSectionLabel = '';
    let openSection = false;

    for (const row of rows) {
      const isHeader = row.kind === 'header';
      const headerText = String(row.lyricsEl?.value || '').trim().split(/\r?\n/)[0] || '';
      row.refreshSectionPresetOptions?.();

      if (isHeader || !openSection) {
        sectionCounter += 1;
        currentSectionId = `section-${sectionCounter}`;
        currentSectionLabel = isHeader
          ? (headerText || `Section ${sectionCounter}`)
          : `Section ${sectionCounter}`;
        openSection = true;
      }

      row.wrap.dataset.sectionId = currentSectionId;
      row.wrap.classList.toggle('section-child-row', !isHeader);
      row.wrap.classList.toggle('section-header-row', isHeader);
      row.setSectionTag?.(`in ${currentSectionLabel}`, !isHeader);

      if (!isHeader && row.isSectionEnd?.()) {
        openSection = false;
      }
    }

    const focusedRow = rows.find((r) => r.lyricsEl === document.activeElement);
    if (focusedRow) {
      activeSectionId = focusedRow.wrap.dataset.sectionId || null;
    }

    for (const row of rows) {
      row.wrap.classList.toggle(
        'section-active',
        Boolean(activeSectionId) && row.wrap.dataset.sectionId === activeSectionId
      );
    }

    updateLiveSectionPreview();
  };

  const onRowChange = () => {
    persistAll();
    refreshSectionVisuals();
    refreshLayoutBoard();
    commitHistory();
  };

  const applySnapshotState = (snapshot) => {
    suppressHistory = true;
    rebuild(snapshot, { resetHistory: false });
    suppressHistory = false;
  };

  const undoChange = () => {
    if (historyPast.length === 0) return;
    const currentSnapshot = JSON.parse(historyCurrent);
    const prev = historyPast.pop();
    historyFuture.push(currentSnapshot);
    historyCurrent = JSON.stringify(prev);
    applySnapshotState(prev);
    updateHistoryButtons();
  };

  const redoChange = () => {
    if (historyFuture.length === 0) return;
    const currentSnapshot = JSON.parse(historyCurrent);
    const next = historyFuture.pop();
    historyPast.push(currentSnapshot);
    historyCurrent = JSON.stringify(next);
    applySnapshotState(next);
    updateHistoryButtons();
  };

  let chordsClipboard = [];
  let sectionClipboard = [];
  let dragCtx = null;

  const snapshotRow = (r) => ({
    lyrics: r.lyricsEl.value,
    chords: normalizeChordMap(r.chords),
    dir: r.wrap.dataset.dir === 'rtl' ? 'rtl' : 'ltr',
    kind: normalizeKind(r.wrap.dataset.kind),
    sectionEnd: r._sectionEnd === true,
  });

  const getSectionRows = (headerRow) => {
    const headerIdx = rows.indexOf(headerRow);
    if (headerIdx < 0 || headerRow.kind !== 'header') return [];
    const section = [headerRow];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.kind === 'header') break;
      section.push(r);
      if (r.isSectionEnd?.()) break;
    }
    return section;
  };

  const updatePasteButtons = () => {
    const hasRowClipboard = chordsClipboard.length > 0;
    for (const r of rows) {
      r.setPasteEnabled?.(hasRowClipboard);
      r.setSectionPasteEnabled?.(sectionClipboard.length > 0);
    }
  };

  const wireChordsHandlers = (row) => {
    row.onCopyChords = () => {
      const selectedRows = rows.filter((r) => r.isSelected?.());
      const source = (selectedRows.length > 0 && selectedRows.includes(row))
        ? selectedRows
        : [row];
      chordsClipboard = source.map((r) => ({ ...normalizeChordMap(r.chords) }));
      updatePasteButtons();
      row.flashCopyBtn?.();
    };
    row.onPasteChords = () => {
      if (chordsClipboard.length === 0) return;
      const startIdx = rows.indexOf(row);
      if (startIdx < 0) return;
      for (let i = 0; i < chordsClipboard.length; i++) {
        const target = rows[startIdx + i];
        if (!target) break;
        target.chords = { ...chordsClipboard[i] };
        layoutSchedule(target);
      }
      persistAll();
    };
    row.onCopySection = () => {
      if (row.kind !== 'header') return;
      const section = getSectionRows(row);
      const nonHeaderRows = section.filter((r) => r.kind !== 'header');
      sectionClipboard = nonHeaderRows.map((r) => ({ ...normalizeChordMap(r.chords) }));
      updatePasteButtons();
      row.flashCopySectionBtn?.();
    };
    row.onCloneSection = () => {
      if (row.kind !== 'header') return;
      const section = getSectionRows(row);
      if (section.length === 0) return;
      const snapshots = section.map((r) => snapshotRow(r));
      for (const d of snapshots) {
        const clone = createRow(editor, d, () => cfg, onRowChange, null, layoutSchedule);
        rows.push(clone);
        wireRow(clone);
      }
      row.flashCloneSectionBtn?.();
      onRowChange();
    };
    row.onPasteSection = () => {
      if (row.kind !== 'header' || sectionClipboard.length === 0) return;
      const targetSection = getSectionRows(row);
      const targetNonHeaders = targetSection.filter((r) => r.kind !== 'header');
      for (let i = 0; i < sectionClipboard.length && i < targetNonHeaders.length; i++) {
        targetNonHeaders[i].chords = { ...sectionClipboard[i] };
        layoutSchedule(targetNonHeaders[i]);
      }
      persistAll();
    };
  };

  const moveRows = (movingRows, targetRow, placeAfter) => {
    if (!movingRows || movingRows.length === 0 || !targetRow) return;
    const movingSet = new Set(movingRows);
    if (movingSet.has(targetRow)) return;

    const rest = rows.filter((r) => !movingSet.has(r));
    const base = rest.indexOf(targetRow);
    if (base < 0) return;
    const insertAt = placeAfter ? base + 1 : base;
    const next = [...rest.slice(0, insertAt), ...movingRows, ...rest.slice(insertAt)];
    rebuild(next.map((r) => snapshotRow(r)));
  };

  const wireDragHandlers = (row) => {
    const handle = row.getDragHandle?.();
    if (!handle) return;

    handle.addEventListener('dragstart', (e) => {
      const movingRows = row.kind === 'header' ? getSectionRows(row) : [row];
      dragCtx = { movingRows };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'row-move');
      row.wrap.classList.add('row-drag-origin');
    });

    handle.addEventListener('dragend', () => {
      dragCtx = null;
      for (const r of rows) {
        r.setDragTarget?.(false);
        r.wrap.classList.remove('row-drag-origin');
      }
    });

    row.wrap.addEventListener('dragover', (e) => {
      if (!dragCtx) return;
      e.preventDefault();
      const movingSet = new Set(dragCtx.movingRows);
      if (movingSet.has(row)) return;
      for (const r of rows) r.setDragTarget?.(false);
      row.setDragTarget?.(true);
      const rect = row.wrap.getBoundingClientRect();
      dragCtx.placeAfter = e.clientY > rect.top + rect.height / 2;
      dragCtx.targetRow = row;
    });

    row.wrap.addEventListener('dragleave', () => {
      row.setDragTarget?.(false);
    });

    row.wrap.addEventListener('drop', (e) => {
      if (!dragCtx) return;
      e.preventDefault();
      const { movingRows, targetRow, placeAfter } = dragCtx;
      dragCtx = null;
      for (const r of rows) r.setDragTarget?.(false);
      moveRows(movingRows, targetRow || row, Boolean(placeAfter));
    });
  };

  const wireRow = (row) => {
    wireInsertHandler(row);
    wireChordsHandlers(row);
    wireDragHandlers(row);
    row.onDelete = () => {
      if (rows.length <= 1) return;
      const idx = rows.indexOf(row);
      if (idx < 0) return;
      rows.splice(idx, 1);
      row.dispose?.();
      row.wrap.remove();
      onRowChange();
    };
    row.lyricsEl.addEventListener('focus', () => {
      activeSectionId = row.wrap.dataset.sectionId || null;
      refreshSectionVisuals();
    });
  };

  const wireInsertHandler = (row) => {
    row.onInsertAfter = () => insertRowAfter(row);
  };

  const insertRowAfter = (afterRow) => {
    const idx = rows.indexOf(afterRow);
    const d = {
      lyrics: '',
      chords: {},
      dir: afterRow?.wrap?.dataset?.dir || cfg.defaultDirection,
      kind: 'line',
    };
    const next = afterRow?.wrap?.nextSibling ?? null;
    const newRow = createRow(editor, d, () => cfg, onRowChange, next, layoutSchedule);
    if (idx >= 0) {
      rows.splice(idx + 1, 0, newRow);
    } else {
      rows.push(newRow);
    }
    wireRow(newRow);
    updatePasteButtons();
    onRowChange();
    newRow.lyricsEl.focus();
  };

  const rebuild = (data, options = {}) => {
    for (const r of rows) {
      r.dispose?.();
    }
    editor.innerHTML = '';
    rows = data.map((d) => createRow(editor, d, () => cfg, onRowChange, null, layoutSchedule));
    rows.forEach((r) => {
      wireRow(r);
      r.layoutChords?.();
    });
    refreshSectionVisuals();
    updatePasteButtons();
    persistAll();
    refreshLayoutBoard();
    if (options.resetHistory) {
      resetHistory(collectSnapshots(rows));
    }
  };

  applyConfigToRoot(cfg, root, document.body);
  bindConfigInputs();
  rebuild(loadDoc(), { resetHistory: true });

  editor.addEventListener('focusin', () => {
    refreshSectionVisuals();
  });

  window.addEventListener('keydown', (e) => {
    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoChange();
      return;
    }
    if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      redoChange();
    }
  });

  selDir.addEventListener('change', () => {
    cfg.defaultDirection = selDir.value;
    saveConfig(cfg);
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

  app.querySelector('#btn-preview-html').addEventListener('click', () => {
    const current = getCurrentSongName();
    const title = current ? String(current) : 'Lyrics & chords';
    const snapshots = collectSnapshots(rows);
    const html = buildPublishDocument(snapshots, cfg, { title, layout: getLayoutOptions() });
    openPreviewWindow(html);
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
    const html = buildPublishDocument(snapshots, cfg, { title, layout: getLayoutOptions() });
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
    const html = buildPublishDocument(snapshots, cfg, { title, layout: getLayoutOptions() });
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
    updateSaveAttention();
  };

  const switchSong = (name) => {
    if (!name) {
      setCurrentSongName(null);
      layoutOrder = [];
      selLayoutCols.value = DEFAULT_LAYOUT_COLS;
      rebuild([{ lyrics: '', chords: {}, dir: cfg.defaultDirection, kind: 'line' }], { resetHistory: true });
      selSong.value = '';
      updateSaveAttention();
      return;
    }
    
    const data = loadSong(name);
    if (data) {
      setCurrentSongName(name);
      layoutOrder = [];
      rebuild(data, { resetHistory: true });
      selSong.value = name;
      updateSaveAttention();
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

  const downloadJsonFile = (obj, filename) => {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    layoutOrder = [];
    selLayoutCols.value = DEFAULT_LAYOUT_COLS;
    updateSongList();
    rebuild([{ lyrics: '', chords: {}, dir: cfg.defaultDirection, kind: 'line' }], { resetHistory: true });
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
        sectionEnd: s.sectionEnd === true,
      })),
    };
    downloadJsonFile(payload, `${name.replace(/\W+/g, '-')}.json`);
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

  app.querySelector('#btn-song-export-all').addEventListener('click', () => {
    const list = loadSongList();
    if (list.length === 0) {
      alert('No saved songs to export');
      return;
    }
    const songs = list.map((name) => ({
      name,
      data: normalizeRowArray(loadSong(name), cfg.defaultDirection),
    }));
    const payload = {
      format: 'lyrics-chords-song-library-v1',
      exportedAt: new Date().toISOString(),
      currentSong: getCurrentSongName(),
      songs,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJsonFile(payload, `songs-library-${stamp}.json`);
    flashButtonText('#btn-song-export-all', 'Exported!');
  });

  app.querySelector('#btn-song-import-all').addEventListener('click', () => {
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
          const songs = Array.isArray(payload?.songs) ? payload.songs : null;
          if (!songs || songs.length === 0) {
            alert('Invalid library file format');
            return;
          }

          const replaceAll = confirm(
            'Replace all existing saved songs with imported songs?\nClick Cancel to merge with existing songs.'
          );

          const existingList = loadSongList();
          let nextList = replaceAll ? [] : [...existingList];

          if (replaceAll) {
            for (const name of existingList) {
              deleteSong(name);
            }
          }

          let importedCount = 0;
          for (const entry of songs) {
            const name = String(entry?.name || '').trim();
            if (!name) continue;
            const data = normalizeRowArray(entry?.data, cfg.defaultDirection);
            saveSong(name, data);
            if (!nextList.includes(name)) {
              nextList.push(name);
            }
            importedCount += 1;
          }

          if (importedCount === 0) {
            alert('No valid songs found in file');
            return;
          }

          saveSongList(nextList);
          updateSongList();

          const preferredCurrent = String(payload?.currentSong || '').trim();
          const nextCurrent = nextList.includes(preferredCurrent) ? preferredCurrent : nextList[0];
          switchSong(nextCurrent);

          alert(`Imported ${importedCount} songs`);
          flashButtonText('#btn-song-import-all', 'Imported!');
        } catch {
          alert('Error parsing file');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  updateSongList();
  updateSaveAttention();
  refreshLayoutBoard();
}

mount();
