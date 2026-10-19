/**
 * Stops the benign "ResizeObserver loop completed with undelivered notifications" error.
 *
 * The browser raises that message as a window error when a ResizeObserver callback
 * (charts, dropdowns, print previews measuring themselves) changes the layout of the
 * element it is observing during the very same delivery cycle. Nothing is actually
 * broken — but the browser reports it as an app error.
 *
 * Running every callback one animation frame later removes that synchronous feedback:
 * measuring still happens (one frame later, imperceptible), while no new notifications
 * are produced inside the delivery cycle, so the false error is never raised.
 */
export function installResizeObserverGuard() {
  if (typeof window === 'undefined' || !window.ResizeObserver) return;

  const NativeResizeObserver = window.ResizeObserver;

  window.ResizeObserver = class extends NativeResizeObserver {
    constructor(callback) {
      let active = true;
      super((entries, observer) => {
        requestAnimationFrame(() => {
          if (active) callback(entries, observer);
        });
      });
      const nativeDisconnect = this.disconnect.bind(this);
      this.disconnect = () => {
        active = false;
        nativeDisconnect();
      };
    }
  };
}