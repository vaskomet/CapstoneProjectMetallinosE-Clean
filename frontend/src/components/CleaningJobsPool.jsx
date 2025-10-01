import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import { useUser } from '../contexts/UserContext';
import { cleaningJobsAPI } from '../services/api';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * CleaningJobsPool Component
 * 
 * Fetches client jobs or cleaner assignments, uses FullCalendar.js for scheduling, follows PascalCase per DEVELOPMENT_STANDARDS.md.
 * API calls use Authorization header with Bearer token as in auth integrations.
 * 
 * Features:
 * - Calendar view with FullCalendar.js for job scheduling
 * - Role-based job management (client bookings vs cleaner assignments)
 * - Job creation modal with form validation
 * - Status updates for cleaners
 * - Toast notifications for user feedback
 * 
 * Test with token from login, check calendar rendering, verify status update for cleaners.
 */
const CleaningJobsPool = () => {
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [formData, setFormData] = useState({
    property: '',
    scheduled_date: '',
    start_time: '',
    end_time: '',
    services_requested: [],
    special_instructions: '',
    estimated_duration: 60
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  // Fetch jobs from API
  const fetchJobs = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await cleaningJobsAPI.getAll();
      const jobsData = response.data.results || response.data || [];
      setJobs(jobsData);
    } catch (err) {
      setError('Failed to fetch jobs. Please try again later.');
      toast.error('Failed to load jobs');
      console.error('Fetch jobs error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load jobs on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
    }
  }, [isAuthenticated]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle services selection
  const handleServicesChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      services_requested: checked
        ? [...prev.services_requested, value]
        : prev.services_requested.filter(service => service !== value)
    }));
  };

  // Handle job creation
  const handleCreateJob = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await cleaningJobsAPI.create(formData);
      toast.success('Job created successfully!');
      setShowCreateModal(false);
      setFormData({
        property: '',
        scheduled_date: '',
        start_time: '',
        end_time: '',
        services_requested: [],
        special_instructions: '',
        estimated_duration: 60
      });
      fetchJobs(); // Refresh jobs list
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to create job';
      setError(errorMessage);
      toast.error('Error: ' + errorMessage);
      console.error('Create job error:', err);
    }
  };

  // Handle status update (for cleaners)
  const handleStatusUpdate = async (jobId, newStatus) => {
    try {
      await cleaningJobsAPI.updateStatus(jobId, newStatus);
      toast.success(`Job status updated to ${newStatus}`);
      fetchJobs(); // Refresh jobs list
      setShowJobModal(false);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to update job status';
      toast.error('Error: ' + errorMessage);
      console.error('Update status error:', err);
    }
  };

  // Handle event click in calendar
  const handleEventClick = (clickInfo) => {
    setSelectedJob(clickInfo.event.extendedProps);
    setShowJobModal(true);
  };

  // Convert jobs to calendar events
  const calendarEvents = jobs.map(job => ({
    id: job.id,
    title: `${job.status} - ${job.service_type?.name || 'Cleaning'}`,
    start: job.scheduled_date,
    end: job.scheduled_date,
    backgroundColor: getStatusColor(job.status),
    borderColor: getStatusColor(job.status),
    extendedProps: job
  }));

  // Get color based on job status
  function getStatusColor(status) {
    switch (status) {
      case 'pending': return '#f59e0b'; // yellow
      case 'confirmed': return '#3b82f6'; // blue
      case 'in_progress': return '#8b5cf6'; // purple
      case 'completed': return '#10b981'; // green
      case 'cancelled': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {user?.role === 'cleaner' ? 'My Assignments' : 'My Bookings'}
              </h1>
              <p className="mt-1 text-gray-600">
                {user?.role === 'cleaner' 
                  ? 'Manage your assigned cleaning jobs and update status'
                  : 'Schedule and manage your cleaning appointments'
                }
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              {user?.role === 'client' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Book Cleaning
                </button>
              )}
              
              <button
                onClick={fetchJobs}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading jobs...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Calendar */}
        {!loading && !error && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              eventClick={handleEventClick}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
              }}
              height="auto"
              eventDisplay="block"
              dayMaxEvents={3}
              moreLinkClick="popover"
            />
          </div>
        )}
      </div>

      {/* Job Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Book Cleaning Service</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateJob} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    name="scheduled_date"
                    value={formData.scheduled_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      name="start_time"
                      value={formData.start_time}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      name="end_time"
                      value={formData.end_time}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Services Requested
                  </label>
                  <div className="space-y-2">
                    {['Basic Cleaning', 'Deep Cleaning', 'Window Cleaning', 'Carpet Cleaning', 'Kitchen Cleaning', 'Bathroom Cleaning'].map(service => (
                      <label key={service} className="flex items-center">
                        <input
                          type="checkbox"
                          value={service}
                          checked={formData.services_requested.includes(service)}
                          onChange={handleServicesChange}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{service}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="estimated_duration"
                    value={formData.estimated_duration}
                    onChange={handleInputChange}
                    min="30"
                    max="480"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Instructions
                  </label>
                  <textarea
                    name="special_instructions"
                    value={formData.special_instructions}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special requirements or instructions..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    Create Job
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {showJobModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Job Details</h2>
                <button
                  onClick={() => setShowJobModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedJob.status === 'completed' ? 'bg-green-100 text-green-800' :
                    selectedJob.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    selectedJob.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedJob.status}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Date:</span>
                  <span className="ml-2">{selectedJob.scheduled_date}</span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Duration:</span>
                  <span className="ml-2">{selectedJob.estimated_duration} minutes</span>
                </div>
                
                {selectedJob.special_instructions && (
                  <div>
                    <span className="font-medium text-gray-700">Instructions:</span>
                    <p className="mt-1 text-gray-600">{selectedJob.special_instructions}</p>
                  </div>
                )}
              </div>

              {/* Status Update Buttons for Cleaners */}
              {user?.role === 'cleaner' && selectedJob.status !== 'completed' && selectedJob.status !== 'cancelled' && (
                <div className="mt-6 space-y-2">
                  <h3 className="font-medium text-gray-700">Update Status:</h3>
                  <div className="flex gap-2">
                    {selectedJob.status === 'confirmed' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedJob.id, 'in_progress')}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Start Job
                      </button>
                    )}
                    {selectedJob.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedJob.id, 'completed')}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Complete Job
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningJobsPool;