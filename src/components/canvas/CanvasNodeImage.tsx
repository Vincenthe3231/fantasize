import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
} from 'react';
import {
  canvasPreviewImageUrl,
  canvasStableImageUrl,
  isSupabasePublicTransformUrl,
} from '@/lib/imageDelivery';
import { canvasPerfFlags } from '@/lib/canvasPerf';
import { cn } from '@/lib/utils';
import { useCanvasViewportGestureActive } from '@/contexts/CanvasViewportGestureContext';
import { useCanvasViewportLowZoomVisualHide } from '@/contexts/CanvasViewportImagePolicyContext';

/** Retries after a real `error` event only (not user-driven aborts); same stable `src`. */
const MAX_IMAGE_ERROR_RETRIES = 2;

type BaseProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'decoding' | 'width' | 'height'
> & {
  mediaUrl: string;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
  /**
   * When set, use a single transform URL with this CSS width (and optional height) — stable, small
   * thumbnails (e.g. list rows). When omitted, use `canvasStableImageUrl` with `canvasImageStableMaxWidth`.
   */
  fixedCssWidth?: number;
  fixedCssHeight?: number;
};

/**
 * Canvas node image: stable Supabase transform URL (fixed width cap, or explicit fixedCssWidth),
 * **WebP first** for eligible public object URLs; on `error`, falls back to **`format=origin`** once,
 * then capped same-URL retries. Non-Supabase URLs pass through unchanged.
 * Optional freeze of URL updates during viewport/node-drag gestures, and `decode()` after load.
 * Low zoom uses **CSS hiding** (img stays mounted) with hysteresis from `CanvasViewportImagePolicyBridge`
 * so loads can complete and cache instead of `NS_BINDING_ABORTED` from unmount/`src` churn.
 * Default `loading` is `eager` in flow when `canvasImageEagerInFlow` — stable URL + eager reduces
 * transform fights; pass `loading="lazy"` to override (e.g. dialogs).
 */
const CanvasNodeImage = memo(function CanvasNodeImage({
  mediaUrl,
  quality,
  resize = 'cover',
  fixedCssWidth,
  fixedCssHeight,
  className,
  onLoad,
  onError,
  loading,
  fetchPriority,
  ...rest
}: BaseProps) {
  const lowZoomVisualHide = useCanvasViewportLowZoomVisualHide();
  const gestureActive =
    useCanvasViewportGestureActive() && canvasPerfFlags.deferCanvasImageUrlDuringViewport;
  const resolvedLoading =
    loading !== undefined
      ? loading
      : canvasPerfFlags.canvasImageEagerInFlow
        ? 'eager'
        : 'lazy';

  const transformEligible = useMemo(
    () => isSupabasePublicTransformUrl(mediaUrl),
    [mediaUrl]
  );

  const { webpSrc, originSrc } = useMemo(() => {
    if (fixedCssWidth != null) {
      const base = {
        width: fixedCssWidth,
        height: fixedCssHeight,
        quality: quality ?? 60,
        resize,
      };
      return {
        webpSrc: canvasPreviewImageUrl(mediaUrl, { ...base, format: 'webp' }),
        originSrc: canvasPreviewImageUrl(mediaUrl, { ...base, format: 'origin' }),
      };
    }
    const base = {
      maxWidth: canvasPerfFlags.canvasImageStableMaxWidth,
      quality: quality ?? 70,
      resize,
    };
    return {
      webpSrc: canvasStableImageUrl(mediaUrl, { ...base, format: 'webp' }),
      originSrc: canvasStableImageUrl(mediaUrl, { ...base, format: 'origin' }),
    };
  }, [
    mediaUrl,
    fixedCssWidth,
    fixedCssHeight,
    quality,
    resize,
    canvasPerfFlags.canvasImageStableMaxWidth,
  ]);

  const [useOriginFallback, setUseOriginFallback] = useState(false);

  useEffect(() => {
    setUseOriginFallback(false);
  }, [mediaUrl, fixedCssWidth, fixedCssHeight, quality, resize]);

  const desiredSrc = useMemo(() => {
    if (!transformEligible) return webpSrc;
    return useOriginFallback ? originSrc : webpSrc;
  }, [transformEligible, useOriginFallback, webpSrc, originSrc]);

  const desired = useMemo(() => ({ src: desiredSrc }), [desiredSrc]);

  const [displayed, setDisplayed] = useState(desired);

  useEffect(() => {
    if (gestureActive) return;
    setDisplayed(desired);
  }, [desired, gestureActive]);

  const errorRetryRef = useRef(0);

  useEffect(() => {
    errorRetryRef.current = 0;
  }, [displayed.src]);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      errorRetryRef.current = 0;
      const img = e.currentTarget;
      if (typeof img.decode === 'function') {
        void img.decode().catch(() => {});
      }
      onLoad?.(e);
    },
    [onLoad]
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const el = e.currentTarget;
      const url = el.getAttribute('src') ?? '';
      if (!url) {
        onError?.(e);
        return;
      }
      if (transformEligible && !useOriginFallback) {
        setUseOriginFallback(true);
        return;
      }
      if (errorRetryRef.current < MAX_IMAGE_ERROR_RETRIES) {
        errorRetryRef.current += 1;
        el.src = '';
        requestAnimationFrame(() => {
          el.src = url;
        });
        return;
      }
      onError?.(e);
    },
    [onError, transformEligible, useOriginFallback]
  );

  return (
    <div
      className={cn(
        'relative isolate min-h-0 min-w-0 h-full w-full',
        lowZoomVisualHide && 'bg-muted/30'
      )}
    >
      <img
        {...rest}
        src={displayed.src}
        decoding="async"
        loading={resolvedLoading}
        {...(fetchPriority != null
          ? ({ fetchpriority: fetchPriority } as ImgHTMLAttributes<HTMLImageElement>)
          : {})}
        className={cn(
          className,
          lowZoomVisualHide && 'pointer-events-none opacity-0 invisible'
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
});

export default CanvasNodeImage;
