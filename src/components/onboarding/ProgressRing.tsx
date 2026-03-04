/**
 * ProgressRing — SVG circular progress indicator.
 *
 * Used in Act 5 (CompanionRevealAndClose) and potentially elsewhere.
 *
 * Features:
 *  - Configurable progress 0–1, size, stroke width, colors
 *  - Animated fill via CSS transition on stroke-dashoffset
 *  - Optional center label (percentage or custom)
 *  - Accessible: role="progressbar" with aria attributes
 *  - GPU-accelerated: uses only transform + opacity
 */

import React, { useEffect, useState } from 'react';

interface ProgressRingProps {
    /** Progress value 0–1 (e.g. 0.8 = 80%) */
    progress: number;
    /** Diameter of the SVG in px (default: 128) */
    size?: number;
    /** Stroke width in px (default: 8) */
    strokeWidth?: number;
    /** Color of the progress arc (default: '#7c3aed' — violet-600) */
    color?: string;
    /** Color of the background track (default: 'rgba(255,255,255,0.07)') */
    trackColor?: string;
    /** Transition duration in ms (default: 1200) */
    animationDuration?: number;
    /** Delay in ms before the arc starts filling (default: 0) */
    animationDelay?: number;
    /** Show percentage label in the center (default: true) */
    showLabel?: boolean;
    /** Custom center label — overrides auto-generated percentage */
    label?: string;
    /** Label color (default: 'white') */
    labelColor?: string;
    /** Label font size in px (default: auto-calculated from size) */
    labelFontSize?: number;
    /** Additional className on the wrapper */
    className?: string;
}

export default function ProgressRing({
    progress,
    size = 128,
    strokeWidth = 8,
    color = '#7c3aed',
    trackColor = 'rgba(255,255,255,0.07)',
    animationDuration = 1200,
    animationDelay = 0,
    showLabel = true,
    label,
    labelColor = 'white',
    labelFontSize,
    className = '',
}: ProgressRingProps) {
    // Clamp progress to 0–1
    const clampedProgress = Math.max(0, Math.min(1, progress));

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    // Start fully hidden (offset = circumference), animate to target
    const [offset, setOffset] = useState(circumference);

    useEffect(() => {
        const targetOffset = circumference * (1 - clampedProgress);
        const timer = setTimeout(() => {
            setOffset(targetOffset);
        }, animationDelay);
        return () => clearTimeout(timer);
    }, [clampedProgress, circumference, animationDelay]);

    const displayLabel = label ?? `${Math.round(clampedProgress * 100)}%`;
    const autoFontSize = labelFontSize ?? Math.round(size * 0.16);

    return (
        <div className={`inline-flex items-center justify-center ${className}`}>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                role="progressbar"
                aria-valuenow={Math.round(clampedProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${Math.round(clampedProgress * 100)}% complete`}
                style={{ transform: 'rotate(-90deg)' }}
            >
                {/* Background track */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                />

                {/* Progress arc */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: `stroke-dashoffset ${animationDuration}ms ease-in-out`,
                    }}
                />

                {/* Center label — counter-rotated so text reads upright */}
                {showLabel && (
                    <text
                        x={center}
                        y={center}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(90, ${center}, ${center})`}
                        fill={labelColor}
                        fontSize={autoFontSize}
                        fontWeight="300"
                        fontFamily="inherit"
                    >
                        {displayLabel}
                    </text>
                )}
            </svg>
        </div>
    );
}
