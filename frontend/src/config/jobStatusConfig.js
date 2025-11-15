/**
 * Centralized Job Status Configuration
 * 
 * Single source of truth for all job status-related UI elements.
 * Used by calendar views, cards, lists, modals, and workflow components.
 * 
 * Benefits:
 * - Prevents color/label drift across components
 * - Easy to add new statuses or properties
 * - Type-safe access via constants
 * - Consistent user experience
 * 
 * @module jobStatusConfig
 */

/**
 * Job status constants
 * Use these instead of string literals to prevent typos
 */
export const JOB_STATUSES = {
  OPEN_FOR_BIDS: 'open_for_bids',
  BID_ACCEPTED: 'bid_accepted',
  CONFIRMED: 'confirmed',
  READY_TO_START: 'ready_to_start',
  IN_PROGRESS: 'in_progress',
  AWAITING_REVIEW: 'awaiting_review',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * Comprehensive status configuration
 * Each status includes:
 * - label: Human-readable display name
 * - color: Multiple format options (hex, Tailwind classes, variants)
 * - progressStage: Workflow position (1-7, null for terminal states)
 * - icon: Emoji for visual identification
 */
export const STATUS_CONFIG = {
  [JOB_STATUSES.OPEN_FOR_BIDS]: {
    label: 'Open for Bids',
    color: {
      hex: '#f59e0b',                          // Calendar events
      tailwind: 'bg-amber-100 text-amber-800', // Badge background
      bg: 'bg-amber-50',                       // Card backgrounds
      border: 'border-amber-300',              // Borders
      text: 'text-amber-900',                  // Text color
    },
    progressStage: 1,
    icon: '📢',
  },
  [JOB_STATUSES.BID_ACCEPTED]: {
    label: 'Bid Accepted',
    color: {
      hex: '#06b6d4',
      tailwind: 'bg-cyan-100 text-cyan-800',
      bg: 'bg-cyan-50',
      border: 'border-cyan-300',
      text: 'text-cyan-900',
    },
    progressStage: 2,
    icon: '💰',
  },
  [JOB_STATUSES.CONFIRMED]: {
    label: 'Confirmed',
    color: {
      hex: '#3b82f6',
      tailwind: 'bg-blue-100 text-blue-800',
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      text: 'text-blue-900',
    },
    progressStage: 3,
    icon: '✅',
  },
  [JOB_STATUSES.READY_TO_START]: {
    label: 'Ready to Start',
    color: {
      hex: '#6366f1',
      tailwind: 'bg-indigo-100 text-indigo-800',
      bg: 'bg-indigo-50',
      border: 'border-indigo-300',
      text: 'text-indigo-900',
    },
    progressStage: 4,
    icon: '⏰',
  },
  [JOB_STATUSES.IN_PROGRESS]: {
    label: 'In Progress',
    color: {
      hex: '#8b5cf6',
      tailwind: 'bg-purple-100 text-purple-800',
      bg: 'bg-purple-50',
      border: 'border-purple-300',
      text: 'text-purple-900',
    },
    progressStage: 5,
    icon: '🧹',
  },
  [JOB_STATUSES.AWAITING_REVIEW]: {
    label: 'Awaiting Review',
    color: {
      hex: '#14b8a6',
      tailwind: 'bg-teal-100 text-teal-800',
      bg: 'bg-teal-50',
      border: 'border-teal-300',
      text: 'text-teal-900',
    },
    progressStage: 6,
    icon: '👀',
  },
  [JOB_STATUSES.COMPLETED]: {
    label: 'Completed',
    color: {
      hex: '#10b981',
      tailwind: 'bg-green-100 text-green-800',
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
    },
    progressStage: 7,
    icon: '✨',
  },
  [JOB_STATUSES.CANCELLED]: {
    label: 'Cancelled',
    color: {
      hex: '#ef4444',
      tailwind: 'bg-red-100 text-red-800',
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
    },
    progressStage: null, // Terminal state, not in workflow
    icon: '❌',
  },
};

/**
 * Get complete status configuration object
 * @param {string} status - Job status
 * @returns {Object} Status configuration with colors, label, icon
 */
export const getStatusConfig = (status) => {
  return STATUS_CONFIG[status] || STATUS_CONFIG[JOB_STATUSES.OPEN_FOR_BIDS];
};

/**
 * Get hex color for calendar events
 * @param {string} status - Job status
 * @returns {string} Hex color code (e.g., '#f59e0b')
 */
export const getStatusColor = (status) => {
  return getStatusConfig(status).color.hex;
};

/**
 * Get Tailwind classes for badges
 * @param {string} status - Job status
 * @returns {string} Tailwind class string (e.g., 'bg-amber-100 text-amber-800')
 */
export const getStatusTailwind = (status) => {
  return getStatusConfig(status).color.tailwind;
};

/**
 * Get human-readable label
 * @param {string} status - Job status
 * @returns {string} Display label (e.g., 'Open for Bids')
 */
export const getStatusLabel = (status) => {
  return getStatusConfig(status).label;
};

/**
 * Get emoji icon
 * @param {string} status - Job status
 * @returns {string} Emoji character (e.g., '📢')
 */
export const getStatusIcon = (status) => {
  return getStatusConfig(status).icon;
};

/**
 * Get workflow progress stage number
 * @param {string} status - Job status
 * @returns {number|null} Stage number (1-7) or null for terminal states
 */
export const getProgressStage = (status) => {
  return getStatusConfig(status).progressStage;
};

/**
 * Check if status is a terminal state (cancelled)
 * @param {string} status - Job status
 * @returns {boolean} True if terminal state
 */
export const isTerminalStatus = (status) => {
  return getProgressStage(status) === null;
};

/**
 * Check if status is in active workflow
 * @param {string} status - Job status
 * @returns {boolean} True if part of normal workflow
 */
export const isActiveStatus = (status) => {
  return getProgressStage(status) !== null;
};

/**
 * Get all workflow statuses (excludes terminal states)
 * @returns {Array<string>} Array of status values in workflow order
 */
export const getWorkflowStatuses = () => {
  return Object.entries(STATUS_CONFIG)
    .filter(([_, config]) => config.progressStage !== null)
    .sort((a, b) => a[1].progressStage - b[1].progressStage)
    .map(([status, _]) => status);
};
