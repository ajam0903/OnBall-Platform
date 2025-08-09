import React from 'react';

export const WinsBadgeIcon = ({ tier = "bronze", size = 24 }) => {
    // Color schemes for different tiers
    const tierColors = {
        bronze: {
            primary: "#CD7F32",
            secondary: "#A0522D",
            accent: "#DEB887",
            ribbon: "#8B4513"
        },
        silver: {
            primary: "#C0C0C0",
            secondary: "#A8A8A8",
            accent: "#E5E5E5",
            ribbon: "#708090"
        },
        gold: {
            primary: "#FFD700",
            secondary: "#DAA520",
            accent: "#FFF8DC",
            ribbon: "#B8860B"
        },
        amethyst: {
            primary: "#9966CC",
            secondary: "#7B68EE",
            accent: "#DDA0DD",
            ribbon: "#663399"
        }
    };

    const colors = tierColors[tier] || tierColors.bronze;

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Ribbon */}
            <path
                d="M14 28 L18 42 L24 38 L30 42 L34 28"
                fill={colors.ribbon}
                stroke={colors.secondary}
                strokeWidth="1"
            />

            {/* Medal Circle - Outer Ring */}
            <circle
                cx="24"
                cy="20"
                r="14"
                fill={colors.secondary}
                stroke={colors.primary}
                strokeWidth="2"
            />

            {/* Medal Circle - Inner */}
            <circle
                cx="24"
                cy="20"
                r="11"
                fill={colors.primary}
            />

            {/* Inner Circle - Highlight */}
            <circle
                cx="24"
                cy="20"
                r="8"
                fill={colors.accent}
                opacity="0.7"
            />

            {/* Trophy Icon in Center */}
            <g transform="translate(24, 20)">
                {/* Trophy Cup */}
                <path
                    d="M-4 -6 L4 -6 L3 2 L-3 2 Z"
                    fill={colors.secondary}
                />
                {/* Trophy Handles */}
                <path
                    d="M-6 -4 Q-7 -4 -7 -2 Q-7 0 -6 0 L-4 0"
                    fill="none"
                    stroke={colors.secondary}
                    strokeWidth="1"
                />
                <path
                    d="M6 -4 Q7 -4 7 -2 Q7 0 6 0 L4 0"
                    fill="none"
                    stroke={colors.secondary}
                    strokeWidth="1"
                />
                {/* Trophy Base */}
                <rect
                    x="-3"
                    y="2"
                    width="6"
                    height="2"
                    fill={colors.secondary}
                />
                <rect
                    x="-4"
                    y="4"
                    width="8"
                    height="1"
                    fill={colors.secondary}
                />
            </g>

            {/* Shine Effect */}
            <ellipse
                cx="20"
                cy="16"
                rx="3"
                ry="6"
                fill="white"
                opacity="0.3"
            />
        </svg>
    );
};

