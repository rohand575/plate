export interface PreparedImage {
  blob: Blob;
  /** Object URL for previews; revoke with `URL.revokeObjectURL` when done. */
  url: string;
}

const MAX_SIDE = 1280;

/** Draws the source into a canvas right away, then encodes a ~150–300 KB JPEG. */
function toJpeg(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): Promise<PreparedImage> {
  const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise<PreparedImage>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, url: URL.createObjectURL(blob) }) : reject(new Error('Could not read that photo'))),
      'image/jpeg',
      0.82,
    ),
  );
}

/** Downscales a chosen photo before it's uploaded. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await toJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** Grabs the current frame of a live camera preview. */
export function captureFrame(video: HTMLVideoElement): Promise<PreparedImage> {
  if (!video.videoWidth || !video.videoHeight) return Promise.reject(new Error('The camera isn’t ready yet'));
  return toJpeg(video, video.videoWidth, video.videoHeight);
}
