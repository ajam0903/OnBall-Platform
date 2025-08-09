import React, { useState, useEffect } from "react";
import { WinsBadgeIcon, VetBadgeIcon, MVPBadgeIcon, WinStreakBadgeIcon } from "./BadgeIcons";

// Icon mapping - updated to match badgeSystem.jsx category IDs
const BADGE_ICONS = {
    gamesPlayed: VetBadgeIcon,
    wins: WinsBadgeIcon,
    mvps: MVPBadgeIcon,
    winStreaks: WinStreakBadgeIcon
};

// Main Badge component (consolidates CustomBadge)
const Badge = React.memo(function Badge({
    badge,
    categoryId, // Pass the category ID instead of categoryIcon
    size = "normal",
    showTooltip = true,
    className = ""
}) {
    const [isClicked, setIsClicked] = useState(false);

    useEffect(() => {
        let timer;
        if (isClicked) {
            timer = setTimeout(() => setIsClicked(false), 2000);
        }
        return () => clearTimeout(timer);
    }, [isClicked]);

    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeoutRef = React.useRef(null);

    const sizeConfig = {
        xs: { container: "w-4 h-4", iconSize: 16 },
        small: { container: "w-7 h-7", iconSize: 20 },
        normal: { container: "w-10 h-10", iconSize: 28 },
        large: { container: "w-14 h-14", iconSize: 40 }
    };

    const config = sizeConfig[size] || sizeConfig.normal;
    const IconComponent = BADGE_ICONS[categoryId];

    return (
        <div className={`relative group ${className}`}>
            <div
                className={`
        ${config.container} 
        rounded-lg bg-gradient-to-br ${badge.bgGradient}
        border-2 ${badge.borderColor}
        flex items-center justify-center cursor-pointer
        transform transition-all duration-300
        hover:scale-110 hover:${badge.glowColor}
        shadow-lg hover:shadow-xl relative overflow-hidden
    `}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsClicked(!isClicked);
                }}
                onMouseEnter={() => {
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                    }
                    setIsHovered(true);
                    hoverTimeoutRef.current = setTimeout(() => {
                        setIsHovered(false);
                    }, 2000);
                }}
                onMouseLeave={() => {
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                    }
                    setIsHovered(false);
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative z-10">
                    {IconComponent ? (
                        <IconComponent tier={badge.tierId} size={config.iconSize} />
                    ) : (
                        <span className="text-lg">🏅</span>
                    )}
                </div>
            </div>

            {showTooltip && (
                <div className={`absolute z-50 px-3 py-2 text-xs font-medium text-white rounded-lg shadow-lg
                    bg-gray-900 border border-gray-600
                    bottom-full left-1/2 transform -translate-x-1/2 mb-2 whitespace-nowrap
transition-opacity duration-300 ${(isClicked || isHovered)
                        ? 'opacity-100 pointer-events-auto'
                        : 'opacity-0 pointer-events-none'
                    }`}>
                    <div className="flex items-center">
                        <div>
                            <div className={`font-semibold ${badge.color}`}>
                                {badge.name}
                            </div>
                            <div className="text-gray-300">
                                {badge.currentValue} {badge.categoryName.toLowerCase()}
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 
                        border-l-4 border-r-4 border-transparent border-t-4 border-t-gray-900">
                    </div>
                </div>
            )}
        </div>
    );
});

// Collection component
export function BadgeCollection({ badges, maxDisplay = 3, size = "small" }) {
    const badgeArray = Object.entries(badges); // Now we have [categoryId, badge] pairs

    if (badgeArray.length === 0) return null;

    const tierOrder = { amethyst: 4, gold: 3, silver: 2, bronze: 1 };
    const sortedBadges = badgeArray.sort(([, a], [, b]) =>
        (tierOrder[b.tierId] || 0) - (tierOrder[a.tierId] || 0)
    );

    const displayBadges = maxDisplay ? sortedBadges.slice(0, maxDisplay) : sortedBadges;
    const hasMore = maxDisplay && sortedBadges.length > maxDisplay;

    return (
        <div className={`flex items-center ${size === 'xs' ? 'gap-0.5' : 'gap-0.5 sm:gap-1'} ml-1 flex-wrap`}>
            {displayBadges.map(([categoryId, badge]) => (
                <Badge
                    key={`${categoryId}-${badge.tierId}`}
                    badge={badge}
                    categoryId={categoryId}
                    size={size}
                />
            ))}
            {hasMore && (
                <div className={`
        ${size === 'xs' ? 'w-3 h-3 text-[8px] sm:text-[10px]' :
                        size === 'small' ? 'w-4 h-4 sm:w-5 sm:h-5 text-[10px] sm:text-xs' :
                            'w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm'} 
        rounded-md flex items-center justify-center 
        bg-gray-700 bg-opacity-50 border border-gray-600
        text-gray-400 font-medium flex-shrink-0
    `}>
                    +{sortedBadges.length - maxDisplay}
                </div>
            )}
        </div>
    );
}

export default Badge;