export const VetBadgeIcon = ({ tier = "bronze", size = 24 }) => {
    // Color schemes for different tiers
    const tierColors = {
        bronze: {
            primary: "#CD7F32",
            secondary: "#A0522D",
            accent: "#DEB887"
        },
        silver: {
            primary: "#C0C0C0",
            secondary: "#A8A8A8",
            accent: "#E5E5E5"
        },
        gold: {
            primary: "#FFD700",
            secondary: "#DAA520",
            accent: "#FFF8DC"
        },
        amethyst: {
            primary: "#9966CC",
            secondary: "#7B68EE",
            accent: "#DDA0DD"
        }
    };

    const colors = tierColors[tier] || tierColors.bronze;

    // Number of chevrons based on tier
    const chevronCount = {
        bronze: 1,
        silver: 2,
        gold: 3,
        amethyst: 4
    };

    const numChevrons = chevronCount[tier] || 1;

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Shield/Pentagon Background */}
            <path
                d="M24 4 L38 12 L38 28 L24 44 L10 28 L10 12 Z"
                fill={colors.primary}
                stroke={colors.secondary}
                strokeWidth="2"
            />

            {/* Inner shield highlight */}
            <path
                d="M24 8 L34 14 L34 26 L24 38 L14 26 L14 14 Z"
                fill={colors.accent}
                opacity="0.3"
            />

            {/* Chevrons in Center */}
            <g transform="translate(24, 24)">
                {/* Generate chevrons based on tier */}
                {Array.from({ length: numChevrons }, (_, i) => {
                    const yOffset = (i - (numChevrons - 1) / 2) * 4; // Space out chevrons

                    return (
                        <g key={i} transform={`translate(0, ${yOffset})`}>
                            {/* Chevron/Arrow pointing down */}
                            <path
                                d="M-8 -2 L0 6 L8 -2 L6 -4 L0 2 L-6 -4 Z"
                                fill={colors.secondary}
                                stroke={colors.accent}
                                strokeWidth="0.5"
                            />
                        </g>
                    );
                })}

                {/* Optional: Add a small star at the top for amethyst tier */}
                {tier === "amethyst" && (
                    <path
                        d="M0 -12 L2 -8 L6 -8 L3 -5 L4 -1 L0 -3 L-4 -1 L-3 -5 L-6 -8 L-2 -8 Z"
                        fill={colors.accent}
                        opacity="0.9"
                    />
                )}
            </g>

            {/* Shine Effect */}
            <ellipse
                cx="20"
                cy="16"
                rx="4"
                ry="8"
                fill="white"
                opacity="0.2"
            />
        </svg>
    );
};

