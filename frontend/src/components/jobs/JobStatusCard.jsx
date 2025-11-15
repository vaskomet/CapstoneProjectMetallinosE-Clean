import React from 'react';
import { STATUS_CONFIG, JOB_STATUSES } from '../../config/jobStatusConfig';

/**
 * JobStatusCard - Contextual status information card
 * 
 * Displays role-specific, actionable information about the current job status.
 * Shows what just happened, what's next, who needs to act, and when.
 * 
 * Features:
 * - Role-based messaging (client vs cleaner perspectives)
 * - Dynamic content for all 8 workflow stages
 * - Clear action items and expectations
 * - Time estimates and actor identification
 * - Color-coded variants for visual hierarchy
 * 
 * @component
 * @example
 * <JobStatusCard 
 *   job={jobObject}
 *   userRole="client"
 * />
 */
const JobStatusCard = ({ job, userRole }) => {
  const statusConfig = STATUS_CONFIG[job.status];
  
  if (!statusConfig) return null;

  /**
   * Generate dynamic card content based on status and user role
   * @returns {Object|null} Card content configuration
   */
  const getCardContent = () => {
    const { status } = job;
    const isClient = userRole === 'client';
    const isCleaner = userRole === 'cleaner';
    const cleanerName = job.assigned_cleaner?.user?.get_full_name || job.assigned_cleaner?.user?.first_name || 'The cleaner';

    switch (status) {
      case JOB_STATUSES.OPEN_FOR_BIDS:
        return isClient ? {
          title: '📢 Job Posted Successfully',
          justHappened: 'Your cleaning request is now visible to all cleaners in your area.',
          whatsNext: 'Cleaners will review your job and submit competitive bids.',
          whoActs: 'Waiting for cleaners to submit bids',
          when: 'Bids typically arrive within 1-24 hours',
          actionHint: 'Check back soon to review and compare bids!',
          variant: 'info',
        } : {
          title: '📢 New Job Available',
          justHappened: 'A client has posted a new cleaning request.',
          whatsNext: 'Review the job details and submit your bid if interested.',
          whoActs: 'You can submit a bid now',
          when: 'Before other cleaners fill the slot',
          actionHint: 'Submit a competitive bid to win this job!',
          variant: 'success',
        };

      case JOB_STATUSES.BID_ACCEPTED:
        return isClient ? {
          title: '💰 Payment Successful',
          justHappened: `You accepted ${cleanerName}'s bid and payment was processed.`,
          whatsNext: 'Waiting for the cleaner to confirm the job.',
          whoActs: `${cleanerName} needs to confirm`,
          when: 'Usually within a few hours',
          actionHint: 'You\'ll be notified once the cleaner confirms.',
          variant: 'success',
        } : {
          title: '💰 Your Bid Was Accepted!',
          justHappened: `The client accepted your bid of $${job.final_price}.`,
          whatsNext: 'Review the job details and confirm if you can take this job.',
          whoActs: 'You need to confirm the job',
          when: 'Please confirm within 24 hours',
          actionHint: 'Click "Confirm Bid" below to lock in this job.',
          variant: 'warning',
        };

      case JOB_STATUSES.CONFIRMED:
        return isClient ? {
          title: '✅ Cleaner Confirmed',
          justHappened: `${cleanerName} confirmed they will handle your cleaning.`,
          whatsNext: 'The cleaner will arrive during the scheduled time window.',
          whoActs: `${cleanerName} will start`,
          when: `${job.scheduled_date} between ${job.start_time} - ${job.end_time}`,
          actionHint: 'Make sure the property is accessible at the scheduled time.',
          variant: 'info',
        } : {
          title: '✅ Job Confirmed',
          justHappened: 'You confirmed this job successfully.',
          whatsNext: 'Arrive at the property during the scheduled time window.',
          whoActs: 'You need to start the job',
          when: `${job.scheduled_date} between ${job.start_time} - ${job.end_time}`,
          actionHint: 'Take "before" photos when you arrive and click "Start Job".',
          variant: 'info',
        };

      case JOB_STATUSES.READY_TO_START:
        return isClient ? {
          title: '⏰ Time Window Active',
          justHappened: 'The job\'s scheduled time window is now active.',
          whatsNext: `${cleanerName} can start working anytime in the next 30 minutes.`,
          whoActs: `${cleanerName} will start soon`,
          when: 'Within the next 30 minutes',
          actionHint: 'Ensure property access is ready.',
          variant: 'warning',
        } : {
          title: '⏰ Ready to Start!',
          justHappened: 'You\'re now within the 30-minute start window.',
          whatsNext: 'You can begin the job at any time.',
          whoActs: 'You can start the job now',
          when: 'Anytime in the next 30 minutes',
          actionHint: 'Take "before" photos and click "Start Job" when ready.',
          variant: 'warning',
        };

      case JOB_STATUSES.IN_PROGRESS:
        return isClient ? {
          title: '🧹 Work in Progress',
          justHappened: `${cleanerName} started working on your property.`,
          whatsNext: 'The cleaner will complete the work and submit photos for review.',
          whoActs: `${cleanerName} is working`,
          when: `Estimated ${job.estimated_duration || 60} minutes`,
          actionHint: 'You\'ll receive a notification when the work is complete.',
          variant: 'active',
        } : {
          title: '🧹 Job in Progress',
          justHappened: 'You started this job.',
          whatsNext: 'Complete the cleaning and upload "after" photos.',
          whoActs: 'You need to finish the job',
          when: 'Work at your own pace',
          actionHint: 'When done, take "after" photos and click "Complete Job".',
          variant: 'active',
        };

      case JOB_STATUSES.AWAITING_REVIEW:
        return isClient ? {
          title: '👀 Ready for Review',
          justHappened: `${cleanerName} finished the work and uploaded completion photos.`,
          whatsNext: 'Review the before/after photos and approve or request revisions.',
          whoActs: 'You need to review the work',
          when: 'Please review within 24 hours',
          actionHint: 'Compare photos and approve if satisfied, or request changes.',
          variant: 'warning',
        } : {
          title: '👀 Awaiting Client Review',
          justHappened: 'You submitted completion photos for review.',
          whatsNext: 'The client will review your work and provide feedback.',
          whoActs: 'Client is reviewing',
          when: 'Usually within 24 hours',
          actionHint: 'Payment will be released once the client approves.',
          variant: 'info',
        };

      case JOB_STATUSES.COMPLETED:
        return isClient ? {
          title: '✨ Job Completed!',
          justHappened: 'You approved the completed work.',
          whatsNext: 'Leave a review to help other clients find great cleaners.',
          whoActs: 'Optional: Leave a review',
          when: 'Anytime',
          actionHint: 'Your feedback helps improve our community!',
          variant: 'success',
        } : {
          title: '✨ Job Completed!',
          justHappened: 'The client approved your work.',
          whatsNext: 'Payment has been processed to your account.',
          whoActs: 'No action needed',
          when: 'Payment processed',
          actionHint: 'Great work! Look for more jobs in the Jobs Pool.',
          variant: 'success',
        };

      case JOB_STATUSES.CANCELLED:
        return {
          title: '❌ Job Cancelled',
          justHappened: 'This job was cancelled.',
          whatsNext: 'No further action required.',
          whoActs: 'None',
          when: 'N/A',
          actionHint: isClient ? 'You can post a new job anytime.' : 'Browse other available jobs.',
          variant: 'error',
        };

      default:
        return null;
    }
  };

  const content = getCardContent();
  if (!content) return null;

  // Variant styles for different urgency/action levels
  const variantStyles = {
    info: {
      bg: statusConfig.color.bg,
      border: statusConfig.color.border,
      text: statusConfig.color.text,
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-900',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
    },
    active: {
      bg: 'bg-purple-50',
      border: 'border-purple-300',
      text: 'text-purple-900',
    },
  };

  const style = variantStyles[content.variant] || variantStyles.info;

  return (
    <div className={`${style.bg} border-2 ${style.border} rounded-lg p-4 space-y-3`}>
      {/* Title with status icon */}
      <h3 className={`text-lg font-bold ${style.text} flex items-center`}>
        <span className="mr-2">{statusConfig.icon}</span>
        {content.title}
      </h3>

      {/* What just happened */}
      <div className="bg-white bg-opacity-60 rounded p-3 border border-gray-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">What just happened: </span>
          {content.justHappened}
        </p>
      </div>

      {/* What's next */}
      <div className="bg-white bg-opacity-60 rounded p-3 border border-gray-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">What's next: </span>
          {content.whatsNext}
        </p>
      </div>

      {/* Who & When grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white bg-opacity-60 rounded p-2 border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Who</p>
          <p className="text-sm font-medium text-gray-800">{content.whoActs}</p>
        </div>
        <div className="bg-white bg-opacity-60 rounded p-2 border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">When</p>
          <p className="text-sm font-medium text-gray-800">{content.when}</p>
        </div>
      </div>

      {/* Action hint */}
      <div className={`${style.text} text-sm font-medium flex items-start`}>
        <span className="mr-2">💡</span>
        <span>{content.actionHint}</span>
      </div>
    </div>
  );
};

export default JobStatusCard;
