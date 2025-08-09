// src/utils/ratingUtils.js

/**
 * Centralized rating calculation utilities
 * This ensures consistent weighting across the entire application
 */

// Single source of truth for weightings
export const RATING_WEIGHTINGS = {
    scoring: 0.30,
    defense: 0.15,
    rebounding: 0.15,
    playmaking: 0.10,
    stamina: 0.10,
    physicality: 0.15,
    xfactor: 0.05,
};

// Default values for missing ratings
export const DEFAULT_RATING_VALUES = {
    scoring: 5,
    defense: 5,
    rebounding: 5,
    playmaking: 5,
    stamina: 5,
    physicality: 5,
    xfactor: 5,
};

/**
 * Calculate weighted rating from individual stats
 * @param {Object} stats - Object containing individual stat ratings
 * @param {number} precision - Number of decimal places (default: 2)
 * @returns {number} Weighted rating
 */
export const calculateWeightedRating = (stats, precision = 2) => {
    const scoring = stats.scoring ?? DEFAULT_RATING_VALUES.scoring;
    const defense = stats.defense ?? DEFAULT_RATING_VALUES.defense;
    const rebounding = stats.rebounding ?? DEFAULT_RATING_VALUES.rebounding;
    const playmaking = stats.playmaking ?? DEFAULT_RATING_VALUES.playmaking;
    const stamina = stats.stamina ?? DEFAULT_RATING_VALUES.stamina;
    const physicality = stats.physicality ?? DEFAULT_RATING_VALUES.physicality;
    const xfactor = stats.xfactor ?? DEFAULT_RATING_VALUES.xfactor;

    const weightedRating =
        scoring * RATING_WEIGHTINGS.scoring +
        defense * RATING_WEIGHTINGS.defense +
        rebounding * RATING_WEIGHTINGS.rebounding +
        playmaking * RATING_WEIGHTINGS.playmaking +
        stamina * RATING_WEIGHTINGS.stamina +
        physicality * RATING_WEIGHTINGS.physicality +
        xfactor * RATING_WEIGHTINGS.xfactor;

    return parseFloat(weightedRating.toFixed(precision));
};

/**
 * Calculate player rating from submissions
 * @param {Array} submissions - Array of rating submissions
 * @param {number} precision - Number of decimal places (default: 2)
 * @returns {number} Average weighted rating from all submissions
 */
export const calculatePlayerRatingFromSubmissions = (submissions, precision = 2) => {
    if (!submissions || submissions.length === 0) {
        return calculateWeightedRating(DEFAULT_RATING_VALUES, precision);
    }

    const total = submissions.reduce((sum, submission) => {
        return sum + calculateWeightedRating(submission, 4); // Use higher precision for intermediate calculations
    }, 0);

    return parseFloat((total / submissions.length).toFixed(precision));
};

/**
 * Calculate average stats from submissions
 * @param {Array} submissions - Array of rating submissions
 * @param {number} precision - Number of decimal places (default: 2)
 * @returns {Object} Object containing average stats
 */
export const calculateAverageStatsFromSubmissions = (submissions, precision = 2) => {
    if (!submissions || submissions.length === 0) {
        return { ...DEFAULT_RATING_VALUES };
    }

    const totals = {
        scoring: 0,
        defense: 0,
        rebounding: 0,
        playmaking: 0,
        stamina: 0,
        physicality: 0,
        xfactor: 0
    };

    submissions.forEach(sub => {
        totals.scoring += sub.scoring ?? DEFAULT_RATING_VALUES.scoring;
        totals.defense += sub.defense ?? DEFAULT_RATING_VALUES.defense;
        totals.rebounding += sub.rebounding ?? DEFAULT_RATING_VALUES.rebounding;
        totals.playmaking += sub.playmaking ?? DEFAULT_RATING_VALUES.playmaking;
        totals.stamina += sub.stamina ?? DEFAULT_RATING_VALUES.stamina;
        totals.physicality += sub.physicality ?? DEFAULT_RATING_VALUES.physicality;
        totals.xfactor += sub.xfactor ?? DEFAULT_RATING_VALUES.xfactor;
    });

    const len = submissions.length;
    return {
        scoring: parseFloat((totals.scoring / len).toFixed(precision)),
        defense: parseFloat((totals.defense / len).toFixed(precision)),
        rebounding: parseFloat((totals.rebounding / len).toFixed(precision)),
        playmaking: parseFloat((totals.playmaking / len).toFixed(precision)),
        stamina: parseFloat((totals.stamina / len).toFixed(precision)),
        physicality: parseFloat((totals.physicality / len).toFixed(precision)),
        xfactor: parseFloat((totals.xfactor / len).toFixed(precision)),
    };
};

/**
 * Get percentage from rating (for progress bars)
 * @param {number} rating - Rating value (0-10)
 * @returns {number} Percentage (0-100)
 */
export const getPercentageFromRating = (rating) => {
    return (rating / 10) * 100;
};