/**
 * Job Lifecycle API service for enhanced workflow management
 * Handles photo uploads, workflow actions, and job completion
 */

import api from './api';
import { apiCall } from './api';

// Job Photos API
export const jobPhotosAPI = {
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

// Job Workflow API
export const jobWorkflowAPI = {
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

// Job Notifications API
export const jobNotificationsAPI = {
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

export default {
  jobPhotosAPI,
  jobWorkflowAPI,
  jobNotificationsAPI,
};