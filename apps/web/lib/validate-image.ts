const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP_WEBP = [0x57, 0x45, 0x42, 0x50];

type MagicBytesResult =
  | { valid: true; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
  | { valid: false };

function bytesMatch(buffer: Uint8Array, offset: number, magic: number[]): boolean {
  for (let i = 0; i < magic.length; i++) {
    if (buffer[offset + i] !== magic[i]) return false;
  }
  return true;
}

export function validateImageMagicBytes(buffer: ArrayBuffer): MagicBytesResult {
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 12) {
    return { valid: false };
  }

  if (bytesMatch(bytes, 0, JPEG_MAGIC)) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  if (bytesMatch(bytes, 0, PNG_MAGIC)) {
    return { valid: true, mimeType: 'image/png' };
  }

  if (bytesMatch(bytes, 0, WEBP_RIFF) && bytesMatch(bytes, 8, WEBP_WEBP)) {
    return { valid: true, mimeType: 'image/webp' };
  }

  return { valid: false };
}
