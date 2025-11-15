/**
 * Job Lifecycle API Service
 *
 * Specialized API service for managing job workflow, photo uploads, and lifecycle
 * operations in the E-Cleaner platform. Handles complex multipart form data for
 * photo uploads and workflow state transitions.
 *
 * @module jobLifecycleAPI
 *
 * @features
 * - Job photo management (upload, view, delete)
 * - Workflow state transitions (confirm, start, finish jobs)
 * - Job status checking and validation
 * - Job-specific notifications
 * - Multipart form data handling for photo uploads
 * - Enhanced error handling with user feedback
 *
 * @dependencies
 * - api: Base API service from './api'
 * - apiCall: Enhanced API call wrapper
 * - FormData: Browser API for multipart form data
 *
 * @example
 * ```javascript
 * import { jobPhotosAPI, jobWorkflowAPI } from './services/jobLifecycleAPI';
 *
 * // Upload job photos
 * const photos = await jobPhotosAPI.create({
 *   job: 123,
 *   photo_type: 'before',
 *   image: imageFile,
 *   description: 'Kitchen before cleaning'
 * });
 *
 * // Confirm and start a job
 * await jobWorkflowAPI.confirmJob(123, [photoFile]);
 * await jobWorkflowAPI.startJob(123, [photoFile]);
 * ```
 */

import api from './api';
import { apiCall } from './api';

/**
 * Job Photos API module
 *
 * Handles photo uploads and management for job documentation throughout the cleaning process.
 *
 * @namespace jobPhotosAPI
 */