export const MVPBadgeIcon = ({ tier = "bronze", size = 24 }) => {
    // Color schemes for different tiers
    const tierColors = {
        bronze: {
            primary: "#CD7F32",
            secondary: "#A0522D",
            accent: "#DEB887",
            glow: "#FFE4B5"
        },
        silver: {
            primary: "#C0C0C0",
            secondary: "#A8A8A8",
            accent: "#E5E5E5",
            glow: "#F8F8FF"
        },
        gold: {
            primary: "#FFD700",
            secondary: "#DAA520",
            accent: "#FFF8DC",
            glow: "#FFFFE0"
        },
        amethyst: {
            primary: "#9966CC",
            secondary: "#7B68EE",
            accent: "#DDA0DD",
            glow: "#E6E6FA"
        }
    };

    const colors = tierColors[tier] || tierColors.bronze;

    // Generate 5-pointed star path
    const generateStarPath = (centerX, centerY, outerRadius, innerRadius) => {
        let path = "";
        const points = 5;
        const angleStep = (Math.PI * 2) / points;

        for (let i = 0; i < points * 2; i++) {
            const angle = i * angleStep / 2 - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            if (i === 0) {
                path += `M ${x} ${y}`;
            } else {
                path += ` L ${x} ${y}`;
            }
        }
        path += " Z";
        return path;
    };

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer glow effect */}
            <defs>
                <filter id={`glow-${tier}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <radialGradient id={`starGradient-${tier}`} cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stopColor={colors.accent} />
                    <stop offset="70%" stopColor={colors.primary} />
                    <stop offset="100%" stopColor={colors.secondary} />
                </radialGradient>
            </defs>

            {/* Main 5-pointed star */}
            <path
                d={generateStarPath(24, 24, 18, 9)}
                fill={`url(#starGradient-${tier})`}
                stroke={colors.secondary}
                strokeWidth="1.5"
                filter={`url(#glow-${tier})`}
            />

            {/* Inner star highlight - gets smaller for higher tiers */}
            <path
                d={generateStarPath(24, 24, 12, 6)}
                fill={colors.accent}
                opacity="0.6"
            />

            {/* Center circle - gets more prominent for higher tiers */}
            <circle
                cx="24"
                cy="24"
                r={tier === "bronze" ? "3" : tier === "silver" ? "3.5" : tier === "gold" ? "4" : "4.5"}
                fill={colors.primary}
                stroke={colors.accent}
                strokeWidth="1"
            />

            {/* MVP text in center */}
            <text
                x="24"
                y="26"
                textAnchor="middle"
                fontSize="6"
                fontWeight="bold"
                fill={colors.secondary}
            >
                MVP
            </text>

            {/* Bronze: Simple star */}

            {/* Silver: Add small dots at star points */}
            {tier === "silver" && (
                <g>
                    <circle cx="24" cy="6" r="1" fill={colors.accent} />
                    <circle cx="39" cy="17" r="1" fill={colors.accent} />
                    <circle cx="33" cy="38" r="1" fill={colors.accent} />
                    <circle cx="15" cy="38" r="1" fill={colors.accent} />
                    <circle cx="9" cy="17" r="1" fill={colors.accent} />
                </g>
            )}

            {/* Gold: Add sparkles around the star */}
            {tier === "gold" && (
                <g>
                    {/* Sparkles at star points */}
                    <g transform="translate(24, 6)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} opacity="0.8" />
                    </g>
                    <g transform="translate(39, 17)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} opacity="0.8" />
                    </g>
                    <g transform="translate(33, 38)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} opacity="0.8" />
                    </g>
                    <g transform="translate(15, 38)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} opacity="0.8" />
                    </g>
                    <g transform="translate(9, 17)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} opacity="0.8" />
                    </g>
                </g>
            )}

            {/* Amethyst: Add crown and premium sparkles */}
            {tier === "amethyst" && (
                <g>
                    {/* Crown above the star */}
                    <path
                        d="M18 8 L21 4 L24 6 L27 4 L30 8 L27 10 L21 10 Z"
                        fill={colors.accent}
                        stroke={colors.secondary}
                        strokeWidth="0.5"
                        opacity="0.9"
                    />
                    {/* Premium sparkles */}
                    <g transform="translate(24, 6)">
                        <path d="M0 -3 L1.5 0 L0 3 L-1.5 0 Z" fill={colors.accent} />
                        <path d="M-3 0 L0 -1.5 L3 0 L0 1.5 Z" fill={colors.accent} />
                    </g>
                    <g transform="translate(39, 17)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} />
                    </g>
                    <g transform="translate(33, 38)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} />
                    </g>
                    <g transform="translate(15, 38)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} />
                    </g>
                    <g transform="translate(9, 17)">
                        <path d="M0 -2 L1 0 L0 2 L-1 0 Z" fill={colors.accent} />
                    </g>
                </g>
            )}
        </svg>
    );
};

