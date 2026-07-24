import React, { useState } from 'react';

interface TooltipProps {
    text: string;
    children?: React.ReactNode;
}

/**
 * Inline tooltip with hover-activated bubble.
 * Usage: <Tooltip text="Gross Revenue Retention: revenue kept ignoring upsells" />
 * Or wrap a label: <Tooltip text="..."><span>GRR</span></Tooltip>
 */
export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
    const [visible, setVisible] = useState(false);

    return (
        <span
            className="tooltip-wrapper"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children ?? <span className="tooltip-icon">?</span>}
            {visible && (
                <span className="tooltip-bubble" role="tooltip">
                    {text}
                </span>
            )}
        </span>
    );
};
