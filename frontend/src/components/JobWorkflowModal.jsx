/**
 * JobWorkflowModal component for cleaner job workflow actions
 * Handles job confirmation, starting, and completion with photo uploads
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import PhotoUpload from './PhotoUpload';
import TimeAwareIndicator from './TimeAwareIndicator';
import { getStatusBadgeClasses, getStatusConfig } from '../constants/statusColors';
import { jobWorkflowAPI } from '../services/jobLifecycleAPI';

const JobWorkflowModal = ({ 
  isOpen, 
  onClose, 
  job, 
  action, // 'confirm', 'start', 'finish'
  onJobUpdated 
}) => {
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const getButtonClasses = (color) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
      case 'green':
        return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      case 'purple':
        return 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setBeforePhotos([]);
      setAfterPhotos([]);
    }
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const getActionInfo = () => {
    switch (action) {
      case 'confirm':
        return {
          title: 'Confirm Job Acceptance',
          description: 'Review the job details and confirm your acceptance',
          buttonText: 'Confirm Job',
          buttonColor: 'blue',
          icon: '✅',
          requiresBeforePhotos: false,
          requiresAfterPhotos: false
        };
      case 'start':
        return {
          title: 'Start Job',
          description: 'Take before photos and start the cleaning job',
          buttonText: 'Start Job',
          buttonColor: 'green',
          icon: '🚀',
          requiresBeforePhotos: true,
          requiresAfterPhotos: false
        };
      case 'finish':
        return {
          title: 'Complete Job',
          description: 'Take after photos and mark the job as completed',
          buttonText: 'Complete Job',
          buttonColor: 'purple',
          icon: '🎉',
          requiresBeforePhotos: false,
          requiresAfterPhotos: true
        };
      default:
        return {
          title: 'Job Action',
          description: 'Perform job action',
          buttonText: 'Continue',
          buttonColor: 'gray',
          icon: '📋',
          requiresBeforePhotos: false,
          requiresAfterPhotos: false
        };
    }
  };

  const actionInfo = getActionInfo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate payment status for certain actions
    if ((action === 'start' || action === 'finish') && job.payment_info) {
      if (job.payment_info.status !== 'succeeded') {
        toast.error('Payment must be completed before starting or finishing the job');
        return;
      }
    }
    
    // Validate required photos
    if (actionInfo.requiresBeforePhotos && beforePhotos.length === 0) {
      toast.error('Please upload at least one before photo to start the job');
      return;
    }

    if (actionInfo.requiresAfterPhotos && afterPhotos.length === 0) {
      toast.error('Please upload at least one after photo to complete the job');
      return;
    }

    setIsLoading(true);

    try {
      let result;
      const photos = [...beforePhotos, ...afterPhotos];

      switch (action) {
        case 'confirm':
          result = await jobWorkflowAPI.confirmJob(job.id, photos);
          break;
        case 'start':
          result = await jobWorkflowAPI.startJob(job.id, beforePhotos);
          break;
        case 'finish':
          result = await jobWorkflowAPI.finishJob(job.id, afterPhotos);
          break;
        default:
          throw new Error('Invalid action');
      }

      toast.success(result.message || `Job ${action}ed successfully!`);
      
      // Fetch fresh job data after successful action
      if (onJobUpdated) {
        try {
          const { cleaningJobsAPI } = await import('../services/api');
          const freshJob = await cleaningJobsAPI.getById(job.id);
          console.log(`✅ Fetched fresh job data after ${action}:`, freshJob.status);
          onJobUpdated(freshJob);
        } catch (fetchError) {
          console.error('Failed to fetch fresh job data:', fetchError);
          // Fallback to updating with response data
          onJobUpdated(result.job || job);
        }
      }
      
      onClose();
    } catch (error) {
      console.error(`${action} job error:`, error);
      const errorMessage = error.response?.data?.detail || error.message || `Failed to ${action} job`;
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    if (actionInfo.requiresBeforePhotos && beforePhotos.length === 0) return false;
    if (actionInfo.requiresAfterPhotos && afterPhotos.length === 0) return false;
    return true;
  };

  const handleOpenChat = () => {
    navigate(`/jobs/${job.id}/chat`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{actionInfo.icon}</span>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{actionInfo.title}</h2>
                <p className="text-sm text-gray-600">{actionInfo.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Chat Button */}
              <button
                type="button"
                onClick={handleOpenChat}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                disabled={isLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Chat</span>
              </button>
              {/* Close Button */}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isLoading}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Time-Aware Indicator Banner */}
          {(action === 'start' || action === 'finish') && (
            <TimeAwareIndicator job={job} variant="banner" />
          )}

          {/* Payment Status Warning */}
          {(action === 'start' || action === 'finish') && job.payment_info && job.payment_info.status !== 'succeeded' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="font-medium text-red-800">Payment Required</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Payment status is <strong>{job.payment_info.status}</strong>. Payment must be completed before you can proceed with this action.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Job Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Job Details</h3>
              {/* Status Badge with Icon */}
              <span className={getStatusBadgeClasses(job.status)}>
                {getStatusConfig(job.status).icon} {getStatusConfig(job.status).label}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Address:</span>
                <p className="text-gray-900">{job.property?.address || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Date & Time:</span>
                <p className="text-gray-900">
                  {job.scheduled_date} at {job.start_time}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Services:</span>
                <p className="text-gray-900">{job.services_description || 'N/A'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Final Price:</span>
                <p className="text-gray-900 font-semibold">
                  ${job.final_price || job.client_budget}
                </p>
              </div>
              {/* Payment Status in Job Details */}
              {job.payment_info && (
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <span className="font-medium text-gray-600">Payment Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    job.payment_info.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                    job.payment_info.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    job.payment_info.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {job.payment_info.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  {job.payment_info.payment_method && (
                    <span className="ml-2 text-xs text-gray-600">
                      {job.payment_info.payment_method.brand?.toUpperCase()} ••••{job.payment_info.payment_method.last4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Photo Upload Sections */}
          {actionInfo.requiresBeforePhotos && (
            <div className="space-y-4">
              <PhotoUpload
                photoType="before"
                jobId={job.id}
                onPhotosChange={setBeforePhotos}
                maxPhotos={5}
                disabled={isLoading}
              />
            </div>
          )}

          {actionInfo.requiresAfterPhotos && (
            <div className="space-y-4">
              <PhotoUpload
                photoType="after"
                jobId={job.id}
                onPhotosChange={setAfterPhotos}
                maxPhotos={5}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !canProceed()}
              className={`
                px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white
                focus:ring-2 focus:ring-offset-2 transition-colors
                ${canProceed() && !isLoading
                  ? getButtonClasses(actionInfo.buttonColor)
                  : 'bg-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </div>
              ) : (
                actionInfo.buttonText
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobWorkflowModal;