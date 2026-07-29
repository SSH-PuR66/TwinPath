import { useEffect } from "react";

// Toggles is-more / is-end on every .tp-pane__body inside the container so the
// bottom fade appears only where content genuinely continues. Cheap: one
// ResizeObserver, passive scroll listeners, no state, no re-render.
export function usePaneOverflow(rootRef) {
  useEffect(() => {
    const root = rootRef?.current ?? document;
    const panes = Array.from(root.querySelectorAll(".tp-pane__body"));
    if (!panes.length) return undefined;

    const sync = (el) => {
      const over = el.scrollHeight - el.clientHeight;
      el.classList.toggle("is-more", over > 4);
      el.classList.toggle("is-end", over > 4 && el.scrollTop >= over - 4);
    };
    const onScroll = (e) => sync(e.currentTarget);

    panes.forEach((el) => {
      sync(el);
      el.addEventListener("scroll", onScroll, { passive: true });
    });

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => entries.forEach((e) => sync(e.target)));
      panes.forEach((el) => ro.observe(el));
    }
    const onResize = () => panes.forEach(sync);
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      panes.forEach((el) => el.removeEventListener("scroll", onScroll));
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [rootRef]);
}
