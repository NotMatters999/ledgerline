import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './markdown';

describe('Markdown Parser', () => {
    it('escapes math formulas correctly without swallowing characters', () => {
        const input = "If LTV / CAC < 3, then it's bad. If Growth > 10%, it's good.";
        const output = parseMarkdown(input);
        
        // Ensure the `<` and `>` were correctly escaped to `&lt;` and `&gt;`
        expect(output).toContain("LTV / CAC &lt; 3");
        expect(output).toContain("Growth &gt; 10%");
        
        // Ensure no stray HTML tags were formed
        expect(output).not.toContain("< 3");
        expect(output).not.toContain("> 10%");
    });

    it('parses headings and bold text', () => {
        const input = "## Unit Economics\nThe **LTV** is key.";
        const output = parseMarkdown(input);
        
        expect(output).toContain("<h2");
        expect(output).toContain("Unit Economics</h2>");
        expect(output).toContain("<strong>LTV</strong>");
    });

    it('parses bullet lists', () => {
        const input = "- First item\n- Second item";
        const output = parseMarkdown(input);
        
        expect(output).toContain("<ul");
        expect(output).toContain("<li");
        expect(output).toContain("First item</li>");
        expect(output).toContain("Second item</li>");
        expect(output).toContain("</ul>");
    });
});
