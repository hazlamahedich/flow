import { describe, it, expect } from 'vitest';
import { validateImageMagicBytes } from './validate-image';

function makeBuffer(bytes: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    view[i] = bytes[i];
  }
  return buffer;
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe('validateImageMagicBytes', () => {
  it('identifies JPEG files', () => {
    const result = validateImageMagicBytes(makeBuffer(JPEG_HEADER));
    expect(result).toEqual({ valid: true, mimeType: 'image/jpeg' });
  });

  it('identifies PNG files', () => {
    const result = validateImageMagicBytes(makeBuffer(PNG_HEADER));
    expect(result).toEqual({ valid: true, mimeType: 'image/png' });
  });

  it('identifies WebP files', () => {
    const result = validateImageMagicBytes(makeBuffer(WEBP_HEADER));
    expect(result).toEqual({ valid: true, mimeType: 'image/webp' });
  });

  it('rejects SVG disguised as JPG (wrong magic bytes)', () => {
    const svgBuffer = makeBuffer([0x3c, 0x73, 0x76, 0x67, 0x20, 0x78, 0x6d, 0x6c, 0x6e, 0x73, 0x3d, 0x22]);
    const result = validateImageMagicBytes(svgBuffer);
    expect(result).toEqual({ valid: false });
  });

  it('rejects empty file', () => {
    const result = validateImageMagicBytes(new ArrayBuffer(0));
    expect(result).toEqual({ valid: false });
  });

  it('rejects truncated header (< 12 bytes)', () => {
    const result = validateImageMagicBytes(makeBuffer([0xff, 0xd8, 0xff]));
    expect(result).toEqual({ valid: false });
  });
});
