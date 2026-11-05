export interface PreparedImage {
  blob: Blob;
  /** Object URL for previews; revoke with `URL.revokeObjectURL` when done. */
  url: string;
}

const MAX_SIDE = 1280;

/** Downscales a camera photo to a ~150–300 KB JPEG before it's uploaded. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo'))), 'image/jpeg', 0.82),
  );
  return { blob, url: URL.createObjectURL(blob) };
}
