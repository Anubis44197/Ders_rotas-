/**
 * Balanced Scoring Algorithm for Task Completion
 * 
 * Design Goals:
 * - Average task: 10-30 points
 * - Performance-based bonuses (not overly generous)
 * - Task type and difficulty considerations
 * - Reasonable progression curve
 */

import { Task, TaskCompletionData } from '../types';

export interface ScoringResult {
    pointsAwarded: number;
    breakdown: {
        basePoints: number;
        performanceBonus: number;
        difficultyMultiplier: number;
        taskTypeBonus: number;
        totalBeforeCap: number;
        appliedCap: boolean;
    };
}

/**
 * Calculate balanced points for task completion
 */
export function calculateTaskPoints(task: Task, completionData: TaskCompletionData, successScore?: number, focusScore?: number): ScoringResult {
    // Base points calculation (more conservative)
    let basePoints = getBasePoints(task);
    
    // Performance bonuses (additive, not multiplicative)
    const performanceBonus = calculatePerformanceBonus(successScore, focusScore);
    
    // Task difficulty multiplier
    const difficultyMultiplier = getDifficultyMultiplier(task);
    
    // Task type specific bonuses
    const taskTypeBonus = getTaskTypeBonus(task, completionData);
    
    // Calculate total before cap
    const totalBeforeCap = Math.round((basePoints + performanceBonus) * difficultyMultiplier + taskTypeBonus);
    
    // Apply reasonable caps
    const { pointsAwarded, appliedCap } = applyPointsCap(totalBeforeCap, task);
    
    return {
        pointsAwarded,
        breakdown: {
            basePoints,
            performanceBonus,
            difficultyMultiplier,
            taskTypeBonus,
            totalBeforeCap,
            appliedCap
        }
    };
}

/**
 * Conservative base points - no longer 1:1 with duration
 */
function getBasePoints(task: Task): number {
    const baseDuration = task.plannedDuration;
    
    // Scale down significantly: 60 minutes = ~12-15 base points
    if (baseDuration <= 15) return 5;      // Short tasks: 5 points
    if (baseDuration <= 30) return 8;      // Medium tasks: 8 points  
    if (baseDuration <= 45) return 12;     // Long tasks: 12 points
    if (baseDuration <= 60) return 15;     // Extended tasks: 15 points
    
    // Very long tasks: cap growth
    return Math.min(20, 15 + Math.floor((baseDuration - 60) / 30));
}

/**
 * Performance bonuses - additive instead of multiplicative
 */
function calculatePerformanceBonus(successScore?: number, focusScore?: number): number {
    let bonus = 0;
    
    // Success score bonus (0-10 points)
    if (successScore !== undefined) {
        if (successScore >= 95) bonus += 8;        // Excellent: +8
        else if (successScore >= 90) bonus += 6;   // Great: +6
        else if (successScore >= 80) bonus += 4;   // Good: +4
        else if (successScore >= 70) bonus += 2;   // Okay: +2
        // Below 70: no bonus
    }
    
    // Focus score bonus (0-6 points)
    if (focusScore !== undefined) {
        if (focusScore >= 95) bonus += 5;          // Perfect focus: +5
        else if (focusScore >= 90) bonus += 4;     // Great focus: +4
        else if (focusScore >= 80) bonus += 3;     // Good focus: +3
        else if (focusScore >= 70) bonus += 1;     // Okay focus: +1
        // Below 70: no focus bonus
    }
    
    return bonus;
}

/**
 * Difficulty multiplier based on task characteristics
 */
function getDifficultyMultiplier(task: Task): number {
    let multiplier = 1.0;
    
    // Question count difficulty
    if (task.taskType === 'soru çözme' && task.questionCount) {
        if (task.questionCount >= 50) multiplier += 0.3;      // +30% for 50+ questions
        else if (task.questionCount >= 30) multiplier += 0.2; // +20% for 30+ questions
        else if (task.questionCount >= 20) multiplier += 0.1; // +10% for 20+ questions
    }
    
    // Duration difficulty
    if (task.plannedDuration >= 90) multiplier += 0.2;        // +20% for 90+ min tasks
    else if (task.plannedDuration >= 60) multiplier += 0.1;   // +10% for 60+ min tasks
    
    // Cap multiplier
    return Math.min(1.5, multiplier); // Max 50% difficulty bonus
}

/**
 * Task type specific bonuses
 */
function getTaskTypeBonus(task: Task, completionData: TaskCompletionData): number {
    switch (task.taskType) {
        case 'kitap okuma':
            // Reading bonus: more conservative
            const pagesRead = completionData.pagesRead || 0;
            if (pagesRead > 0) {
                // 0.3 points per page, max 15 bonus points
                return Math.min(15, Math.round(pagesRead * 0.3));
            }
            return 0;
            
        case 'soru çözme':
            // Small bonus for problem solving
            return 2;
            
        case 'ders çalışma':
            // Small bonus for study sessions
            return 1;
            
        default:
            return 0;
    }
}

/**
 * Apply reasonable point caps
 */
function applyPointsCap(points: number, task: Task): { pointsAwarded: number; appliedCap: boolean } {
    let cap: number;
    
    // Set caps based on task duration
    if (task.plannedDuration <= 30) cap = 25;      // Short tasks: max 25 points
    else if (task.plannedDuration <= 60) cap = 40; // Medium tasks: max 40 points
    else cap = 60;                                  // Long tasks: max 60 points
    
    // Apply minimum of 1 point
    const finalPoints = Math.max(1, Math.min(cap, points));
    
    return {
        pointsAwarded: finalPoints,
        appliedCap: points > cap
    };
}

/**
 * Helper function to get average points range for task type
 */
export function getExpectedPointsRange(task: Task): { min: number; max: number; average: number } {
    const basePoints = getBasePoints(task);
    const maxPerformanceBonus = 14; // Max success + focus bonus
    const maxDifficultyMultiplier = 1.5;
    const maxTaskTypeBonus = task.taskType === 'kitap okuma' ? 15 : 2;
    
    const min = Math.max(1, basePoints); // Minimum with no bonuses
    const max = Math.round((basePoints + maxPerformanceBonus) * maxDifficultyMultiplier + maxTaskTypeBonus);
    const average = Math.round((min + max) / 2);
    
    return { min, max, average };
}