import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ImgHTMLAttributes,
} from 'react';
import { canvasPreviewImageUrl, canvasStableImageUrl } from '@/lib/imageDelivery';
import { canvasPerfFlags } from '@/lib/canvasPerf';
import { cn } from '@/lib/utils';
import { useCanvasViewportGestureActive } from '@/contexts/CanvasViewportGestureContext';
import { useCanvasViewportHideNodeImages } from '@/contexts/CanvasViewportImagePolicyContext';

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
 * optional freeze of URL changes during viewport/node-drag gestures, and `decode()` after load.
 * When zoomed out (`CanvasViewportImagePolicyBridge`), skips real `<img>` and shows a placeholder.
 * Default `loading` follows `canvasPerfFlags.canvasImageEagerInFlow` (eager) so pan inside RF
 * transforms does not fight native lazy visibility; pass `loading="lazy"` to override (e.g. dialogs).
 */
const CanvasNodeImage = memo(function CanvasNodeImage({
  mediaUrl,
  quality,
  resize = 'cover',
  fixedCssWidth,
  fixedCssHeight,
  className,
  onLoad,
  loading,
  fetchPriority,
  ...rest
}: BaseProps) {
  const hideImages = useCanvasViewportHideNodeImages();
  const gestureActive =
    useCanvasViewportGestureActive() && canvasPerfFlags.deferCanvasImageUrlDuringViewport;
  const resolvedLoading =
    loading !== undefined
      ? loading
      : canvasPerfFlags.canvasImageEagerInFlow
        ? 'eager'
        : 'lazy';

  const desired = useMemo(() => {
    if (hideImages) {
      return {
        src: '',
      };
    }
    if (fixedCssWidth != null) {
      return {
        src: canvasPreviewImageUrl(mediaUrl, {
          width: fixedCssWidth,
          height: fixedCssHeight,
          quality: quality ?? 60,
          format: 'webp',
          resize,
        }),
      };
    }
    return {
      src: canvasStableImageUrl(mediaUrl, {
        maxWidth: canvasPerfFlags.canvasImageStableMaxWidth,
        quality: quality ?? 70,
        format: 'webp',
        resize,
      }),
    };
  }, [hideImages, mediaUrl, fixedCssWidth, fixedCssHeight, quality, resize]);

  const [displayed, setDisplayed] = useState(desired);

  useEffect(() => {
    if (hideImages || gestureActive) return;
    setDisplayed(desired);
  }, [desired, gestureActive, hideImages]);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (typeof img.decode === 'function') {
        void img.decode().catch(() => {});
      }
      onLoad?.(e);
    },
    [onLoad]
  );

  if (hideImages) {
    return (
      <div
        role="presentation"
        aria-hidden
        className={cn(className, 'bg-muted/30')}
      />
    );
  }

  return (
    <img
      {...rest}
      src={displayed.src}
      decoding="async"
      loading={resolvedLoading}
      fetchPriority={fetchPriority}
      className={className}
      onLoad={handleLoad}
    />
  );
});

export default CanvasNodeImage;
