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
 * Job Notifications API module
 *
 * Handles job-specific notifications and communication.
 *
 * @namespace jobNotificationsAPI
 */
export const jobNotificationsAPI = {
  /**
   * Get all job-related notifications
   * @async
   * @function getAll
   * @returns {Promise<Array>} Array of notification objects
   */
  getAll: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/lifecycle/notifications/');
        return response.data;
      },
      {
        loadingKey: 'notifications_list',
        showSuccess: false
      }
    );
  },

  /**
   * Mark a specific notification as read
   * @async
   * @function markAsRead
   * @param {number} notificationId - Notification ID to mark as read
   * @returns {Promise<Object>} Notification update response
   */
  markAsRead: async (notificationId) => {
    return apiCall(
      async () => {
        const response = await api.patch(`/lifecycle/notifications/${notificationId}/`, {
          is_read: true
        });
        return response.data;
      },
      {
        loadingKey: `notification_read_${notificationId}`,
        successMessage: 'Notification marked as read',
        showSuccess: false
      }
    );
  },
};