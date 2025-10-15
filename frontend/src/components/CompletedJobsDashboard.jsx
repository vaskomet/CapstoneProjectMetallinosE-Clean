/**
 * CompletedJobsDashboard component for viewing completed jobs and their details
 * Shows job history, photos, and allows for client reviews
 */

import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { cleaningJobsAPI } from '../services/api';
import { jobPhotosAPI } from '../services/jobLifecycleAPI';

const CompletedJobsDashboard = () => {
  const { user } = useUser();
  const toast = useToast();
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobPhotos, setJobPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(false);

  useEffect(() => {
    fetchCompletedJobs();
  }, []);

  const fetchCompletedJobs = async () => {
    try {
      setLoading(true);
      const response = await cleaningJobsAPI.getAll({ status: 'completed' });
      const jobs = response.results || response || [];
      setCompletedJobs(jobs);
    } catch (error) {
      console.error('Failed to fetch completed jobs:', error);
      toast.error('Failed to load completed jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobPhotos = async (jobId) => {
    try {
      setPhotosLoading(true);
      const response = await jobPhotosAPI.getAll(jobId);
      const photos = response.results || response || [];
      setJobPhotos(photos);
    } catch (error) {
      console.error('Failed to fetch job photos:', error);
      toast.error('Failed to load job photos');
      setJobPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  };

  const handleJobSelect = (job) => {
    setSelectedJob(job);
    fetchJobPhotos(job.id);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const groupPhotosByType = (photos) => {
    return photos.reduce((acc, photo) => {
      if (!acc[photo.photo_type]) {
        acc[photo.photo_type] = [];
      }
      acc[photo.photo_type].push(photo);
      return acc;
    }, {});
  };

  const getPhotoTypeTitle = (type) => {
    const titles = {
      before: 'Before Photos',
      after: 'After Photos',
      progress: 'Progress Photos'
    };
    return titles[type] || 'Photos';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-300 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-300 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Completed Jobs</h1>
          <p className="text-gray-600 mt-2">
            View your completed cleaning jobs and their documentation
          </p>
        </div>

        {completedJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No completed jobs yet</h3>
            <p className="text-gray-500">
              {user?.role === 'cleaner' 
                ? 'Complete your first cleaning job to see it here'
                : 'Your completed jobs will appear here'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Jobs List */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {completedJobs.length} Completed Job{completedJobs.length !== 1 ? 's' : ''}
              </h2>
              <div className="space-y-3">
                {completedJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => handleJobSelect(job)}
                    className={`
                      p-4 rounded-lg border cursor-pointer transition-all duration-200
                      ${selectedJob?.id === job.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">
                        Job #{job.id}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Completed
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {job.property?.address || 'Address not available'}
                    </p>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{formatDate(job.scheduled_date)}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(job.final_price || job.client_budget)}
                      </span>
                    </div>
                    {user?.role === 'client' && job.cleaner && (
                      <p className="text-xs text-gray-500 mt-1">
                        Cleaner: {job.cleaner.first_name} {job.cleaner.last_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Job Details */}
            <div className="lg:col-span-2">
              {selectedJob ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Job #{selectedJob.id} Details
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Property Address</h3>
                          <p className="text-gray-900">{selectedJob.property?.address || 'N/A'}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Service Date</h3>
                          <p className="text-gray-900">{formatDate(selectedJob.scheduled_date)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Services Provided</h3>
                          <p className="text-gray-900">{selectedJob.services_description || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Final Price</h3>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(selectedJob.final_price || selectedJob.client_budget)}
                          </p>
                        </div>
                        {user?.role === 'client' && selectedJob.cleaner && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Cleaner</h3>
                            <p className="text-gray-900">
                              {selectedJob.cleaner.first_name} {selectedJob.cleaner.last_name}
                            </p>
                          </div>
                        )}
                        {selectedJob.checklist && selectedJob.checklist.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Services Completed</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedJob.checklist.map((item, index) => (
                                <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                  ✓ {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Photos Section */}
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Job Documentation</h3>
                    
                    {photosLoading ? (
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-32 bg-gray-300 rounded"></div>
                          ))}
                        </div>
                      </div>
                    ) : jobPhotos.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-500">No photos available for this job</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(groupPhotosByType(jobPhotos)).map(([type, photos]) => (
                          <div key={type}>
                            <h4 className="text-md font-medium text-gray-800 mb-3">
                              {getPhotoTypeTitle(type)} ({photos.length})
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {photos.map((photo) => (
                                <div key={photo.id} className="group relative">
                                  <img
                                    src={photo.image}
                                    alt={photo.description || `${type} photo`}
                                    className="w-full h-32 object-cover rounded-lg border border-gray-200 group-hover:shadow-md transition-shadow"
                                  />
                                  {photo.description && (
                                    <div className="absolute inset-0 bg-black bg-opacity-75 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center p-2">
                                      <p className="text-white text-xs text-center">{photo.description}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">Select a completed job to view details and photos</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletedJobsDashboard;