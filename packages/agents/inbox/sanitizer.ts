import DOMPurify from 'isomorphic-dompurify';
import { NodeHtmlMarkdown } from 'node-html-markdown';

export interface SanitizeResult {
  text: string;
  cleanText: string;
  safeHtml: string;
}

const SIGNATURE_PATTERNS = [
  /Best regards,?/i,
  /Kind regards,?/i,
  /Sincerely,?/i,
  /Thanks,?/i,
  /Thank you,?/i,
  /Cheers,?/i,
  /Sent from my iPhone/i,
  /Sent from my Android/i,
  /--\s*$/m,
];

const DISCLAIMER_PATTERNS = [
  /This email and any files transmitted with it are confidential/i,
  /The information contained in this communication is intended only/i,
  /Please consider the environment before printing/i,
];

export function sanitizeEmail(html: string, rawText?: string): SanitizeResult {
  const safeHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    KEEP_CONTENT: true,
  });

  const textOnly = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  }).trim();

  let cleanText = rawText || NodeHtmlMarkdown.translate(safeHtml);

  cleanText = stripQuotedReplies(cleanText);
  cleanText = stripSignatures(cleanText);

  return {
    text: textOnly,
    cleanText: cleanText.trim(),
    safeHtml,
  };
}

function stripQuotedReplies(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if ((trimmedLine.startsWith('>') && trimmedLine.length > 1 && trimmedLine[1] === ' ') ||
        trimmedLine.includes('--- Original Message ---') ||
        /^On.*wrote:$/i.test(trimmedLine) ||
        (trimmedLine.startsWith('From:') && result.length > 0 && /^[A-Z]/.test(trimmedLine.slice(5).trim()))) {
      break;
    }

    result.push(line);
  }

  return result.join('\n').trim();
}

function stripSignatures(text: string): string {
  let clean = text;

  for (const pattern of SIGNATURE_PATTERNS) {
    const match = clean.match(pattern);
    if (match && match.index !== undefined) {
      if (match.index > clean.length * 0.4) {
        clean = clean.substring(0, match.index);
      }
    }
  }

  for (const pattern of DISCLAIMER_PATTERNS) {
    const match = clean.match(pattern);
    if (match && match.index !== undefined) {
      clean = clean.substring(0, match.index);
    }
  }

  return clean.trim();
}
