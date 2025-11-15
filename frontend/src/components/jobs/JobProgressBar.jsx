import React from 'react';
import { STATUS_CONFIG, JOB_STATUSES, getStatusConfig } from '../../config/jobStatusConfig';

/**
 * JobProgressBar - Visual workflow progress indicator
 * 
 * Displays a horizontal progress bar showing the job's current stage
 * in the workflow from posting to completion. Uses checkmarks for
 * completed stages and highlights the current stage.
 * 
 * Features:
 * - 6-stage workflow visualization (excludes ready_to_start)
 * - Responsive size variants (sm/md/lg)
 * - Smooth transitions between stages
 * - Handles cancelled state gracefully
 * - Optional stage labels
 * 
 * @component
 * @example
 * <JobProgressBar 
 *   currentStatus="in_progress" 
 *   size="md"
 *   showLabels={true}
 * />
 */
const JobProgressBar = ({ 
  currentStatus, 
  size = 'md',
  showLabels = true,
  className = '' 
}) => {
  const currentConfig = getStatusConfig(currentStatus);
  const currentStage = currentConfig?.progressStage || 0;

  // Workflow stages for display (simplified 6-stage flow)
  // Note: ready_to_start is auto-generated, not shown in progress
  const stages = [
    { status: JOB_STATUSES.OPEN_FOR_BIDS, shortLabel: 'Posted' },
    { status: JOB_STATUSES.BID_ACCEPTED, shortLabel: 'Accepted' },
    { status: JOB_STATUSES.CONFIRMED, shortLabel: 'Confirmed' },
    { status: JOB_STATUSES.IN_PROGRESS, shortLabel: 'Working' },
    { status: JOB_STATUSES.AWAITING_REVIEW, shortLabel: 'Review' },
    { status: JOB_STATUSES.COMPLETED, shortLabel: 'Done' },
  ];

  // Size configuration
  const sizeClasses = {
    sm: {
      circle: 'w-6 h-6 text-xs',
      line: 'h-0.5',
      label: 'text-xs',
      spacing: 'space-x-1',
    },
    md: {
      circle: 'w-8 h-8 text-sm',
      line: 'h-1',
      label: 'text-sm',
      spacing: 'space-x-2',
    },
    lg: {
      circle: 'w-10 h-10 text-base',
      line: 'h-1.5',
      label: 'text-base',
      spacing: 'space-x-3',
    },
  };

  const classes = sizeClasses[size] || sizeClasses.md;

  /**
   * Determine visual style for each stage
   * @param {number} stageNum - Stage number (1-based)
   * @returns {Object} Style configuration for circle, line, and icon
   */
  const getStageStyle = (stageNum) => {
    // Adjust for ready_to_start being stage 4 but not shown
    const adjustedCurrent = currentStage > 3 ? currentStage - 1 : currentStage;
    
    if (stageNum < adjustedCurrent) {
      // Completed stages - green checkmark
      return {
        circle: 'bg-green-500 border-green-500 text-white',
        line: 'bg-green-500',
        icon: '✓',
      };
    } else if (stageNum === adjustedCurrent) {
      // Current stage - highlighted with ring
      const config = STATUS_CONFIG[stages[stageNum - 1].status];
      return {
        circle: `${config.color.bg} ${config.color.border} border-2 ${config.color.text} ring-4 ring-opacity-30 ring-${config.color.border.split('-')[1]}-300`,
        line: 'bg-gray-300',
        icon: config.icon,
      };
    } else {
      // Future stages - gray
      return {
        circle: 'bg-gray-200 border-gray-300 text-gray-500',
        line: 'bg-gray-300',
        icon: '',
      };
    }
  };

  // Special handling for cancelled jobs
  if (currentStatus === JOB_STATUSES.CANCELLED) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="bg-red-50 border-2 border-red-300 rounded-lg px-4 py-2">
          <span className="text-red-800 font-semibold">❌ Job Cancelled</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Progress bar */}
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const stageNum = index + 1;
          const style = getStageStyle(stageNum);
          const isLast = index === stages.length - 1;

          return (
            <div key={stage.status} className="flex items-center flex-1">
              {/* Stage circle */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`
                    ${classes.circle} 
                    ${style.circle}
                    rounded-full 
                    border-2 
                    flex 
                    items-center 
                    justify-center 
                    font-semibold
                    transition-all
                    duration-300
                  `}
                >
                  {style.icon}
                </div>
                
                {/* Stage label */}
                {showLabels && (
                  <div className={`${classes.label} mt-2 text-center font-medium whitespace-nowrap`}>
                    {stage.shortLabel}
                  </div>
                )}
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div className={`flex-1 ${classes.line} ${style.line} mx-1 transition-all duration-300`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current status text */}
      <div className="mt-4 text-center">
        <span className="text-gray-600 text-sm">Current Status: </span>
        <span className={`font-semibold ${currentConfig.color.text}`}>
          {currentConfig.label}
        </span>
      </div>
    </div>
  );
};

export default JobProgressBar;
