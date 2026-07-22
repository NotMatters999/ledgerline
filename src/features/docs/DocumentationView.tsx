import React, { useState, useMemo } from 'react';
import { documentationSections } from './content';
import { parseMarkdown } from '../../utils/markdown';

export const DocumentationView: React.FC = () => {
    const [activeSectionId, setActiveSectionId] = useState(documentationSections[0].id);

    const activeSection = useMemo(() => {
        return documentationSections.find(s => s.id === activeSectionId) || documentationSections[0];
    }, [activeSectionId]);

    const renderedHtml = useMemo(() => {
        return parseMarkdown(activeSection.content);
    }, [activeSection.content]);

    return (
        <div style={{ display: 'flex', gap: '2rem', height: '100%', minHeight: '600px' }}>
            {/* Sidebar Navigation */}
            <aside style={{ width: '16rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRight: '1px solid var(--border-color)', paddingRight: '1.5rem' }}>
                <h3 className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Contents</h3>
                {documentationSections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSectionId(section.id)}
                        style={{
                            textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', transition: 'colors var(--transition-fast)',
                            background: activeSectionId === section.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            color: activeSectionId === section.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                            fontWeight: activeSectionId === section.id ? 500 : 400,
                            border: 'none', cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => { if (activeSectionId !== section.id) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; } }}
                        onMouseLeave={(e) => { if (activeSectionId !== section.id) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
                    >
                        {section.title}
                    </button>
                ))}
            </aside>

            {/* Main Content Pane */}
            <main className="glass-panel" style={{ flex: 1, padding: '2.5rem', overflowY: 'auto' }}>
                <div 
                    style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}
                    // Security Note: dangerouslySetInnerHTML is used here ONLY because 
                    // the documentation content is static, dev-authored, and safely hardcoded in content.ts.
                    // It is NEVER user-supplied. If this changes, a sanitizer MUST be added.
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
            </main>
        </div>
    );
};
