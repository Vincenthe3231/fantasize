import { useCallback, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useStore } from 'reactflow';

const GAP_PX = 10;
const VIEWPORT_PAD_PX = 12;

export type RichTextToolbarPortalPlacement = {
  top: number;
  left: number;
  visible: boolean;
};

const hiddenPlacement: RichTextToolbarPortalPlacement = {
  top: 0,
  left: 0,
  visible: false,
};

/**
 * Viewport-fixed coordinates for a portaled rich-text toolbar above `anchorEl`.
 * Updates on window resize/scroll, anchor/toolbar resize, and React Flow viewport transform (pan/zoom).
 */
export function useRichTextToolbarPortalPosition(
  anchorEl: HTMLElement | null,
  open: boolean,
  toolbarRef: RefObject<HTMLElement | null>
): RichTextToolbarPortalPlacement {
  const transform = useStore((s) => s.transform);
  const transformKey = `${transform[0]},${transform[1]},${transform[2]}`;

  const [placement, setPlacement] = useState<RichTextToolbarPortalPlacement>(hiddenPlacement);

  const measure = useCallback(() => {
    if (!open || !anchorEl || !document.contains(anchorEl)) {
      setPlacement(hiddenPlacement);
      return;
    }
    const r = anchorEl.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) {
      setPlacement(hiddenPlacement);
      return;
    }
    const toolbarEl = toolbarRef.current;
    const th = toolbarEl?.offsetHeight ?? 44;
    const tw = toolbarEl?.offsetWidth ?? 280;
    const top = r.top - GAP_PX - th;
    const centerX = r.left + r.width / 2;
    const halfW = tw / 2;
    const minCenter = VIEWPORT_PAD_PX + halfW;
    const maxCenter = window.innerWidth - VIEWPORT_PAD_PX - halfW;
    const left = Math.max(minCenter, Math.min(centerX, maxCenter));
    setPlacement({ top, left, visible: true });
  }, [open, anchorEl, toolbarRef, transformKey]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    if (!open) return;
    const onWin = () => measure();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, measure]);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(anchorEl);
    const te = toolbarRef.current;
    if (te) ro.observe(te);
    return () => ro.disconnect();
  }, [open, anchorEl, toolbarRef, measure]);

  return placement;
}
