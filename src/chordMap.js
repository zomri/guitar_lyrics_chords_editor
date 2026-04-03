/**
 * Find a single edit between two strings (insert / delete / replace).
 */
export function findEditRange(oldStr, newStr) {
  if (oldStr === newStr) return null;
  let start = 0;
  const minLen = Math.min(oldStr.length, newStr.length);
  while (start < minLen && oldStr[start] === newStr[start]) start += 1;
  let endOld = oldStr.length;
  let endNew = newStr.length;
  while (endOld > start && endNew > start && oldStr[endOld - 1] === newStr[endNew - 1]) {
    endOld -= 1;
    endNew -= 1;
  }
  return {
    start,
    removedLen: endOld - start,
    insertedLen: endNew - start,
  };
}

/**
 * Remap chord indices when lyrics text is edited. Chords sit on a character index;
 * if that index is removed, the chord is dropped; indices after the edit shift.
 */
export function remapChordMap(map, edit) {
  if (!edit) return { ...map };
  const { start, removedLen, insertedLen } = edit;
  const delta = insertedLen - removedLen;
  const next = {};
  for (const [kStr, v] of Object.entries(map)) {
    const k = Number(kStr);
    if (!Number.isFinite(k) || v == null || String(v).trim() === '') continue;
    if (k < start) {
      next[k] = v;
    } else if (k < start + removedLen) {
      continue;
    } else {
      next[k + delta] = v;
    }
  }
  return next;
}

export function normalizeChordMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const idx = Number(k);
    if (!Number.isFinite(idx) || idx < 0) continue;
    const s = String(v).trim();
    if (s) out[idx] = s;
  }
  return out;
}
