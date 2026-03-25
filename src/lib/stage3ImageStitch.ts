export type Stage3AngleLike = {
  id: string;
  src: string;
  resolution?: string;
  perspectiveId?: string;
  label?: string;
};

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('failed to load image'));
    img.src = url;
  });
  return img;
}

/**
 * Stitch exactly 4 angles into a single 2x2 contact sheet.
 * Returns data URL on success; null when stitching is unavailable/fails.
 */
export async function stitchAnglesTo2x2DataUrl(angles: Stage3AngleLike[]): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  if (angles.length !== 4) return null;
  try {
    const imgs = await Promise.all(angles.map((a) => loadImageElement(a.src)));
    const cellW = Math.max(...imgs.map((i) => i.naturalWidth || i.width || 1));
    const cellH = Math.max(...imgs.map((i) => i.naturalHeight || i.height || 1));
    const canvas = document.createElement('canvas');
    canvas.width = cellW * 2;
    canvas.height = cellH * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    imgs.forEach((img, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = col * cellW;
      const y = row * cellH;
      const scale = Math.min(cellW / (img.naturalWidth || 1), cellH / (img.naturalHeight || 1));
      const drawW = Math.round((img.naturalWidth || 1) * scale);
      const drawH = Math.round((img.naturalHeight || 1) * scale);
      const dx = x + Math.round((cellW - drawW) / 2);
      const dy = y + Math.round((cellH - drawH) / 2);
      ctx.drawImage(img, dx, dy, drawW, drawH);
    });

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
