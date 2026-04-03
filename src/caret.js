/**
 * Caret position inside a textarea (for placing chord boxes above a character index).
 * Adapted from the textarea-caret-position approach (mirror + marker span).
 */
export function getCaretCoordinates(textarea, position) {
  const computed = getComputedStyle(textarea);
  const isTextarea = textarea.nodeName === 'TEXTAREA';

  const div = document.createElement('div');
  const style = div.style;
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.overflow = isTextarea ? 'hidden' : 'visible';
  style.whiteSpace = isTextarea ? 'pre-wrap' : 'pre';
  style.wordWrap = 'break-word';
  style.width = `${textarea.clientWidth}px`;
  if (isTextarea) {
    style.height = `${textarea.scrollHeight}px`;
  }
  style.font = computed.font;
  style.padding = computed.padding;
  style.border = computed.border;
  style.boxSizing = computed.boxSizing;
  style.direction = computed.direction;
  style.lineHeight = computed.lineHeight;
  style.letterSpacing = computed.letterSpacing;
  style.textTransform = computed.textTransform;
  style.textIndent = computed.textIndent;
  style.tabSize = computed.tabSize;

  const val = textarea.value;
  div.textContent = val.substring(0, position);
  const span = document.createElement('span');
  span.textContent = val.substring(position) || '\u200b';
  div.appendChild(span);

  document.body.appendChild(div);

  const borderLeft = parseInt(computed.borderLeftWidth, 10) || 0;
  const borderTop = parseInt(computed.borderTopWidth, 10) || 0;

  const top = span.offsetTop + borderTop;
  const left = span.offsetLeft + borderLeft;
  const height = span.offsetHeight || parseFloat(computed.lineHeight) || 16;

  document.body.removeChild(div);

  return { top, left, height };
}
