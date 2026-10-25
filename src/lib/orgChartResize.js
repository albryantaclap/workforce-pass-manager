// Eight-handle resize geometry for the Visual Chart Builder.
//
// Every value here is in WORLD (canvas) units. The pointer delta must already
// have been converted with the editor's own toWorld() helper, so zoom and pan
// are accounted for exactly once and must never be applied again in here.
//
// The calculation is absolute: it always starts from the geometry captured when
// the gesture began, so the dragged handle stays under the cursor and repeated
// pointer moves can never accumulate.

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const HANDLE_CURSORS = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

export const RESIZE_MIN = { width: 80, height: 50 };

const rotatePoint = (x, y, deg) => {
  if (!deg) return { x, y };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
};

/**
 * Compute the geometry produced by dragging a resize handle.
 *
 * start      : { x, y, width, height } captured when the gesture began
 * handle     : one of RESIZE_HANDLES
 * dx, dy     : pointer displacement in world units since the gesture began
 * rotation   : object rotation in degrees (0 for a plain, unrotated object)
 * aspect     : Shift — keep the original aspect ratio on corner handles
 * fromCenter : Alt/Option — grow symmetrically around the centre
 * snap, grid : Snap to Grid
 */
export function computeResize({
  start,
  handle = 'se',
  dx = 0,
  dy = 0,
  rotation = 0,
  aspect = false,
  fromCenter = false,
  snap = false,
  grid = 20,
  min = RESIZE_MIN,
}) {
  const w0 = Math.max(min.width, Number(start?.width) || min.width);
  const h0 = Math.max(min.height, Number(start?.height) || min.height);
  const x0 = Number(start?.x) || 0;
  const y0 = Number(start?.y) || 0;

  const left = handle.includes('w');
  const right = handle.includes('e');
  const top = handle.includes('n');
  const bottom = handle.includes('s');

  // Pointer movement expressed in the object's own axes, so a rotated object
  // resizes along its own edges instead of the screen axes.
  const local = rotatePoint(dx, dy, -rotation);

  let width = w0;
  let height = h0;
  if (right) width = w0 + local.x;
  else if (left) width = w0 - local.x;
  if (bottom) height = h0 + local.y;
  else if (top) height = h0 - local.y;

  if (fromCenter) {
    if (right) width = w0 + local.x * 2;
    else if (left) width = w0 - local.x * 2;
    if (bottom) height = h0 + local.y * 2;
    else if (top) height = h0 - local.y * 2;
  }

  const isCorner = (left || right) && (top || bottom);
  if (aspect && isCorner && h0 > 0) {
    const ratio = w0 / h0;
    if (Math.abs(width - w0) >= Math.abs(height - h0) * ratio) height = width / ratio;
    else width = height * ratio;
  }

  width = Math.max(min.width, width);
  height = Math.max(min.height, height);

  if (fromCenter) {
    const cx = x0 + w0 / 2;
    const cy = y0 + h0 / 2;
    return {
      x: Math.round(cx - width / 2),
      y: Math.round(cy - height / 2),
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  // The edge/corner opposite the grabbed handle stays exactly where it is.
  const ax = left ? 1 : right ? -1 : 0;
  const ay = top ? 1 : bottom ? -1 : 0;
  const anchorOffset = rotatePoint((ax * w0) / 2, (ay * h0) / 2, rotation);
  const anchor = { x: x0 + w0 / 2 + anchorOffset.x, y: y0 + h0 / 2 + anchorOffset.y };
  const half = rotatePoint((ax * width) / 2, (ay * height) / 2, rotation);
  const cx = anchor.x - half.x;
  const cy = anchor.y - half.y;

  let x = cx - width / 2;
  let y = cy - height / 2;

  // Snap only when the object is axis aligned — snapping a rotated edge to the
  // world grid would fight the object's own axes.
  const normalised = Math.abs(Math.round(rotation) % 360);
  const snapActive = snap && !normalised;
  if (snapActive) {
    const g = Math.max(1, Number(grid) || 20);
    if (top) {
      y = Math.round(y / g) * g;
      height = Math.max(min.height, y0 + h0 - y);
    } else if (bottom) {
      y = y0;
      height = Math.max(min.height, Math.round((y + height) / g) * g - y);
    }
    if (left) {
      x = Math.round(x / g) * g;
      width = Math.max(min.width, x0 + w0 - x);
    } else if (right) {
      x = x0;
      width = Math.max(min.width, Math.round((x + width) / g) * g - x);
    }
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.max(min.width, width)),
    height: Math.round(Math.max(min.height, height)),
  };
}