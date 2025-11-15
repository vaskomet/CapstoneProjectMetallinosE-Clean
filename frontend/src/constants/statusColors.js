/**
 * Job Status Visual Constants
 * 
 * Centralized color palette and icons for job statuses across the application.
 * Ensures consistent visual language and improved user experience.
 * 
 * Usage:
 * ```jsx
 * import { getStatusConfig, getStatusBadgeClasses } from './constants/statusColors';
 * 
 * const config = getStatusConfig(job.status);
 * <span className={getStatusBadgeClasses(job.status)}>
 *   {config.icon} {config.label}
 * </span>
 * ```
 */

/**
 * Complete status configuration with colors, icons, and labels
 */
export const STATUS_COLORS = {
  open_for_bids: {
    bg: 'blue',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-200',
    hoverClass: 'hover:bg-blue-200',
    icon: '📢',
    label: 'Open for Bids',
    description: 'Accepting cleaner proposals',
    pulseColor: 'blue'
  },
  bid_accepted: {
    bg: 'yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
    borderClass: 'border-yellow-200',
    hoverClass: 'hover:bg-yellow-200',
    icon: '🤝',
    label: 'Bid Accepted',
    description: 'Awaiting cleaner confirmation',
    pulseColor: 'yellow'
  },
  confirmed: {
    bg: 'purple',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-800',
    borderClass: 'border-purple-200',
    hoverClass: 'hover:bg-purple-200',
    icon: '✅',
    label: 'Confirmed',
    description: 'Cleaner confirmed the job',
    pulseColor: 'purple'
  },
  ready_to_start: {
    bg: 'orange',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
    borderClass: 'border-orange-200',
    hoverClass: 'hover:bg-orange-200',
    icon: '🚀',
    label: 'Ready to Start',
    description: 'Within 30-minute start window',
    pulseColor: 'orange'
  },
  in_progress: {
    bg: 'indigo',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-800',
    borderClass: 'border-indigo-200',
    hoverClass: 'hover:bg-indigo-200',
    icon: '🔄',
    label: 'In Progress',
    description: 'Job is being completed',
    pulseColor: 'indigo'
  },
  awaiting_review: {
    bg: 'teal',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-800',
    borderClass: 'border-teal-200',
    hoverClass: 'hover:bg-teal-200',
    icon: '👀',
    label: 'Awaiting Review',
    description: 'Client reviewing completed work',
    pulseColor: 'teal'
  },
  completed: {
    bg: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
    borderClass: 'border-green-200',
    hoverClass: 'hover:bg-green-200',
    icon: '🎉',
    label: 'Completed',
    description: 'Job successfully finished',
    pulseColor: 'green'
  },
  cancelled: {
    bg: 'red',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
    borderClass: 'border-red-200',
    hoverClass: 'hover:bg-red-200',
    icon: '❌',
    label: 'Cancelled',
    description: 'Job was cancelled',
    pulseColor: 'red'
  }
};

/**
 * Get configuration object for a given status
 * @param {string} status - Job status key
 * @returns {Object} Status configuration
 */
export const getStatusConfig = (status) => {
  return STATUS_COLORS[status] || {
    bg: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
    borderClass: 'border-gray-200',
    hoverClass: 'hover:bg-gray-200',
    icon: '❓',
    label: 'Unknown',
    description: 'Unknown status',
    pulseColor: 'gray'
  };
};

/**
 * Get Tailwind classes for status badge
 * @param {string} status - Job status key
 * @param {Object} options - Customization options
 * @returns {string} Combined Tailwind classes
 */
export const getStatusBadgeClasses = (status, options = {}) => {
  const {
    size = 'default', // 'sm', 'default', 'lg'
    variant = 'default', // 'default', 'outline', 'solid'
    rounded = 'full', // 'full', 'md', 'lg'
    animated = false
  } = options;

  const config = getStatusConfig(status);
  
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    default: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  // Variant classes
  let variantClasses = '';
  if (variant === 'outline') {
    variantClasses = `bg-white border-2 ${config.borderClass} ${config.textClass}`;
  } else if (variant === 'solid') {
    // Use darker background and white text for solid variant
    const solidColors = {
      blue: 'bg-blue-600 text-white',
      yellow: 'bg-yellow-500 text-white',
      purple: 'bg-purple-600 text-white',
      orange: 'bg-orange-500 text-white',
      indigo: 'bg-indigo-600 text-white',
      teal: 'bg-teal-600 text-white',
      green: 'bg-green-600 text-white',
      red: 'bg-red-600 text-white',
      gray: 'bg-gray-500 text-white'
    };
    variantClasses = solidColors[config.bg];
  } else {
    variantClasses = `${config.bgClass} ${config.textClass}`;
  }

  // Rounded classes
  const roundedClasses = {
    full: 'rounded-full',
    md: 'rounded-md',
    lg: 'rounded-lg'
  };

  // Animation classes
  const animationClass = animated ? 'animate-pulse' : '';

  return `inline-flex items-center gap-1 font-medium ${sizeClasses[size]} ${variantClasses} ${roundedClasses[rounded]} ${animationClass}`.trim();
};

/**
 * Get progress bar color for status
 * @param {string} status - Job status key
 * @returns {string} Tailwind color class for progress bar
 */
export const getProgressColor = (status) => {
  const config = getStatusConfig(status);
  const progressColors = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400'
  };
  return progressColors[config.bg];
};

/**
 * Get dot indicator color for status (used in lists)
 * @param {string} status - Job status key
 * @returns {string} Tailwind color class for dot
 */
export const getDotColor = (status) => {
  const config = getStatusConfig(status);
  const dotColors = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    gray: 'bg-gray-400'
  };
  return dotColors[config.bg];
};

/**
 * Calculate status progress percentage (for progress bars)
 * @param {string} status - Job status key
 * @returns {number} Progress percentage (0-100)
 */
export const getStatusProgress = (status) => {
  const progressMap = {
    open_for_bids: 10,
    bid_accepted: 25,
    confirmed: 40,
    ready_to_start: 55,
    in_progress: 70,
    awaiting_review: 85,
    completed: 100,
    cancelled: 0
  };
  return progressMap[status] || 0;
};

/**
 * Get all statuses in workflow order
 * @returns {Array<string>} Ordered status keys
 */
export const getStatusWorkflow = () => {
  return [
    'open_for_bids',
    'bid_accepted',
    'confirmed',
    'ready_to_start',
    'in_progress',
    'awaiting_review',
    'completed'
  ];
};

/**
 * Check if status is in active workflow (not cancelled/completed)
 * @param {string} status - Job status key
 * @returns {boolean} True if status is active
 */
export const isActiveStatus = (status) => {
  return !['completed', 'cancelled'].includes(status);
};

/**
 * Get status index in workflow (for progress tracking)
 * @param {string} status - Job status key
 * @returns {number} Index in workflow (-1 if not found)
 */
export const getStatusIndex = (status) => {
  return getStatusWorkflow().indexOf(status);
};

export default STATUS_COLORS;