export const jobPhotosAPI = {
  /**
   * Get all photos for a specific job or all photos if no job specified
   * @async
   * @function getAll
   * @param {number} [jobId] - Optional job ID to filter photos
   * @returns {Promise<Array>} Array of photo objects
   */
  getAll: async (jobId) => {
    return apiCall(
      async () => {
        const params = jobId ? { job: jobId } : {};
        const response = await api.get('/lifecycle/photos/', { params });
        return response.data;
      },
      {
        loadingKey: `photos_${jobId || 'all'}`,
        showSuccess: false
      }
    );
  },

  /**
   * Upload a new photo for job documentation
   * @async
   * @function create
   * @param {Object} photoData - Photo upload data
   * @param {number} photoData.job - Job ID
   * @param {string} photoData.photo_type - Type of photo (before/after/progress)
   * @param {File} photoData.image - Image file to upload
   * @param {string} [photoData.description] - Optional photo description
   * @returns {Promise<Object>} Created photo object
   */
  create: async (photoData) => {
    return apiCall(
      async () => {
        const formData = new FormData();
        formData.append('job', photoData.job);
        formData.append('photo_type', photoData.photo_type);
        formData.append('image', photoData.image);
        if (photoData.description) {
          formData.append('description', photoData.description);
        }

        const response = await api.post('/lifecycle/photos/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      },
      {
        loadingKey: `photo_upload_${photoData.job}`,
        successMessage: `${photoData.photo_type} photo uploaded successfully!`,
        showSuccess: true
      }
    );
  },

  /**
   * Delete a job photo
   * @async
   * @function delete
   * @param {number} photoId - Photo ID to delete
   * @returns {Promise<Object>} Deletion response
   */
  delete: async (photoId) => {
    return apiCall(
      async () => {
        const response = await api.delete(`/lifecycle/photos/${photoId}/`);
        return response.data;
      },
      {
        loadingKey: `photo_delete_${photoId}`,
        successMessage: 'Photo deleted successfully!',
        showSuccess: true
      }
    );
  },
};

/**
 * Job Workflow API module
 *
 * Handles job state transitions and workflow actions throughout the cleaning process.
 *
 * @namespace jobWorkflowAPI
 */
export const jobWorkflowAPI = {
  /**
   * Confirm a job bid and transition to confirmed state
   * @async
   * @function confirmJob
   * @param {number} jobId - Job ID to confirm
   * @param {Array<File>} [photos=[]] - Optional photos to upload with confirmation
   * @returns {Promise<Object>} Job confirmation response
   */
  confirmJob: async (jobId, photos = []) => {
    return apiCall(
      async () => {
        const formData = new FormData();
        formData.append('action_type', 'confirm_bid');

        // Append photos directly as files
        photos.forEach((photo, index) => {
          formData.append(`photo_${index}`, photo.image);
          formData.append(`photo_${index}_type`, photo.photo_type);
          if (photo.description) {
            formData.append(`photo_${index}_description`, photo.description);
          }
        });

        const response = await api.post(`/lifecycle/jobs/${jobId}/workflow/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      },
      {
        loadingKey: `confirm_job_${jobId}`,
        successMessage: 'Job confirmed successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Start a confirmed job and begin the cleaning process
   * @async
   * @function startJob
   * @param {number} jobId - Job ID to start
   * @param {Array<File>} [photos=[]] - Optional photos to upload when starting
   * @returns {Promise<Object>} Job start response
   */
  startJob: async (jobId, photos = []) => {
    return apiCall(
      async () => {
        const formData = new FormData();
        formData.append('action_type', 'start_job');

        // Append photos directly as files
        photos.forEach((photo, index) => {
          formData.append(`photo_${index}`, photo.image);
          formData.append(`photo_${index}_type`, photo.photo_type);
          if (photo.description) {
            formData.append(`photo_${index}_description`, photo.description);
          }
        });

        const response = await api.post(`/lifecycle/jobs/${jobId}/workflow/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      },
      {
        loadingKey: `start_job_${jobId}`,
        successMessage: 'Job started successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Complete a job and mark it as finished
   * @async
   * @function finishJob
   * @param {number} jobId - Job ID to finish
   * @param {Array<File>} [photos=[]] - Optional completion photos
   * @returns {Promise<Object>} Job completion response
   */
  finishJob: async (jobId, photos = []) => {
    return apiCall(
      async () => {
        const formData = new FormData();
        formData.append('action_type', 'finish_job');

        // Append photos directly as files
        photos.forEach((photo, index) => {
          formData.append(`photo_${index}`, photo.image);
          formData.append(`photo_${index}_type`, photo.photo_type);
          if (photo.description) {
            formData.append(`photo_${index}_description`, photo.description);
          }
        });

        const response = await api.post(`/lifecycle/jobs/${jobId}/workflow/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      },
      {
        loadingKey: `finish_job_${jobId}`,
        successMessage: 'Job completed successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Accept job completion after reviewing cleaner's work
   * @async
   * @function acceptCompletion
   * @param {number} jobId - Job ID to accept
   * @param {string} [notes=''] - Optional notes about acceptance
   * @returns {Promise<Object>} Job acceptance response
   */
  acceptCompletion: async (jobId, notes = '') => {
    return apiCall(
      async () => {
        const formData = new FormData();
        formData.append('action_type', 'accept_completion');
        if (notes) {
          formData.append('notes', notes);
        }

        const response = await api.post(`/lifecycle/jobs/${jobId}/workflow/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      },
      {
        loadingKey: `accept_completion_${jobId}`,
        successMessage: 'Job completion accepted! You can now leave a review.',
        showSuccess: true
      }
    );
  },

  /**
   * Reject job completion and request additional work
   * @async
   * @function rejectCompletion
   * @param {number} jobId - Job ID to reject
   * @param {string} notes - Required notes explaining what needs to be fixed
   * @returns {Promise<Object>} Job rejection response
   */
  rejectCompletion: async (jobId, notes) => {
    return apiCall(
      async () => {
        if (!notes || notes.trim().length < 10) {
          throw new Error('Please provide a detailed reason for rejecting the work (at least 10 characters).');
        }

        const formData = new FormData();
        formData.append('action_type', 'reject_completion');
        formData.append('notes', notes);

        const response = await api.post(`/lifecycle/jobs/${jobId}/workflow/`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      },
      {
        loadingKey: `reject_completion_${jobId}`,
        successMessage: 'Work rejected. The cleaner has been notified to make corrections.',
        showSuccess: true
      }
    );
  },

  /**
   * Check the current status of a job
   * @async
   * @function checkStatus
   * @param {number} jobId - Job ID to check
   * @returns {Promise<Object>} Job status information
   */
  checkStatus: async (jobId) => {
    return apiCall(
      async () => {
        const response = await api.get(`/lifecycle/jobs/${jobId}/status/`);
        return response.data;
      },
      {
        loadingKey: `status_check_${jobId}`,
        showSuccess: false
      }
    );
  },
};

/**
 * Job Notifications API module - DEPRECATED
 *
 * ⚠️ This module has been consolidated with the generic notifications system.
 * Use the main notifications API instead: `/api/notifications/`
 *
 * The job-specific notifications endpoint `/lifecycle/notifications/` has been removed.
 * All notifications (jobs, chat, payments, system) now use the unified endpoint.
 *
 * Migration date: November 14, 2025
 * See: NOTIFICATION_SYSTEM_DUPLICATION_ANALYSIS.md
 *
 * @deprecated Use notifications API at `/api/notifications/` instead
 */
// REMOVED - Consolidated with generic notifications system
// export const jobNotificationsAPI = {
//   getAll: async () => api.get('/api/notifications/'),
//   markAsRead: async (notificationId) => api.patch(`/api/notifications/${notificationId}/`, { is_read: true })
// };
