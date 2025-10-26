import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatRoom from '../components/chat/ChatRoom';
import { cleaningJobsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * ChatPage Component
 * 
 * Standalone page for job-specific chat communication
 * Loads job details and renders chat interface
 */
const ChatPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await cleaningJobsAPI.getById(jobId);
        setJob(response);
      } catch (error) {
        console.error('Failed to fetch job:', error);
        toast.error('Failed to load job details');
        navigate('/jobs');
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId) {
      fetchJob();
    }
  }, [jobId, navigate, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Job not found
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/jobs')}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Jobs
        </button>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Job Chat
          </h1>
          <div className="text-gray-600">
            <p className="font-medium">Job #{job.id} - {job.title}</p>
            <p className="text-sm">{job.property?.address || 'No address'}</p>
            <p className="text-sm mt-1">
              Status: <span className="font-medium capitalize">{job.status?.replace('_', ' ')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Chat Room */}
      <div className="bg-white rounded-lg shadow">
        <ChatRoom jobId={jobId} className="h-[calc(100vh-280px)]" />
      </div>
    </div>
  );
};

export default ChatPage;
