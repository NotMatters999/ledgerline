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
    html = html.replace(/`(.*?)`/g, '<code class="bg-gray-800 text-emerald-400 px-1 py-0.5 rounded text-sm font-mono">$1</code>');

    // 4. Links (e.g., [text](url))
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

    // 5. Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-white mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-white mt-8 mb-4 border-b border-white/10 pb-2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold text-white mt-4 mb-6">$1</h1>');

    // 6. Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-emerald-500 pl-4 py-1 my-4 text-gray-400 italic bg-white/5 rounded-r">$1</blockquote>');

    // 7. Unordered Lists (simple bullet detection)
    // Note: this handles flat lists. For nested lists, a more complex AST is needed, 
    // but for simple docs this suffices.
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-6 list-disc text-gray-300 my-1">$1</li>');
    
    // Wrap consecutive <li> elements in <ul> (crude but effective for static docs)
    html = html.replace(/(<li.*?>.*?<\/li>\n?)+/g, '<ul class="my-4">$&</ul>');

    // 8. Paragraphs (lines that don't start with a tag)
    // First, split by double newline to identify blocks
    const blocks = html.split(/\n\n+/);
    html = blocks.map(block => {
        // If the block already starts with an HTML tag we injected (h1, h2, ul, blockquote), leave it alone
        if (block.trim().match(/^<(h|ul|li|blockquote)/)) {
            return block;
        }
        // Otherwise, wrap in a paragraph
        return `<p class="text-gray-300 leading-relaxed mb-4">${block.trim().replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');

    return html;
}
