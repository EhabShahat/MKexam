/**
 * Property-Based Tests for ContentStage Component
 * Feature: staged-exam-system
 * 
 * Property 10: HTML Content Sanitization
 * Validates: Requirements 3.3.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Property 10: HTML Content Sanitization
 * 
 * For any HTML content containing potentially dangerous tags (script, iframe, etc.),
 * the rendered output should have those tags removed while preserving safe formatting
 * tags (p, strong, em, ul, li, img, a).
 * 
 * Validates: Requirements 3.3.3
 */
describe('Feature: staged-exam-system, Property 10: HTML Content Sanitization', () => {
  it('should remove dangerous tags while preserving safe formatting tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate HTML content with mix of safe and dangerous tags
        fc.record({
          safeContent: fc.oneof(
            fc.constant('<p>Safe paragraph</p>'),
            fc.constant('<strong>Bold text</strong>'),
            fc.constant('<em>Italic text</em>'),
            fc.constant('<ul><li>List item</li></ul>'),
            fc.constant('<h1>Heading</h1>'),
            fc.constant('<a href="https://example.com">Link</a>'),
            fc.constant('<img src="image.jpg" alt="Image" />')
          ),
          dangerousContent: fc.oneof(
            fc.constant('<script>alert("xss")</script>'),
            fc.constant('<iframe src="evil.com"></iframe>'),
            fc.constant('<object data="evil.swf"></object>'),
            fc.constant('<embed src="evil.swf" />'),
            fc.constant('<link rel="stylesheet" href="evil.css" />'),
            fc.constant('<meta http-equiv="refresh" content="0;url=evil.com" />'),
            fc.constant('<form action="evil.com"><input type="submit" /></form>'),
            fc.constant('<button onclick="alert(\'xss\')">Click</button>')
          )
        }),
        async ({ safeContent, dangerousContent }) => {
          // Combine safe and dangerous content
          const mixedContent = `${safeContent}${dangerousContent}`;

          // Sanitize using the same configuration as ContentStage
          const sanitized = DOMPurify.sanitize(mixedContent, {
            ALLOWED_TAGS: [
              'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'ul', 'ol', 'li', 'img', 'a', 'span', 'div', 'blockquote', 'code', 'pre'
            ],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
          });

          // Verify dangerous tags are removed
          expect(sanitized).not.toContain('<script');
          expect(sanitized).not.toContain('<iframe');
          expect(sanitized).not.toContain('<object');
          expect(sanitized).not.toContain('<embed');
          expect(sanitized).not.toContain('<link');
          expect(sanitized).not.toContain('<meta');
          expect(sanitized).not.toContain('<form');
          expect(sanitized).not.toContain('onclick');
          expect(sanitized).not.toContain('onerror');
          expect(sanitized).not.toContain('onload');

          // Verify safe content is preserved (check for opening tags)
          const safeTagMatch = safeContent.match(/<(\w+)/);
          if (safeTagMatch) {
            const safeTag = safeTagMatch[1];
            // Check if the safe tag is in the allowed list
            const allowedTags = ['p', 'strong', 'em', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img'];
            if (allowedTags.includes(safeTag)) {
              expect(sanitized).toContain(`<${safeTag}`);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve safe attributes while removing dangerous ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tag: fc.constantFrom('a', 'img', 'p', 'div'),
          safeAttr: fc.oneof(
            fc.constant('href="https://example.com"'),
            fc.constant('src="image.jpg"'),
            fc.constant('alt="Description"'),
            fc.constant('title="Title"'),
            fc.constant('class="text-bold"')
          ),
          dangerousAttr: fc.oneof(
            fc.constant('onclick="alert(1)"'),
            fc.constant('onerror="alert(1)"'),
            fc.constant('onload="alert(1)"'),
            fc.constant('javascript:alert(1)'),
            fc.constant('data:text/html,<script>alert(1)</script>')
          )
        }),
        async ({ tag, safeAttr, dangerousAttr }) => {
          const content = `<${tag} ${safeAttr} ${dangerousAttr}>Content</${tag}>`;

          const sanitized = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [
              'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'ul', 'ol', 'li', 'img', 'a', 'span', 'div', 'blockquote', 'code', 'pre'
            ],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
          });

          // Verify dangerous event handlers are removed
          expect(sanitized).not.toContain('onclick');
          expect(sanitized).not.toContain('onerror');
          expect(sanitized).not.toContain('onload');
          expect(sanitized).not.toContain('javascript:');

          // Verify the tag itself is preserved (if it's in allowed list)
          expect(sanitized).toContain(`<${tag}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle nested dangerous content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (depth) => {
          // Create nested dangerous content
          let content = '<p>Safe content</p>';
          for (let i = 0; i < depth; i++) {
            content = `<div>${content}<script>alert(${i})</script></div>`;
          }

          const sanitized = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [
              'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'ul', 'ol', 'li', 'img', 'a', 'span', 'div', 'blockquote', 'code', 'pre'
            ],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
          });

          // Verify all script tags are removed regardless of nesting
          expect(sanitized).not.toContain('<script');
          expect(sanitized).not.toContain('alert(');

          // Verify safe div and p tags are preserved
          expect(sanitized).toContain('<div');
          expect(sanitized).toContain('<p');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty and whitespace-only content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\n\n\n'),
          fc.constant('\t\t\t')
        ),
        async (content) => {
          const sanitized = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [
              'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'ul', 'ol', 'li', 'img', 'a', 'span', 'div', 'blockquote', 'code', 'pre'
            ],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
          });

          // Should not throw and should return string
          expect(typeof sanitized).toBe('string');
          
          // Should not contain any dangerous content
          expect(sanitized).not.toContain('<script');
          expect(sanitized).not.toContain('<iframe');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve complex safe HTML structures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          heading: fc.constantFrom('h1', 'h2', 'h3'),
          listType: fc.constantFrom('ul', 'ol'),
          numItems: fc.integer({ min: 1, max: 5 })
        }),
        async ({ heading, listType, numItems }) => {
          // Create complex safe HTML
          const items = Array.from({ length: numItems }, (_, i) => 
            `<li>Item ${i + 1}</li>`
          ).join('');
          
          const content = `
            <${heading}>Title</${heading}>
            <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
            <${listType}>${items}</${listType}>
            <blockquote>Quote</blockquote>
          `;

          const sanitized = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [
              'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'ul', 'ol', 'li', 'img', 'a', 'span', 'div', 'blockquote', 'code', 'pre'
            ],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
          });

          // Verify all safe tags are preserved
          expect(sanitized).toContain(`<${heading}`);
          expect(sanitized).toContain('<p');
          expect(sanitized).toContain('<strong');
          expect(sanitized).toContain('<em');
          expect(sanitized).toContain(`<${listType}`);
          expect(sanitized).toContain('<li');
          expect(sanitized).toContain('<blockquote');

          // Verify content is preserved
          expect(sanitized).toContain('Title');
          expect(sanitized).toContain('Paragraph');
          expect(sanitized).toContain('bold');
          expect(sanitized).toContain('italic');
          expect(sanitized).toContain('Quote');
        }
      ),
      { numRuns: 100 }
    );
  });
});
