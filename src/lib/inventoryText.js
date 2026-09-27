// Inventory text helpers.
//
// Excel cells that are rich text, formulas or hyperlinks come back from ExcelJS
// as objects, and an earlier import ran String() over them — so records ended
// up holding the literal text "[object Object]". These helpers pull the real
// text out of any of those shapes and never let a placeholder reach the screen.
export const ELEMENT_PLACEHOLDER = '[object Object]';

export const textValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === ELEMENT_PLACEHOLDER ? '' : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    // Concatenate the fragments untrimmed (a fragment often ends in the space
    // that separates it from the next one) and trim only the final result.
    if (Array.isArray(value.richText)) {
      return value.richText
        .map((p) => (typeof p?.text === 'string' ? p.text : textValue(p?.text)))
        .join('')
        .trim();
    }
    if (value.result !== undefined && value.result !== null) return textValue(value.result);
    if (value.text !== undefined) return textValue(value.text);
    if (value.value !== undefined) return textValue(value.value);
    if (value.label !== undefined) return textValue(value.label);
  }
  return '';
};

// True when the stored value carries no usable text (blank, null or a leftover
// object placeholder) — this is exactly what the name/unit repair looks for.
export const isMissingText = (value) => !textValue(value);

// Display helpers — a missing name/unit shows as a dash, never as an object.
export const itemDisplayName = (record) => textValue(record?.item_name) || '—';
export const itemDisplayUnit = (record) => textValue(record?.unit) || '—';