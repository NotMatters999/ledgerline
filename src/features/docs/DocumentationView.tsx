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
        <div className="w-full flex gap-8 h-full min-h-[600px]">
            {/* Sidebar Navigation */}
            <aside className="w-64 shrink-0 flex flex-col gap-2 border-r border-white/10 pr-6">
                <h3 className="text-gray-400 font-medium text-sm tracking-wider uppercase mb-2">Contents</h3>
                {documentationSections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSectionId(section.id)}
                        className={`text-left px-3 py-2 rounded-md transition-colors ${
                            activeSectionId === section.id 
                            ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        }`}
                    >
                        {section.title}
                    </button>
                ))}
            </aside>

            {/* Main Content Pane */}
            <main className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-10 shadow-xl overflow-y-auto">
                <div 
                    className="prose prose-invert max-w-none"
                    // Security Note: dangerouslySetInnerHTML is used here ONLY because 
                    // the documentation content is static, dev-authored, and safely hardcoded in content.ts.
                    // It is NEVER user-supplied. If this changes, a sanitizer MUST be added.
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
            </main>
        </div>
    );
};
