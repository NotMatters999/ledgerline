/**
 * A lightweight, zero-dependency Markdown parser.
 * Designed strictly for static, dev-authored documentation.
 * 
 * IMPORTANT: This outputs raw HTML strings meant for dangerouslySetInnerHTML.
 * It is SAFE ONLY because the input is strictly hardcoded in the repository.
 * If this ever processes user-input, an HTML sanitizer (like DOMPurify) MUST be added.
 */
export function parseMarkdown(text: string): string {
    // 1. First, aggressively escape existing HTML characters to protect math formulas
    // e.g. LTV / CAC < 3 shouldn't be swallowed as a tag.
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Bold (e.g., **text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 3. Inline code (e.g., `text`)
    html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.1); color: var(--accent-primary); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875rem; font-family: monospace;">$1</code>');

    // 4. Links (e.g., [text](url))
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: var(--accent-secondary); text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>');

    // 5. Headings
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-top: 1.5rem; margin-bottom: 0.75rem;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-top: 2rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="page-title" style="margin-top: 1rem; margin-bottom: 1.5rem;">$1</h1>');

    // 6. Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote style="border-left: 4px solid var(--accent-primary); padding-left: 1rem; padding-top: 0.25rem; padding-bottom: 0.25rem; margin-top: 1rem; margin-bottom: 1rem; color: var(--text-muted); font-style: italic; background: rgba(255,255,255,0.05); border-radius: 0 0.25rem 0.25rem 0;">$1</blockquote>');

    // 7. Unordered Lists (simple bullet detection)
    // Note: this handles flat lists. For nested lists, a more complex AST is needed, 
    // but for simple docs this suffices.
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left: 1.5rem; list-style-type: disc; color: var(--text-secondary); margin-top: 0.25rem; margin-bottom: 0.25rem;">$1</li>');
    
    // Wrap consecutive <li> elements in <ul> (crude but effective for static docs)
    html = html.replace(/(<li.*?>.*?<\/li>\n?)+/g, '<ul style="margin-top: 1rem; margin-bottom: 1rem;">$&</ul>');

    // 8. Paragraphs (lines that don't start with a tag)
    // First, split by double newline to identify blocks
    const blocks = html.split(/\n\n+/);
    html = blocks.map(block => {
        // If the block already starts with an HTML tag we injected (h1, h2, ul, blockquote), leave it alone
        if (block.trim().match(/^<(h|ul|li|blockquote)/)) {
            return block;
        }
        // Otherwise, wrap in a paragraph
        return `<p style="color: var(--text-secondary); line-height: 1.625; margin-bottom: 1rem;">${block.trim().replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');

    return html;
}
