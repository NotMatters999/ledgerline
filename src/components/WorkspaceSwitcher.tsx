import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspace';
import { InlineConfirm } from './InlineConfirm';

interface Props {
    /** Called after any switch/create/delete so App can refetch data */
    onActiveIdChange: (newId: string) => void;
}

export const WorkspaceSwitcher: React.FC<Props> = ({ onActiveIdChange }) => {
    const { workspaces, activeId, create, rename, remove, switchTo } = useWorkspaceStore();
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [hoveredNew, setHoveredNew] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const activeWorkspace = workspaces.find(w => w.id === activeId);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setCreating(false);
                setRenamingId(null);
                setDeletingId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const closeAndReset = () => {
        setOpen(false);
        setCreating(false);
        setNewName('');
        setRenamingId(null);
        setDeletingId(null);
    };

    const handleSwitch = async (id: string) => {
        if (id === activeId) { closeAndReset(); return; }
        setBusy(true);
        try {
            await switchTo(id);
            onActiveIdChange(id);
            closeAndReset();
        } finally {
            setBusy(false);
        }
    };

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) return;
        setBusy(true);
        try {
            await create(name);
            // create() auto-switches activeId in the store
            const { activeId: newId } = useWorkspaceStore.getState();
            onActiveIdChange(newId);
            setNewName('');
            setCreating(false);
            setOpen(false);
        } finally {
            setBusy(false);
        }
    };

    const handleRename = async (id: string) => {
        const name = renameValue.trim();
        if (!name) return;
        setBusy(true);
        try {
            await rename(id, name);
            setRenamingId(null);
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (id: string) => {
        setBusy(true);
        try {
            await remove(id);
            // remove() updates activeId in store if needed
            const { activeId: newId } = useWorkspaceStore.getState();
            onActiveIdChange(newId);
            setDeletingId(null);
            setOpen(false);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
            {/* Trigger button */}
            <button
                id="workspace-switcher-btn"
                onClick={() => setOpen(o => !o)}
                disabled={busy}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.375rem 0.625rem',
                    borderRadius: '0.5rem',
                    background: open ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid',
                    borderColor: open ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)',
                    color: 'var(--text-primary)',
                    cursor: busy ? 'wait' : 'pointer',
                    transition: 'all var(--transition-fast)',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    maxWidth: '150px',
                    fontFamily: 'var(--font-sans)',
                }}
            >
                {/* Folder icon */}
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 7a2 2 0 012-2h4.586a1 1 0 01.707.293L11.414 6.5H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {activeWorkspace?.name ?? '…'}
                </span>
                {/* Chevron */}
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    style={{ flexShrink: 0, transition: 'transform var(--transition-fast)', transform: open ? 'rotate(180deg)' : 'none' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    id="workspace-dropdown"
                    style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                        minWidth: '230px', zIndex: 9999,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-highlight)',
                        borderRadius: '0.75rem',
                        boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(16,185,129,0.05)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        padding: '0.5rem',
                    }}
                >
                    <p style={{
                        fontSize: '0.65rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                        padding: '0.25rem 0.5rem 0.5rem',
                    }}>
                        Workspaces
                    </p>

                    {/* Workspace list */}
                    {workspaces.map(ws => (
                        <div key={ws.id}>
                            {renamingId === ws.id ? (
                                /* Inline rename input */
                                <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem' }}>
                                    <input
                                        id={`rename-input-${ws.id}`}
                                        autoFocus
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleRename(ws.id);
                                            if (e.key === 'Escape') setRenamingId(null);
                                        }}
                                        className="input-field"
                                        style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8rem', height: '28px' }}
                                    />
                                    <button onClick={() => handleRename(ws.id)}
                                        style={btnStyle('var(--accent-primary)')}>✓</button>
                                    <button onClick={() => setRenamingId(null)}
                                        style={btnStyle('rgba(255,255,255,0.1)', 'var(--text-muted)')}>✕</button>
                                </div>
                            ) : deletingId === ws.id ? (
                                /* Delete confirmation */
                                <InlineConfirm
                                    variant="stacked"
                                    message={`Delete "${ws.name}"? This cannot be undone.`}
                                    confirmText="Delete"
                                    cancelText="Cancel"
                                    onConfirm={() => handleDelete(ws.id)}
                                    onCancel={() => setDeletingId(null)}
                                />
                            ) : (
                                /* Normal workspace row */
                                <div
                                    id={`workspace-row-${ws.id}`}
                                    onClick={() => handleSwitch(ws.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                                        borderRadius: '0.5rem', padding: '0.375rem 0.5rem',
                                        marginBottom: '2px',
                                        background: ws.id === activeId ? 'rgba(16,185,129,0.1)' : (hoveredId === ws.id ? 'rgba(255,255,255,0.04)' : 'transparent'),
                                        cursor: 'pointer',
                                        transition: 'background var(--transition-fast)',
                                    }}
                                    onMouseEnter={() => setHoveredId(ws.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    {/* Checkmark for active */}
                                    <span style={{ width: '14px', flexShrink: 0, fontSize: '0.7rem', color: 'var(--accent-primary)' }}>
                                        {ws.id === activeId ? '✓' : ''}
                                    </span>
                                    <span style={{
                                        flex: 1, fontSize: '0.875rem',
                                        color: ws.id === activeId ? 'var(--accent-primary)' : 'var(--text-primary)',
                                        fontWeight: ws.id === activeId ? 500 : 400,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {ws.name}
                                    </span>
                                    {/* Action icons */}
                                    <button
                                        id={`rename-btn-${ws.id}`}
                                        onClick={e => { e.stopPropagation(); setRenamingId(ws.id); setRenameValue(ws.name); }}
                                        title="Rename"
                                        style={iconBtnStyle()}
                                    >
                                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    {workspaces.length > 1 && (
                                        <button
                                            id={`delete-btn-${ws.id}`}
                                            onClick={e => { e.stopPropagation(); setDeletingId(ws.id); }}
                                            title="Delete"
                                            style={iconBtnStyle('var(--status-danger)')}
                                        >
                                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round"
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Divider + New Workspace */}
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.375rem', paddingTop: '0.375rem' }}>
                        {creating ? (
                            <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem' }}>
                                <input
                                    id="new-workspace-input"
                                    autoFocus
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreate();
                                        if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                                    }}
                                    placeholder="Workspace name…"
                                    className="input-field"
                                    style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8rem', height: '28px' }}
                                />
                                <button onClick={handleCreate}
                                    style={btnStyle('var(--accent-primary)')}>✓</button>
                                <button onClick={() => { setCreating(false); setNewName(''); }}
                                    style={btnStyle('rgba(255,255,255,0.1)', 'var(--text-muted)')}>✕</button>
                            </div>
                        ) : (
                            <button
                                id="new-workspace-btn"
                                onClick={() => setCreating(true)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.375rem 0.5rem', border: 'none',
                                    color: hoveredNew ? 'var(--text-primary)' : 'var(--text-muted)',
                                    background: hoveredNew ? 'rgba(255,255,255,0.04)' : 'transparent',
                                    cursor: 'pointer', borderRadius: '0.5rem',
                                    fontSize: '0.8rem', fontFamily: 'var(--font-sans)',
                                    transition: 'all var(--transition-fast)',
                                }}
                                onMouseEnter={() => setHoveredNew(true)}
                                onMouseLeave={() => setHoveredNew(false)}
                            >
                                <span style={{ fontSize: '1rem', color: 'var(--accent-primary)', lineHeight: 1 }}>+</span>
                                New Workspace
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Style helpers ────────────────────────────────────────────────────────────

function btnStyle(bg: string, color = '#fff'): React.CSSProperties {
    return {
        fontSize: '0.75rem', padding: '0 0.4rem', height: '26px',
        borderRadius: '0.375rem', background: bg, color,
        border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
}

function iconBtnStyle(color = 'var(--text-muted)'): React.CSSProperties {
    return {
        background: 'transparent', border: 'none', cursor: 'pointer',
        color, padding: '0.25rem', borderRadius: '0.25rem', display: 'flex',
        alignItems: 'center', justifyContent: 'center', opacity: 0.5,
        transition: 'opacity var(--transition-fast)',
        flexShrink: 0,
    };
}
