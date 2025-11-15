/**
 * TimeAwareIndicator Component
 * 
 * Displays dynamic, time-sensitive indicators for job scheduling
 * Shows countdown timers, ready windows, and overdue warnings
 */

import React, { useState, useEffect } from 'react';
import { getStatusBadgeClasses, getStatusConfig } from '../constants/statusColors';

const TimeAwareIndicator = ({ job, variant = 'default' }) => {
  const [timeInfo, setTimeInfo] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update current time every second for accurate countdown
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!job?.scheduled_date || !job?.start_time) {
      setTimeInfo(null);
      return;
    }

    calculateTimeInfo();
  }, [job, currentTime]);

  const calculateTimeInfo = () => {
    const scheduledDateTime = new Date(`${job.scheduled_date}T${job.start_time}`);
    const timeDiff = scheduledDateTime - currentTime;
    const minutesDiff = Math.floor(timeDiff / 1000 / 60);
    const hoursDiff = Math.floor(minutesDiff / 60);
    const daysDiff = Math.floor(hoursDiff / 24);

    // 30-minute early start window
    const earlyStartWindow = 30;
    const lateThreshold = 120; // 2 hours late

    let info = {
      type: 'scheduled',
      message: '',
      color: 'blue',
      icon: '🕐',
      animated: false
    };

    if (job.status === 'completed' || job.status === 'cancelled') {
      setTimeInfo(null);
      return;
    }

    // Job is in progress
    if (job.status === 'in_progress') {
      if (job.actual_start_time) {
        const startTime = new Date(job.actual_start_time);
        const elapsed = Math.floor((currentTime - startTime) / 1000 / 60);
        const hours = Math.floor(elapsed / 60);
        const minutes = elapsed % 60;

        info = {
          type: 'in_progress',
          message: `In progress: ${hours}h ${minutes}m`,
          color: 'indigo',
          icon: '🔄',
          animated: true
        };
      }
      setTimeInfo(info);
      return;
    }

    // Check if within ready-to-start window
    if (minutesDiff <= earlyStartWindow && minutesDiff >= -lateThreshold) {
      if (minutesDiff > 0) {
        // Can start soon
        const mins = minutesDiff;
        info = {
          type: 'ready_soon',
          message: `Ready in ${mins} min`,
          color: 'orange',
          icon: '⏰',
          animated: true
        };
      } else if (minutesDiff <= 0 && minutesDiff >= -30) {
        // Ready to start NOW (within window)
        const minsRemaining = 30 + minutesDiff; // Time left in window
        info = {
          type: 'ready_now',
          message: `Ready to start! (${minsRemaining} min left)`,
          color: 'green',
          icon: '🚀',
          animated: true
        };
      } else {
        // Overdue but within acceptable range
        const minsLate = Math.abs(minutesDiff);
        const hoursLate = Math.floor(minsLate / 60);
        const remainingMins = minsLate % 60;
        
        info = {
          type: 'late',
          message: hoursLate > 0 
            ? `⚠️ Late by ${hoursLate}h ${remainingMins}m` 
            : `⚠️ Late by ${minsLate} min`,
          color: 'red',
          icon: '⚠️',
          animated: true
        };
      }
    } 
    // Far future
    else if (daysDiff >= 1) {
      info = {
        type: 'scheduled',
        message: `Starts in ${daysDiff} day${daysDiff > 1 ? 's' : ''}`,
        color: 'blue',
        icon: '📅',
        animated: false
      };
    } 
    // Hours away
    else if (hoursDiff >= 1) {
      const mins = minutesDiff % 60;
      info = {
        type: 'scheduled',
        message: `Starts in ${hoursDiff}h ${mins}m`,
        color: 'blue',
        icon: '🕐',
        animated: false
      };
    }
    // Too late (beyond threshold)
    else if (minutesDiff < -lateThreshold) {
      const hoursLate = Math.floor(Math.abs(minutesDiff) / 60);
      info = {
        type: 'very_late',
        message: `⚠️ ${hoursLate}+ hours overdue`,
        color: 'red',
        icon: '🚨',
        animated: true
      };
    }

    setTimeInfo(info);
  };

  if (!timeInfo) {
    return null;
  }

  // Badge variant
  if (variant === 'badge') {
    const colorClasses = {
      blue: 'bg-blue-100 text-blue-800',
      orange: 'bg-orange-100 text-orange-800',
      green: 'bg-green-100 text-green-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      red: 'bg-red-100 text-red-800'
    };

    return (
      <span 
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
          ${colorClasses[timeInfo.color]}
          ${timeInfo.animated ? 'animate-pulse' : ''}
        `}
      >
        <span>{timeInfo.icon}</span>
        <span>{timeInfo.message}</span>
      </span>
    );
  }

  // Inline variant (for within text)
  if (variant === 'inline') {
    const colorClasses = {
      blue: 'text-blue-600',
      orange: 'text-orange-600',
      green: 'text-green-600',
      indigo: 'text-indigo-600',
      red: 'text-red-600'
    };

    return (
      <span className={`font-medium ${colorClasses[timeInfo.color]}`}>
        {timeInfo.icon} {timeInfo.message}
      </span>
    );
  }

  // Banner variant (prominent display)
  if (variant === 'banner') {
    const bannerClasses = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      orange: 'bg-orange-50 border-orange-200 text-orange-800',
      green: 'bg-green-50 border-green-200 text-green-800',
      indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
      red: 'bg-red-50 border-red-200 text-red-800'
    };

    return (
      <div 
        className={`
          px-4 py-3 rounded-lg border-2 
          ${bannerClasses[timeInfo.color]}
          ${timeInfo.animated ? 'animate-pulse' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{timeInfo.icon}</span>
          <div>
            <p className="font-semibold">{timeInfo.message}</p>
            {timeInfo.type === 'ready_now' && (
              <p className="text-sm mt-1 opacity-90">
                Tap "Start Job" to begin working
              </p>
            )}
            {timeInfo.type === 'late' && (
              <p className="text-sm mt-1 opacity-90">
                Please contact the client if you're running late
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xl">{timeInfo.icon}</span>
      <span className={`font-medium ${timeInfo.animated ? 'animate-pulse' : ''}`}>
        {timeInfo.message}
      </span>
    </div>
  );
};

export default TimeAwareIndicator;
