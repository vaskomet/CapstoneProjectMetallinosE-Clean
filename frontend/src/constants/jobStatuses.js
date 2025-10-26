/**
 * Job Status Constants
 * 
 * Defines all possible job statuses and their properties for consistent use across the application.
 * These must match the STATUS_CHOICES in backend/cleaning_jobs/models.py
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
 * Job Status Display Names
 * Human-readable labels for each status
 */
export const JOB_STATUS_LABELS = {
  [JOB_STATUSES.OPEN_FOR_BIDS]: 'Open for Bids',
  [JOB_STATUSES.BID_ACCEPTED]: 'Bid Accepted',
  [JOB_STATUSES.CONFIRMED]: 'Confirmed',
  [JOB_STATUSES.READY_TO_START]: 'Ready to Start',
  [JOB_STATUSES.IN_PROGRESS]: 'In Progress',
  [JOB_STATUSES.AWAITING_REVIEW]: 'Awaiting Review',
  [JOB_STATUSES.COMPLETED]: 'Completed',
  [JOB_STATUSES.CANCELLED]: 'Cancelled',
};

/**
 * Job Status Colors
 * Consistent color scheme for status indicators across the application
 */
export const JOB_STATUS_COLORS = {
  [JOB_STATUSES.OPEN_FOR_BIDS]: {
    hex: '#f59e0b',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
  },
  [JOB_STATUSES.BID_ACCEPTED]: {
    hex: '#06b6d4',
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    border: 'border-cyan-300',
  },
  [JOB_STATUSES.CONFIRMED]: {
    hex: '#3b82f6',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
  },
  [JOB_STATUSES.READY_TO_START]: {
    hex: '#6366f1',
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-300',
  },
  [JOB_STATUSES.IN_PROGRESS]: {
    hex: '#8b5cf6',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
  },
  [JOB_STATUSES.AWAITING_REVIEW]: {
    hex: '#14b8a6',
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    border: 'border-teal-300',
  },
  [JOB_STATUSES.COMPLETED]: {
    hex: '#10b981',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
  },
  [JOB_STATUSES.CANCELLED]: {
    hex: '#ef4444',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
  },
};

/**
 * Job Status Workflow
 * Defines the complete lifecycle of a job from creation to completion
 */
export const JOB_STATUS_FLOW = [
  {
    status: JOB_STATUSES.OPEN_FOR_BIDS,
    description: 'Job is available for cleaners to bid on',
    actor: 'Client',
    next: [JOB_STATUSES.BID_ACCEPTED, JOB_STATUSES.CANCELLED],
  },
  {
    status: JOB_STATUSES.BID_ACCEPTED,
    description: 'Client accepted a bid, awaiting cleaner confirmation',
    actor: 'Client',
    next: [JOB_STATUSES.CONFIRMED, JOB_STATUSES.CANCELLED],
  },
  {
    status: JOB_STATUSES.CONFIRMED,
    description: 'Cleaner confirmed the job',
    actor: 'Cleaner',
    next: [JOB_STATUSES.READY_TO_START, JOB_STATUSES.CANCELLED],
  },
  {
    status: JOB_STATUSES.READY_TO_START,
    description: 'Job is ready to begin (within 30-minute window)',
    actor: 'Cleaner',
    next: [JOB_STATUSES.IN_PROGRESS, JOB_STATUSES.CANCELLED],
  },
  {
    status: JOB_STATUSES.IN_PROGRESS,
    description: 'Cleaner is actively working on the job',
    actor: 'Cleaner',
    next: [JOB_STATUSES.AWAITING_REVIEW, JOB_STATUSES.CANCELLED],
  },
  {
    status: JOB_STATUSES.AWAITING_REVIEW,
    description: 'Job finished, waiting for client review and rating',
    actor: 'Cleaner',
    next: [JOB_STATUSES.COMPLETED, JOB_STATUSES.CANCELLED],
  },
  {
    status: JOB_STATUSES.COMPLETED,
    description: 'Job successfully completed and reviewed',
    actor: 'Client',
    next: [],
  },
  {
    status: JOB_STATUSES.CANCELLED,
    description: 'Job was cancelled',
    actor: 'Client/Cleaner',
    next: [],
  },
];

/**
 * Get status color (hex value)
 * @param {string} status - Job status
 * @returns {string} Hex color code
 */
export const getStatusColor = (status) => {
  return JOB_STATUS_COLORS[status]?.hex || '#6b7280';
};

/**
 * Get status display name
 * @param {string} status - Job status
 * @returns {string} Human-readable status label
 */
export const getStatusLabel = (status) => {
  return JOB_STATUS_LABELS[status] || status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Get Tailwind classes for status badge
 * @param {string} status - Job status
 * @returns {object} Object with bg, text, and border classes
 */
export const getStatusClasses = (status) => {
  return JOB_STATUS_COLORS[status] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
  };
};

/**
 * Check if status represents an active job
 * @param {string} status - Job status
 * @returns {boolean} True if job is active
 */
export const isActiveStatus = (status) => {
  return [
    JOB_STATUSES.CONFIRMED,
    JOB_STATUSES.READY_TO_START,
    JOB_STATUSES.IN_PROGRESS,
  ].includes(status);
};

/**
 * Check if status represents a completed/final state
 * @param {string} status - Job status
 * @returns {boolean} True if job is in final state
 */
export const isFinalStatus = (status) => {
  return [
    JOB_STATUSES.COMPLETED,
    JOB_STATUSES.CANCELLED,
  ].includes(status);
};

/**
 * Check if status allows cancellation
 * @param {string} status - Job status
 * @returns {boolean} True if job can be cancelled
 */
export const canBeCancelled = (status) => {
  return ![
    JOB_STATUSES.COMPLETED,
    JOB_STATUSES.CANCELLED,
    JOB_STATUSES.AWAITING_REVIEW,
  ].includes(status);
};
