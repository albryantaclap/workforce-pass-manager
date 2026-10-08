import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 4;
const EDGE = 8;

/**
 * Dropdown layer for search fields that live inside a scrollable table.
 *
 * The panel is rendered through a React portal so no scroll container, overflow
 * or stacking context can clip it. It is portalled into the surrounding modal
 * (when there is one) so a click inside the panel never dismisses the modal, and
 * it is positioned against the field's real position — flipping above the field
 * when there is little room below, and following the field whenever the page,
 * modal or table is scrolled or resized. Escape and outside clicks close it.
 */
export default function AnchoredDropdown({ anchorRef, open, onClose, width = 320, maxHeight = 300, children }) {
  const panelRef = useRef(null);
  const [style, setStyle] = useState(null);

  const dialogEl = open && anchorRef.current ? anchorRef.current.closest('[role="dialog"]') : null;
  const inDialog = !!dialogEl;

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const place = () => {
      const el = anchorRef.current;
      if (!el || !el.isConnected) return;
      const dialog = el.closest('[role="dialog"]');
      const bounds = dialog
        ? dialog.getBoundingClientRect()
        : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
      const scrollTop = dialog ? dialog.scrollTop : 0;
      const scrollLeft = dialog ? dialog.scrollLeft : 0;

      const rect = el.getBoundingClientRect();
      const panelWidth = Math.max(width, Math.round(rect.width));
      const measured = panelRef.current ? panelRef.current.offsetHeight : maxHeight;

      const roomBelow = bounds.bottom - rect.bottom - GAP - EDGE;
      const roomAbove = rect.top - bounds.top - GAP - EDGE;
      // Flip above only when below is cramped and above has more room.
      const flip = roomBelow < Math.min(measured, 200) && roomAbove > roomBelow;
      const limit = Math.max(140, Math.min(maxHeight, flip ? roomAbove : roomBelow));
      const panelHeight = Math.min(measured || limit, limit);

      const left = Math.min(
        Math.max(bounds.left + EDGE, rect.left),
        Math.max(bounds.left + EDGE, bounds.right - panelWidth - EDGE)
      );
      const viewportTop = flip ? rect.top - panelHeight - GAP : rect.bottom + GAP;

      setStyle({
        position: dialog ? 'absolute' : 'fixed',
        left: Math.round(left - bounds.left + scrollLeft),
        top: dialog ? Math.round(viewportTop - bounds.top + scrollTop) : Math.round(viewportTop),
        width: panelWidth,
        maxHeight: limit,
        zIndex: 60,
        // Radix blocks pointer events on the body while a modal dialog is open.
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      });
    };

    place();
    // Second pass: the measured panel height is only known once it is rendered.
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchorRef, width, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    const onDown = (e) => {
      if (anchorRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !style) return null;
  return createPortal(
    <div ref={panelRef} style={style} className="rounded-md border bg-popover shadow-xl">
      {children}
    </div>,
    dialogEl || document.body
  );
}