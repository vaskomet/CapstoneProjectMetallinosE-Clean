/**
 * CompletedJobsDashboard component for viewing completed jobs and their details
 * Shows job history, photos, and allows for client reviews
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { useUnifiedChat } from '../contexts/UnifiedChatContext';
import { cleaningJobsAPI } from '../services/api';
import { jobPhotosAPI } from '../services/jobLifecycleAPI';
import ReviewForm from './ReviewForm';
import ReviewList from './ReviewList';
import ReviewStats from './ReviewStats';

const CompletedJobsDashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const toast = useToast();
  const { createDirectMessage } = useUnifiedChat();
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobPhotos, setJobPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(false);
  
  // Review states
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

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

  const handleJobSelect = async (job) => {
    setSelectedJob(job);
    setShowReviewForm(false); // Reset review form when selecting new job
    fetchJobPhotos(job.id);
    checkReviewEligibility(job.id);
  };

  // Check if user can review this job
  const checkReviewEligibility = async (jobId) => {
    console.log('🔍 Checking review eligibility for job:', jobId);
    
    // Reset states
    setCanReview(false);
    setReviewEligibility(null);
    
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('❌ No access token found');
        setCanReview(false);
        setReviewEligibility({ can_review: false, reason: 'Please log in to leave a review.' });
        return;
      }
      
      const response = await fetch(`http://localhost:8000/api/reviews/can-review/${jobId}/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('❌ API returned error:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        setCanReview(false);
        setReviewEligibility({ can_review: false, reason: 'Unable to check review eligibility.' });
        return;
      }
      
      const data = await response.json();
      console.log('✅ Review eligibility response:', data);
      console.log('   can_review:', data.can_review);
      console.log('   reason:', data.reason);
      
      setCanReview(data.can_review === true);
      setReviewEligibility(data);
      
      console.log('📊 State updated - canReview:', data.can_review);
    } catch (error) {
      console.error('❌ Failed to check review eligibility:', error);
      setCanReview(false);
      setReviewEligibility({ can_review: false, reason: 'Network error. Please try again.' });
    }
  };

  // Submit review
  const handleReviewSubmit = async (reviewData) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/reviews/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reviewData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(Object.values(errorData)[0] || 'Failed to submit review');
      }

      toast.success('Review submitted successfully!');
      setShowReviewForm(false);
      setCanReview(false);
      // Refresh eligibility
      checkReviewEligibility(selectedJob.id);
    } catch (error) {
      toast.error(error.message || 'Failed to submit review');
      throw error;
    }
  };

  // Handle review response submission
  const handleResponseSubmit = async (reviewId, responseText) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/reviews/${reviewId}/response/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response_text: responseText })
      });

      if (!response.ok) {
        throw new Error('Failed to submit response');
      }

      toast.success('Response submitted successfully!');
      // Reload to show new response
      window.location.reload();
    } catch (error) {
      toast.error(error.message || 'Failed to submit response');
      throw error;
    }
  };

  // Handle starting a direct message with cleaner or client
  const handleStartMessage = async (otherUser, userType) => {
    setIsCreatingChat(true);
    try {
      const room = await createDirectMessage(otherUser.id);
      
      if (room) {
        toast.success(`Started conversation with ${otherUser.first_name} ${otherUser.last_name}`);
        // Navigate to the messages page
        navigate('/messages');
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error('Failed to start conversation. Please try again.');
    } finally {
      setIsCreatingChat(false);
    }
  };

  // Handle review flag
  const handleFlag = async (reviewId) => {
    try {
      const token = localStorage.getItem('access_token');
      const reason = prompt('Please select a reason:\n1. Inappropriate Content\n2. Harassment\n3. Spam\n4. False Information\n5. Other');
      
      const reasonMap = {
        '1': 'inappropriate',
        '2': 'harassment',
        '3': 'spam',
        '4': 'false_info',
        '5': 'other'
      };

      if (!reason || !reasonMap[reason]) {
        return;
      }

      const details = prompt('Additional details (optional):');

      const response = await fetch(`http://localhost:8000/api/reviews/${reviewId}/flag/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reasonMap[reason],
          details: details || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to flag review');
      }

      toast.success('Review flagged successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to flag review');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    return new Date(dateTimeString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const renderStarRating = (rating) => {
    if (!rating) return <span className="text-gray-400">No rating</span>;
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="text-sm text-gray-600 ml-1">({rating}/5)</span>
      </div>
    );
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
          <h1 className="text-3xl font-bold text-gray-900">
            {user?.role === 'client' ? 'Cleaning History' : 'Completed Jobs'}
          </h1>
          <p className="text-gray-600 mt-2">
            {user?.role === 'client' 
              ? 'View your property cleaning history, reviews, and cleaner details'
              : 'View your completed cleaning jobs and client feedback'
            }
          </p>
        </div>

        {/* Summary Statistics */}
        {completedJobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {user?.role === 'client' ? 'Properties Cleaned' : 'Jobs Completed'}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">{completedJobs.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {user?.role === 'client' ? 'Total Spent' : 'Total Earned'}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(
                      completedJobs.reduce((sum, job) => sum + parseFloat(job.final_price || job.client_budget || 0), 0)
                    )}
                  </p>
                </div>
              </div>
            </div>

            {user?.role === 'client' ? (
              // Client-specific stats
              <>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Properties Serviced</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {new Set(completedJobs.map(job => job.property?.id).filter(Boolean)).size}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Trusted Cleaners</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {new Set(completedJobs.map(job => job.cleaner?.id).filter(Boolean)).size}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // Cleaner-specific stats
              <>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Avg Rating</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {(() => {
                          const ratedJobs = completedJobs.filter(job => job.client_rating);
                          if (ratedJobs.length === 0) return 'N/A';
                          const avgRating = ratedJobs.reduce((sum, job) => sum + job.client_rating, 0) / ratedJobs.length;
                          return `${avgRating.toFixed(1)}/5`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Avg Duration</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {(() => {
                          const jobsWithDuration = completedJobs.filter(job => job.actual_start_time && job.actual_end_time);
                          if (jobsWithDuration.length === 0) return 'N/A';
                          const totalMinutes = jobsWithDuration.reduce((sum, job) => {
                            const start = new Date(job.actual_start_time);
                            const end = new Date(job.actual_end_time);
                            return sum + (end - start) / (1000 * 60);
                          }, 0);
                          const avgMinutes = totalMinutes / jobsWithDuration.length;
                          const hours = Math.floor(avgMinutes / 60);
                          const minutes = Math.round(avgMinutes % 60);
                          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {completedJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {user?.role === 'client' ? 'No cleaning history yet' : 'No completed jobs yet'}
            </h3>
            <p className="text-gray-500">
              {user?.role === 'client' 
                ? 'Your completed cleaning services will appear here'
                : 'Complete your first cleaning job to see it here'
              }</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Jobs List */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {completedJobs.length} {user?.role === 'client' ? 'Cleaning' : 'Completed'} {user?.role === 'client' ? 'Service' : 'Job'}{completedJobs.length !== 1 ? 's' : ''}
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
                      <div className="flex flex-col items-end space-y-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Completed
                        </span>
                        {job.client_rating && (
                          <div className="flex items-center">
                            <svg className="w-3 h-3 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-xs text-gray-600">{job.client_rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {job.property?.address || 'Address not available'}
                    </p>
                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Scheduled:</span>
                        <span className="text-gray-700">{formatDate(job.scheduled_date)}</span>
                      </div>
                      {job.actual_start_time && job.actual_end_time && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Duration:</span>
                          <span className="text-gray-700">{calculateDuration(job.actual_start_time, job.actual_end_time)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Price:</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(job.final_price || job.client_budget)}
                        </span>
                      </div>
                    </div>
                    {user?.role === 'client' && job.cleaner && (
                      <p className="text-xs text-gray-500">
                        Cleaner: {job.cleaner.first_name} {job.cleaner.last_name}
                      </p>
                    )}
                    {user?.role === 'cleaner' && job.client && (
                      <p className="text-xs text-gray-500">
                        Client: {job.client.first_name} {job.client.last_name}
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
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Property Address</h3>
                          <p className="text-gray-900">{selectedJob.property?.address || 'N/A'}</p>
                          {selectedJob.property?.city && (
                            <p className="text-sm text-gray-600">{selectedJob.property.city}, {selectedJob.property.state}</p>
                          )}
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Scheduled Date & Time</h3>
                          <p className="text-gray-900">{formatDate(selectedJob.scheduled_date)}</p>
                          <p className="text-sm text-gray-600">
                            {formatTime(selectedJob.start_time)} - {formatTime(selectedJob.end_time)}
                          </p>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Services Provided</h3>
                          <p className="text-gray-900">{selectedJob.services_description || 'N/A'}</p>
                        </div>

                        {selectedJob.notes && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Notes</h3>
                            <p className="text-gray-900 text-sm">{selectedJob.notes}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Timing and Performance */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Actual Performance</h3>
                          <div className="mt-1 space-y-1">
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">Started:</span> {formatDateTime(selectedJob.actual_start_time)}
                            </p>
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">Completed:</span> {formatDateTime(selectedJob.actual_end_time)}
                            </p>
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">Duration:</span> {calculateDuration(selectedJob.actual_start_time, selectedJob.actual_end_time)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Pricing</h3>
                          <div className="mt-1 space-y-1">
                            <p className="text-lg font-semibold text-gray-900">
                              {formatCurrency(selectedJob.final_price || selectedJob.client_budget)}
                            </p>
                            {selectedJob.discount_applied > 0 && (
                              <p className="text-sm text-green-600">
                                Discount Applied: -{formatCurrency(selectedJob.discount_applied)}
                              </p>
                            )}
                            {selectedJob.client_budget && selectedJob.final_price !== selectedJob.client_budget && (
                              <p className="text-xs text-gray-500">
                                Original Budget: {formatCurrency(selectedJob.client_budget)}
                              </p>
                            )}
                          </div>
                        </div>

                        {user?.role === 'client' && selectedJob.cleaner && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-2">Your Cleaner</h3>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {selectedJob.cleaner.first_name} {selectedJob.cleaner.last_name}
                                  </p>
                                  {selectedJob.cleaner.email && (
                                    <p className="text-sm text-gray-600">{selectedJob.cleaner.email}</p>
                                  )}
                                  {selectedJob.client_rating && (
                                    <div className="flex items-center mt-1">
                                      {renderStarRating(selectedJob.client_rating)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col space-y-2">
                                  <button 
                                    className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                                    onClick={() => navigate(`/cleaner/${selectedJob.cleaner.id}`)}
                                  >
                                    View Profile
                                  </button>
                                  <button 
                                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => handleStartMessage(selectedJob.cleaner, 'cleaner')}
                                    disabled={isCreatingChat}
                                  >
                                    {isCreatingChat ? 'Starting...' : 'Message Cleaner'}
                                  </button>
                                  <button 
                                    className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                                    onClick={() => {
                                      // TODO: Implement re-booking functionality
                                      toast.info('Re-booking feature coming soon!');
                                    }}
                                  >
                                    Book Again
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {user?.role === 'cleaner' && selectedJob.client && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-2">Client</h3>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {selectedJob.client.first_name} {selectedJob.client.last_name}
                                  </p>
                                  {selectedJob.client.email && (
                                    <p className="text-sm text-gray-600">{selectedJob.client.email}</p>
                                  )}
                                </div>
                                <div className="flex flex-col space-y-2">
                                  <button 
                                    className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                                    onClick={() => navigate(`/client/${selectedJob.client.id}`)}
                                  >
                                    View Profile
                                  </button>
                                  <button 
                                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => handleStartMessage(selectedJob.client, 'client')}
                                    disabled={isCreatingChat}
                                  >
                                    {isCreatingChat ? 'Starting...' : 'Message Client'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedJob.cleaner_confirmed_at && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Job Confirmed</h3>
                            <p className="text-sm text-gray-900">{formatDateTime(selectedJob.cleaner_confirmed_at)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Services Checklist */}
                    {selectedJob.checklist && selectedJob.checklist.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Services Completed</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.checklist.map((item, index) => (
                            <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Client Review and Rating */}
                    {(selectedJob.client_rating || selectedJob.client_review) && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">
                          {user?.role === 'client' ? 'Your Review' : 'Client Review'}
                        </h3>
                        {selectedJob.client_rating && (
                          <div className="mb-3">
                            {renderStarRating(selectedJob.client_rating)}
                          </div>
                        )}
                        {selectedJob.client_review && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-gray-900 italic">"{selectedJob.client_review}"</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* NEW REVIEW SYSTEM - Bidirectional Reviews */}
                    {selectedJob && (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {user?.role === 'client' ? '⭐ Review Your Cleaner' : '⭐ Review Your Client'}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                          {user?.role === 'client' 
                            ? '💡 Share your experience to help other clients and provide feedback.'
                            : '💡 Share your experience working with this client.'}
                        </p>
                        
                        {/* Debug info - remove after testing */}
                        <div className="text-xs text-gray-400 mb-2">
                          Debug: canReview={String(canReview)}, showForm={String(showReviewForm)}, hasEligibility={String(!!reviewEligibility)}
                        </div>
                        
                        {canReview && !showReviewForm && (
                          <button 
                            className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                            onClick={() => {
                              console.log('🖱️ Leave a Review button clicked!');
                              setShowReviewForm(true);
                            }}
                          >
                            ✍️ Leave a Review
                          </button>
                        )}
                        
                        {!canReview && reviewEligibility && (
                          <div className="bg-white rounded-md p-3 border border-gray-200">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Status:</span> {reviewEligibility.reason}
                            </p>
                          </div>
                        )}
                        
                        {!reviewEligibility && (
                          <div className="bg-white rounded-md p-3 border border-gray-200">
                            <p className="text-sm text-gray-500 animate-pulse">
                              Checking review eligibility...
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review Form Section (Collapsible) */}
                    {showReviewForm && canReview && selectedJob && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <ReviewForm
                          jobId={selectedJob.id}
                          revieweeName={
                            user?.role === 'client' 
                              ? `${selectedJob.cleaner?.first_name || ''} ${selectedJob.cleaner?.last_name || ''}`.trim()
                              : `${selectedJob.client?.first_name || ''} ${selectedJob.client?.last_name || ''}`.trim()
                          }
                          onSubmit={handleReviewSubmit}
                          onCancel={() => setShowReviewForm(false)}
                        />
                      </div>
                    )}

                    {/* Reviews Section - Show reviews for the cleaner/client */}
                    {selectedJob && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Reviews {user?.role === 'client' ? 'for this Cleaner' : 'for this Client'}
                        </h3>
                        {user?.role === 'client' && selectedJob.cleaner && (
                          <>
                            <ReviewStats userId={selectedJob.cleaner.id} />
                            <ReviewList
                              revieweeId={selectedJob.cleaner.id}
                              currentUser={user}
                              onResponseSubmit={handleResponseSubmit}
                              onFlag={handleFlag}
                            />
                          </>
                        )}
                        {user?.role === 'cleaner' && selectedJob.client && (
                          <>
                            <ReviewStats userId={selectedJob.client.id} />
                            <ReviewList
                              revieweeId={selectedJob.client.id}
                              currentUser={user}
                              onResponseSubmit={handleResponseSubmit}
                              onFlag={handleFlag}
                            />
                          </>
                        )}
                      </div>
                    )}

                    {/* Eco Impact Metrics */}
                    {selectedJob.eco_impact_metrics && Object.keys(selectedJob.eco_impact_metrics).length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Environmental Impact</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {Object.entries(selectedJob.eco_impact_metrics).map(([key, value]) => (
                            <div key={key} className="text-center p-3 bg-green-50 rounded-lg">
                              <p className="text-lg font-semibold text-green-700">{value}</p>
                              <p className="text-xs text-green-600 capitalize">{key.replace(/_/g, ' ')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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