export const WinStreakBadgeIcon = ({ tier = "bronze", size = 24 }) => {
    // Color schemes for different tiers
    const tierColors = {
        bronze: {
            outer: "#FF4500",
            middle: "#FF6B35",
            inner: "#FFD700",
            center: "#FFFF99"
        },
        silver: {
            outer: "#DC143C",
            middle: "#FF4500",
            inner: "#FFD700",
            center: "#FFFFFF"
        },
        gold: {
            outer: "#B22222",
            middle: "#FF0000",
            inner: "#FFD700",
            center: "#FFFFFF"
        },
        amethyst: {
            outer: "#4B0082",
            middle: "#9932CC",
            inner: "#00BFFF",
            center: "#F0F8FF"
        }
    };

    const colors = tierColors[tier] || tierColors.bronze;

    const streakNumbers = {
        bronze: "5",
        silver: "10",
        gold: "15",
        amethyst: "25"
    };

    const streakNumber = streakNumbers[tier] || "5";

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                {/* Main flame gradient */}
                <radialGradient id={`flameGradient-${tier}`} cx="50%" cy="80%" r="70%">
                    <stop offset="0%" stopColor={colors.center} />
                    <stop offset="30%" stopColor={colors.inner} />
                    <stop offset="70%" stopColor={colors.middle} />
                    <stop offset="100%" stopColor={colors.outer} />
                </radialGradient>
            </defs>

            {/* Main flame body - emoji-like shape */}
            <path
                d="M24 4
                   C26 6, 28 10, 26 14
                   C28 12, 32 14, 34 18
                   C36 22, 34 26, 32 28
                   C34 30, 36 34, 34 38
                   C32 42, 28 44, 24 44
                   C20 44, 16 42, 14 38
                   C12 34, 14 30, 16 28
                   C14 26, 12 22, 14 18
                   C16 14, 20 12, 22 14
                   C20 10, 22 6, 24 4 Z"
                fill={`url(#flameGradient-${tier})`}
            />

            {/* Inner flame highlight */}
            <path
                d="M24 8
                   C25 10, 26 12, 25 14
                   C27 13, 29 15, 30 18
                   C31 21, 30 24, 29 26
                   C30 28, 31 31, 30 34
                   C29 37, 27 39, 24 40
                   C21 39, 19 37, 18 34
                   C17 31, 18 28, 19 26
                   C18 24, 17 21, 18 18
                   C19 15, 21 13, 23 14
                   C22 12, 23 10, 24 8 Z"
                fill={colors.inner}
                opacity="0.7"
            />

            {/* Hot core center */}
            <ellipse
                cx="24"
                cy="30"
                rx="8"
                ry="10"
                fill={colors.center}
                opacity="0.8"
            />

            {/* Number background circle */}
            <circle
                cx="24"
                cy="30"
                r="6"
                fill={colors.center}
                stroke={colors.outer}
                strokeWidth="1"
                opacity="0.9"
            />

            {/* Win streak number */}
            <text
                x="24"
                y="33"
                textAnchor="middle"
                fontSize={streakNumber.length > 1 ? "6" : "8"}
                fontWeight="bold"
                fill={colors.outer}
            >
                {streakNumber}
            </text>

            {/* Flame top flickers */}
            <g opacity="0.6">
                {/* Left flicker */}
                <path
                    d="M20 12
                       C18 10, 16 8, 18 6
                       C20 4, 22 8, 20 12 Z"
                    fill={colors.middle}
                />

                {/* Right flicker */}
                <path
                    d="M28 12
                       C30 8, 32 4, 30 6
                       C28 8, 30 10, 28 12 Z"
                    fill={colors.middle}
                />

                {/* Center tip */}
                <path
                    d="M24 8
                       C22 6, 22 2, 24 4
                       C26 2, 26 6, 24 8 Z"
                    fill={colors.inner}
                />
            </g>

            {/* Sparkles for higher tiers */}
            {tier === "gold" && (
                <g>
                    <circle cx="18" cy="16" r="0.8" fill={colors.center} opacity="0.8" />
                    <circle cx="30" cy="14" r="0.8" fill={colors.center} opacity="0.8" />
                    <circle cx="16" cy="26" r="0.6" fill={colors.inner} opacity="0.7" />
                    <circle cx="32" cy="24" r="0.6" fill={colors.inner} opacity="0.7" />
                </g>
            )}

            {tier === "amethyst" && (
                <g>
                    {/* Mystical sparkles */}
                    <circle cx="18" cy="16" r="1" fill={colors.center} opacity="0.9">
                        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="30" cy="14" r="1" fill={colors.center} opacity="0.9">
                        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="14" cy="28" r="0.8" fill={colors.inner} opacity="0.8">
                        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="34" cy="26" r="0.8" fill={colors.inner} opacity="0.8">
                        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite" />
                    </circle>

                    {/* Top mystical glow */}
                    <circle cx="24" cy="6" r="2" fill={colors.center} opacity="0.5">
                        <animate attributeName="opacity" values="0.5;0.8;0.5" dur="3s" repeatCount="indefinite" />
                    </circle>
                </g>
            )}
        </svg>
    );
};