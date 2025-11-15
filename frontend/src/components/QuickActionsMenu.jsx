/**
 * QuickActionsMenu Component
 * 
 * Context-aware action buttons for job workflows
 * Displays relevant actions based on job status and user role
 * Uses existing functionality - does not duplicate existing features
 */

import React from 'react';

const QuickActionsMenu = ({ job, user, onAction }) => {
  if (!job || !user) return null;

  // Determine available actions based on status and role
  const getAvailableActions = () => {
    const actions = [];
    const isClient = user.role === 'client' && job.client?.id === user.id;
    const isCleaner = user.role === 'cleaner' && job.cleaner?.id === user.id;

    // Cleaner workflow actions (primary job progression)
    if (isCleaner) {
      if (job.status === 'bid_accepted') {
        actions.push({
          id: 'confirm',
          label: 'Confirm Job',
          icon: '✅',
          color: 'purple',
          onClick: () => onAction?.('confirm', job),
          prominent: true
        });
      }

      if (['confirmed', 'ready_to_start'].includes(job.status)) {
        actions.push({
          id: 'start',
          label: 'Start Job',
          icon: '🚀',
          color: 'green',
          onClick: () => onAction?.('start', job),
          prominent: true
        });
      }

      if (job.status === 'in_progress') {
        actions.push({
          id: 'finish',
          label: 'Complete Job',
          icon: '🎉',
          color: 'purple',
          onClick: () => onAction?.('finish', job),
          prominent: true
        });
      }
    }

    // Client review action
    if (isClient && job.status === 'awaiting_review') {
      actions.push({
        id: 'review',
        label: 'Review Work',
        icon: '�',
        color: 'teal',
        onClick: () => {
          // Scroll to review section that's already visible in modal
          const reviewSection = document.querySelector('[data-review-section]');
          if (reviewSection) {
            reviewSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        prominent: true
      });
    }

    return actions;
  };

  const actions = getAvailableActions();

  if (actions.length === 0) {
    return null;
  }

  const getButtonClasses = (action) => {
    const colorClasses = {
      green: 'bg-green-600 hover:bg-green-700 text-white',
      purple: 'bg-purple-600 hover:bg-purple-700 text-white',
      teal: 'bg-teal-600 hover:bg-teal-700 text-white'
    };

    const size = action.prominent 
      ? 'px-6 py-3 text-base font-semibold'
      : 'px-4 py-2 text-sm font-medium';

    return `${colorClasses[action.color]} ${size} rounded-lg transition-all duration-200 transform hover:scale-105 focus:ring-2 focus:ring-offset-2 focus:ring-${action.color}-500 shadow-sm hover:shadow-md`;
  };

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Quick Actions
        </h3>
        <span className="text-xs text-gray-500">
          {actions.length} action{actions.length > 1 ? 's' : ''} available
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={getButtonClasses(action)}
            title={action.label}
          >
            <span className="flex items-center gap-2">
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Helpful hint for prominent actions */}
      {actions.some(a => a.prominent) && (
        <p className="text-xs text-gray-600 mt-3 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Click to progress the job to the next stage</span>
        </p>
      )}
    </div>
  );
};

export default QuickActionsMenu;
