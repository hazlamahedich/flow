import { describe, it, expect } from 'vitest';
import { sanitizeEmail } from '../sanitizer';

describe('sanitizer', () => {
  describe('HTML to Text conversion', () => {
    it('strips HTML tags and preserves structural text', () => {
      const html = '<h1>Hello</h1><p>This is a <b>test</b>.</p>';
      const { text } = sanitizeEmail(html);
      expect(text).toContain('Hello');
      expect(text).toContain('This is a test');
      expect(text).not.toContain('<h1>');
    });

    it('removes tracking pixels and external images', () => {
      const html = '<p>Content</p><img src="https://tracker.com/pixel.gif" width="1" height="1"><img src="https://example.com/image.jpg">';
      const { text, safeHtml } = sanitizeEmail(html);
      expect(text).toBe('Content');
      expect(safeHtml).not.toContain('tracker.com');
      expect(safeHtml).not.toContain('example.com');
    });
  });

  describe('Signature and Disclaimer stripping', () => {
    it('strips common signatures', () => {
      const text = 'Hello team,\n\nHow are we doing?\n\nBest regards,\nJohn Doe\nCEO at Flow';
      const { cleanText } = sanitizeEmail('', text);
      expect(cleanText).not.toContain('Best regards');
      expect(cleanText).not.toContain('John Doe');
      expect(cleanText).toContain('How are we doing?');
    });

    it('strips legal disclaimers', () => {
      const text = 'Project update attached.\n\nThis email and any files transmitted with it are confidential...';
      const { cleanText } = sanitizeEmail('', text);
      expect(cleanText).toContain('Project update attached');
      expect(cleanText).not.toContain('confidential');
    });
  });

  describe('Quoted reply stripping', () => {
    it('strips lines starting with >', () => {
      const text = 'I agree.\n\n> On Mon, Jan 1, 2024, John wrote:\n> Hello!';
      const { cleanText } = sanitizeEmail('', text);
      expect(cleanText).toBe('I agree.');
    });

    it('strips content after --- Original Message ---', () => {
      const text = 'Sounds good.\n\n--- Original Message ---\nFrom: John\nSent: Monday';
      const { cleanText } = sanitizeEmail('', text);
      expect(cleanText).toBe('Sounds good.');
    });
  });
});
