import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import { useUser } from '../contexts/UserContext';
import { cleaningJobsAPI, propertiesAPI, jobBidsAPI } from '../services/api';
import LocationFilter from './LocationFilter';
import JobWorkflowModal from './JobWorkflowModal';
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
  const [properties, setProperties] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
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
    services_description: '',
    client_budget: '',
    checklist: [],
    notes: '',
    estimated_duration: 60
  });
  
  // Bidding related states
  const [bids, setBids] = useState([]);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidFormData, setBidFormData] = useState({
    bid_amount: '',
    estimated_duration: 60,
    message: ''
  });

  // Location filter state (for cleaners)
  const [locationFilter, setLocationFilter] = useState({
    type: 'all',
    areaId: '',
    distance: '5'
  });

  // Job workflow modal states
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowAction, setWorkflowAction] = useState(null); // 'confirm', 'start', 'finish'

  // Ref to prevent multiple simultaneous fetch calls
  const fetchingRef = useRef(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  // Fetch jobs from API
  const fetchJobs = async () => {
    if (fetchingRef.current) return; // Prevent multiple simultaneous calls
    
    fetchingRef.current = true;
    setLoading(true);
    setError('');

    try {
      // Build query parameters for cleaners based on location filter
      const params = {};
      if (user?.role === 'cleaner' && locationFilter.type !== 'all') {
        if (locationFilter.type === 'myAreas' && locationFilter.areaId) {
          params.service_area_id = locationFilter.areaId;
        } else if (locationFilter.type === 'distance') {
          params.distance_km = locationFilter.distance;
        }
      }

      const response = await cleaningJobsAPI.getAll(params);
      const jobsData = response.results || response || [];
      setJobs(jobsData);
    } catch (err) {
      setError('Failed to fetch jobs. Please try again later.');
      toast.error('Failed to load jobs');
      console.error('Fetch jobs error:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // Fetch user properties (for clients only)
  const fetchProperties = async () => {
    if (user?.role !== 'client') return;
    
    try {
      const response = await propertiesAPI.getAll();
      const propertiesData = response.results || response || [];
      setProperties(propertiesData);
    } catch (err) {
      console.error('Fetch properties error:', err);
      toast.error('Failed to load properties');
    }
  };

  // Fetch available service types
  const fetchServiceTypes = async () => {
    try {
      const response = await propertiesAPI.getServiceTypes();
      const serviceTypesData = response.results || response || [];
      setServiceTypes(serviceTypesData);
    } catch (err) {
      console.error('Fetch service types error:', err);
      toast.error('Failed to load service types');
    }
  };

  // Load jobs, properties and bids on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
      fetchBids();
      fetchProperties();
    }
  }, [isAuthenticated, user?.role]);

  // Refetch jobs when location filter changes (for cleaners only)
  useEffect(() => {
    if (isAuthenticated && user?.role === 'cleaner') {
      fetchJobs();
    }
  }, [locationFilter]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle bid form input changes
  const handleBidInputChange = (e) => {
    const { name, value } = e.target;
    setBidFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle location filter changes
  const handleLocationFilterChange = (filter) => {
    setLocationFilter(filter);
  };

  // Fetch bids for jobs
  const fetchBids = async () => {
    try {
      const response = await jobBidsAPI.getAll();
      const bidsData = response.results || response || [];
      setBids(bidsData);
    } catch (err) {
      console.error('Fetch bids error:', err);
    }
  };

  // Handle checklist items
  const handleChecklistChange = (e) => {
    const { value, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      checklist: checked
        ? [...prev.checklist, value]
        : prev.checklist.filter(item => item !== value)
    }));
  };

  // Handle job creation
  const handleCreateJob = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.property) {
      toast.error('Please select a property');
      return;
    }
    
    if (!formData.scheduled_date || !formData.start_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.services_description) {
      toast.error('Please describe the services needed');
      return;
    }
    
    if (!formData.client_budget) {
      toast.error('Please set your budget');
      return;
    }

    setError('');

    try {
      // Convert property ID to number
      const jobData = {
        ...formData,
        property: parseInt(formData.property)
      };
      
      console.log('Sending job data:', jobData);
      await cleaningJobsAPI.create(jobData);
      toast.success('Job created successfully!');
      setShowCreateModal(false);
      setFormData({
        property: '',
        scheduled_date: '',
        start_time: '',
        end_time: '',
        services_description: '',
        client_budget: '',
        checklist: [],
        notes: '',
        estimated_duration: 60
      });
      fetchJobs(); // Refresh jobs list
    } catch (err) {
      console.error('Create job error:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.detail || 'Failed to create job';
      setError(errorMessage);
      toast.error('Error: ' + errorMessage);
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

  // Handle workflow actions with photo uploads
  const handleWorkflowAction = (action) => {
    setWorkflowAction(action);
    setShowWorkflowModal(true);
  };

  const handleJobUpdated = (updatedJob) => {
    // Update the job in the jobs list
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === updatedJob.id ? updatedJob : job
      )
    );
    
    // Update selectedJob if it's the same job
    if (selectedJob && selectedJob.id === updatedJob.id) {
      setSelectedJob(updatedJob);
    }
    
    // Close workflow modal
    setShowWorkflowModal(false);
    setWorkflowAction(null);
  };

  const closeWorkflowModal = () => {
    setShowWorkflowModal(false);
    setWorkflowAction(null);
  };

  // Handle bid submission (for cleaners)
  const handleSubmitBid = async (e, jobId) => {
    e.preventDefault();
    
    if (!bidFormData.bid_amount) {
      toast.error('Please enter your bid amount');
      return;
    }
    
    if (!bidFormData.message) {
      toast.error('Please add a message with your bid');
      return;
    }

    try {
      const bidData = {
        ...bidFormData,
        job: jobId,
        bid_amount: parseFloat(bidFormData.bid_amount)
      };
      
      await jobBidsAPI.create(bidData);
      toast.success('Bid submitted successfully!');
      setShowBidModal(false);
      setBidFormData({
        bid_amount: '',
        estimated_duration: 60,
        message: ''
      });
      
      // Refresh all data
      const [jobsResponse, bidsResponse] = await Promise.all([
        cleaningJobsAPI.getAll(),
        jobBidsAPI.getAll()
      ]);
      
      const jobsData = jobsResponse.results || jobsResponse || [];
      const bidsData = bidsResponse.results || bidsResponse || [];
      
      setJobs(jobsData);
      setBids(bidsData);
      
      // Update the selected job with the refreshed data
      const updatedJob = jobsData.find(job => job.id === jobId);
      if (updatedJob) {
        setSelectedJob(updatedJob);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to submit bid';
      toast.error('Error: ' + errorMessage);
      console.error('Submit bid error:', err);
    }
  };

  // Handle bid acceptance (for clients)
  const handleAcceptBid = async (bidId) => {
    try {
      await jobBidsAPI.acceptBid(bidId);
      toast.success('Bid accepted successfully!');
      
      // Refresh all data
      const [jobsResponse, bidsResponse] = await Promise.all([
        cleaningJobsAPI.getAll(),
        jobBidsAPI.getAll()
      ]);
      
      const jobsData = jobsResponse.results || jobsResponse || [];
      const bidsData = bidsResponse.results || bidsResponse || [];
      
      setJobs(jobsData);
      setBids(bidsData);
      
      // Update the selected job with the refreshed data
      if (selectedJob) {
        const updatedJob = jobsData.find(job => job.id === selectedJob.id);
        if (updatedJob) {
          setSelectedJob(updatedJob);
        }
      }
      
      setShowJobModal(false);
      
      // Trigger workflow modal for confirmation with photos
      setTimeout(() => {
        handleWorkflowAction('confirm');
      }, 500);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to accept bid';
      toast.error('Error: ' + errorMessage);
      console.error('Accept bid error:', err);
    }
  };

  // Handle bid withdrawal (for cleaners)
  const handleWithdrawBid = async (bidId) => {
    try {
      await jobBidsAPI.withdrawBid(bidId);
      toast.success('Bid withdrawn successfully!');
      
      // Refresh all data
      const [jobsResponse, bidsResponse] = await Promise.all([
        cleaningJobsAPI.getAll(),
        jobBidsAPI.getAll()
      ]);
      
      const jobsData = jobsResponse.results || jobsResponse || [];
      const bidsData = bidsResponse.results || bidsResponse || [];
      
      setJobs(jobsData);
      setBids(bidsData);
      
      // Update the selected job with the refreshed data
      if (selectedJob) {
        const updatedJob = jobsData.find(job => job.id === selectedJob.id);
        if (updatedJob) {
          setSelectedJob(updatedJob);
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to withdraw bid';
      toast.error('Error: ' + errorMessage);
      console.error('Withdraw bid error:', err);
    }
  };

  // Handle event click in calendar
  const handleEventClick = (clickInfo) => {
    setSelectedJob(clickInfo.event.extendedProps);
    setShowJobModal(true);
  };

  // Convert jobs to calendar events
  const calendarEvents = jobs.map(job => {
    // Get bids for this job
    const jobBids = bids.filter(bid => bid.job === job.id);
    const bidInfo = jobBids.length > 0 ? ` (${jobBids.length} bids)` : '';
    
    return {
      id: job.id,
      title: `${job.status} - ${job.property?.address || job.property?.address_line1 || 'Property'} - $${job.client_budget}${bidInfo}`,
      start: job.scheduled_date,
      end: job.scheduled_date,
      backgroundColor: getStatusColor(job.status),
      borderColor: getStatusColor(job.status),
      extendedProps: { ...job, bids: jobBids }
    };
  });

  // Get color based on job status
  function getStatusColor(status) {
    switch (status) {
      case 'open_for_bids': return '#f59e0b'; // yellow
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
                <>
                  <button
                    onClick={() => {
                      if (properties.length === 0) {
                        toast.warning('Please add a property first before booking a cleaning service');
                        return;
                      }
                      setShowCreateModal(true);
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      properties.length === 0
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                    title={properties.length === 0 ? 'Add a property first' : 'Book a cleaning service'}
                  >
                    Book Cleaning
                  </button>
                  {properties.length === 0 && (
                    <button
                      onClick={() => window.location.href = '/properties'}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Add Property
                    </button>
                  )}
                </>
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
        {/* Location Filter - For Cleaners Only */}
        {user?.role === 'cleaner' && (
          <div className="mb-6">
            <LocationFilter
              onFilterChange={handleLocationFilterChange}
              currentFilter={locationFilter}
            />
          </div>
        )}

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
                {/* Property Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Property *
                  </label>
                  <select
                    name="property"
                    value={formData.property}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Choose a property...</option>
                    {properties.map(property => (
                      <option key={property.id} value={property.id}>
                        {property.address_line1}, {property.city} ({property.property_type})
                      </option>
                    ))}
                  </select>
                  {properties.length === 0 && (
                    <p className="mt-1 text-sm text-amber-600">
                      No properties found. <span 
                        className="text-blue-600 cursor-pointer hover:underline"
                        onClick={() => {
                          setShowCreateModal(false);
                          window.location.href = '/properties';
                        }}
                      >
                        Add a property first
                      </span>
                    </p>
                  )}
                </div>

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Services Description
                  </label>
                  <textarea
                    name="services_description"
                    value={formData.services_description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the cleaning services you need..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Budget ($)
                  </label>
                  <input
                    type="number"
                    name="client_budget"
                    value={formData.client_budget}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your budget for this job"
                    required
                  />
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
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special requirements or instructions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cleaning Checklist
                  </label>
                  <div className="space-y-2">
                    {['kitchen', 'bathroom', 'living room', 'bedrooms', 'windows', 'floors', 'appliances', 'dusting'].map(item => (
                      <label key={item} className="flex items-center">
                        <input
                          type="checkbox"
                          value={item}
                          checked={formData.checklist.includes(item)}
                          onChange={handleChecklistChange}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">{item}</span>
                      </label>
                    ))}
                  </div>
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
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

              <div className="space-y-4">
                <div>
                  <span className="font-medium text-gray-700">Property:</span>
                  <span className="ml-2">
                    {selectedJob.property?.address || selectedJob.property?.address_line1 || 'Unknown Address'}
                    {selectedJob.property?.city && `, ${selectedJob.property.city}`}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedJob.status === 'completed' ? 'bg-green-100 text-green-800' :
                    selectedJob.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    selectedJob.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                    selectedJob.status === 'open_for_bids' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedJob.status?.replace('_', ' ')}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Date:</span>
                  <span className="ml-2">{selectedJob.scheduled_date}</span>
                </div>
                
                {selectedJob.start_time && (
                  <div>
                    <span className="font-medium text-gray-700">Start Time:</span>
                    <span className="ml-2">{selectedJob.start_time}</span>
                  </div>
                )}
                
                {/* Show timing information for cleaners */}
                {user?.role === 'cleaner' && selectedJob.status === 'confirmed' && selectedJob.cleaner?.id === user.id && selectedJob.scheduled_date && selectedJob.start_time && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-800">
                      <div className="font-medium mb-1">Job Start Window:</div>
                      <div>• Can start: 30 minutes before scheduled time</div>
                      <div>• Must start: Within 2 hours of scheduled time</div>
                      {(() => {
                        const scheduledDateTime = new Date(`${selectedJob.scheduled_date}T${selectedJob.start_time}`);
                        const now = new Date();
                        const earliestStart = new Date(scheduledDateTime.getTime() - 30 * 60 * 1000);
                        const latestStart = new Date(scheduledDateTime.getTime() + 2 * 60 * 60 * 1000);
                        
                        if (now < earliestStart) {
                          const minutesUntil = Math.ceil((earliestStart - now) / (1000 * 60));
                          return <div className="text-orange-600 font-medium mt-1">⏰ Can start in {minutesUntil} minutes</div>;
                        } else if (now >= earliestStart && now <= latestStart) {
                          return <div className="text-green-600 font-medium mt-1">✅ Ready to start now!</div>;
                        } else {
                          return <div className="text-red-600 font-medium mt-1">❌ Start window expired</div>;
                        }
                      })()}
                    </div>
                  </div>
                )}
                
                <div>
                  <span className="font-medium text-gray-700">Services Needed:</span>
                  <p className="mt-1 text-gray-600">{selectedJob.services_description}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700">Client Budget:</span>
                  <span className="ml-2 text-lg font-semibold text-green-600">${selectedJob.client_budget}</span>
                </div>
                
                {selectedJob.final_price && (
                  <div>
                    <span className="font-medium text-gray-700">Final Price:</span>
                    <span className="ml-2 text-lg font-semibold text-blue-600">${selectedJob.final_price}</span>
                  </div>
                )}
                
                {selectedJob.notes && (
                  <div>
                    <span className="font-medium text-gray-700">Special Instructions:</span>
                    <p className="mt-1 text-gray-600">{selectedJob.notes}</p>
                  </div>
                )}

                {/* Show current bids */}
                {selectedJob.bids && selectedJob.bids.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Current Bids ({selectedJob.bids.length})</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedJob.bids.map((bid) => (
                        <div key={bid.id} className={`p-3 border rounded-lg ${
                          bid.status === 'accepted' ? 'border-green-300 bg-green-50' : 'border-gray-200'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">${bid.bid_amount}</p>
                              <p className="text-sm text-gray-600">
                                {bid.cleaner?.first_name || bid.cleaner?.username || 'Unknown'} • {bid.estimated_duration} min
                              </p>
                              {bid.message && (
                                <p className="text-sm text-gray-700 mt-1">{bid.message}</p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              {user?.role === 'client' && selectedJob.status === 'open_for_bids' && bid.status === 'pending' && (
                                <button
                                  onClick={() => handleAcceptBid(bid.id)}
                                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                  Accept
                                </button>
                              )}
                              {user?.role === 'cleaner' && bid.cleaner?.id === user.id && bid.status === 'pending' && (
                                <button
                                  onClick={() => handleWithdrawBid(bid.id)}
                                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                  Withdraw
                                </button>
                              )}
                              {bid.status === 'accepted' && (
                                <span className="text-green-600 text-sm font-medium">Accepted</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bid submission for cleaners */}
                {user?.role === 'cleaner' && selectedJob.status === 'open_for_bids' && (
                  <div>
                    {/* Check if cleaner has already bid */}
                    {selectedJob.bids?.some(bid => bid.cleaner?.id === user.id) ? (
                      <div>
                        <h3 className="font-medium text-gray-700 mb-2">Your Bid</h3>
                        <p className="text-sm text-gray-600">You have already submitted a bid for this job. You can withdraw it from the bids list above.</p>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-medium text-gray-700 mb-2">Submit Your Bid</h3>
                        <button
                          onClick={() => setShowBidModal(true)}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-medium transition-colors"
                        >
                          Place Bid
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Workflow Action Buttons for Cleaners */}
                {user?.role === 'cleaner' && selectedJob.status !== 'completed' && selectedJob.status !== 'open_for_bids' && selectedJob.cleaner?.id === user.id && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-700">Job Actions:</h3>
                    <div className="flex gap-2">
                      {selectedJob.status === 'confirmed' && (
                        (() => {
                          const canStartNow = selectedJob.scheduled_date && selectedJob.start_time ? (() => {
                            const scheduledDateTime = new Date(`${selectedJob.scheduled_date}T${selectedJob.start_time}`);
                            const now = new Date();
                            const earliestStart = new Date(scheduledDateTime.getTime() - 30 * 60 * 1000);
                            const latestStart = new Date(scheduledDateTime.getTime() + 2 * 60 * 60 * 1000);
                            return now >= earliestStart && now <= latestStart;
                          })() : true;
                          
                          return (
                            <button
                              onClick={() => handleWorkflowAction('start')}
                              disabled={!canStartNow}
                              className={`px-4 py-2 rounded text-sm transition-colors ${
                                canStartNow 
                                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              title={!canStartNow ? 'Job can only be started within the allowed time window' : 'Start the job with before photos'}
                            >
                              Start Job
                            </button>
                          );
                        })()
                      )}
                      {selectedJob.status === 'in_progress' && (
                        <button
                          onClick={() => handleWorkflowAction('finish')}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm transition-colors"
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
        </div>
      )}

      {/* Bid Submission Modal */}
      {showBidModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Submit Bid</h2>
                <button
                  onClick={() => setShowBidModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={(e) => handleSubmitBid(e, selectedJob.id)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Bid Amount ($)
                  </label>
                  <input
                    type="number"
                    name="bid_amount"
                    value={bidFormData.bid_amount}
                    onChange={handleBidInputChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your bid"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Client budget: ${selectedJob.client_budget}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="estimated_duration"
                    value={bidFormData.estimated_duration}
                    onChange={handleBidInputChange}
                    min="30"
                    max="480"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message to Client
                  </label>
                  <textarea
                    name="message"
                    value={bidFormData.message}
                    onChange={handleBidInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Explain your approach, experience, or why you're the best choice..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    Submit Bid
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBidModal(false)}
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

      {/* Job Workflow Modal */}
      {showWorkflowModal && selectedJob && (
        <JobWorkflowModal
          isOpen={showWorkflowModal}
          job={selectedJob}
          action={workflowAction}
          onJobUpdated={handleJobUpdated}
          onClose={closeWorkflowModal}
        />
      )}
    </div>
  );
};

export default CleaningJobsPool;