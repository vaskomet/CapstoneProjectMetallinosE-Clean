import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import { useUser } from '../contexts/UserContext';
import { cleaningJobsAPI, propertiesAPI, jobBidsAPI } from '../services/api';
import LocationFilter from './LocationFilter';
import JobWorkflowModal from './JobWorkflowModal';
import PaymentModal from './payments/PaymentModal';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * CleaningJobsPool Component
 *
 * A comprehensive job management interface that serves as the central hub for both clients and cleaners
 * in the E-Cleaner platform. This component provides role-based functionality for job creation,
 * bidding, assignment, and workflow management using an integrated calendar view.
 *
 * @component
 * @requires React, FullCalendar.js
 * @requires Authentication (redirects to login if not authenticated)
 *
 * @features
 * - **Role-Based Interface**: Different functionality for clients vs cleaners
 * - **Calendar Integration**: FullCalendar.js for visual job scheduling and management
 * - **Job Creation**: Clients can create new cleaning service requests
 * - **Bidding System**: Cleaners can submit competitive bids on open jobs
 * - **Workflow Management**: Photo-documented job lifecycle (confirm → start → complete)
 * - **Location Filtering**: Cleaners can filter jobs by service areas or distance
 * - **Real-time Updates**: Automatic refresh of job status and bid information
 * - **Responsive Design**: Mobile-friendly interface with adaptive layouts
 *
 * @dependencies
 * - FullCalendar.js plugins: dayGridPlugin, timeGridPlugin, listPlugin
 * - React Router: useNavigate for authentication redirects
 * - Toast notifications: react-toastify for user feedback
 * - Context providers: UserContext for authentication state
 * - API services: cleaningJobsAPI, propertiesAPI, jobBidsAPI
 * - Child components: LocationFilter, JobWorkflowModal
 *
 * @api
 * - GET /api/cleaning-jobs/ - Fetch jobs with optional filtering
 * - POST /api/cleaning-jobs/ - Create new job (clients only)
 * - PATCH /api/cleaning-jobs/{id}/status/ - Update job status
 * - GET /api/properties/ - Fetch user properties (clients only)
 * - GET /api/service-types/ - Fetch available service types
 * - GET/POST /api/job-bids/ - Bid management for competitive pricing
 *
 * @state
 * - jobs: Array of job objects with full details and relationships
 * - properties: User's properties (clients only)
 * - bids: All job bids for bid display and management
 * - locationFilter: Geographic filtering for cleaners
 * - formData: Job creation form state
 * - bidFormData: Bid submission form state
 * - UI states: loading, error, modal visibility flags
 *
 * @workflow
 * 1. **Authentication Check**: Redirect to login if not authenticated
 * 2. **Data Loading**: Fetch jobs, properties, bids, and service types
 * 3. **Role Determination**: Render appropriate interface based on user role
 * 4. **Calendar Rendering**: Convert jobs to calendar events with status colors
 * 5. **Interaction Handling**: Event clicks open detailed job modals
 * 6. **Action Processing**: Handle bids, status updates, and workflow actions
 *
 * @permissions
 * - **Clients**: Create jobs, view bids, accept bids, track job progress
 * - **Cleaners**: View available jobs, submit bids, manage assignments, update status
 *
 * @errorHandling
 * - Network errors with retry logic and user-friendly messages
 * - Form validation with specific field error highlighting
 * - API error responses with toast notifications
 * - Loading states to prevent multiple simultaneous requests
 *
 * @styling
 * - Tailwind CSS for responsive design
 * - Status-based color coding for jobs and calendar events
 * - Gradient backgrounds and shadow effects for visual hierarchy
 * - Mobile-first approach with adaptive grid layouts
 *
 * @testing
 * - Authentication flow and redirects
 * - Calendar rendering with various job states
 * - Form submissions and validation
 * - API error handling and recovery
 * - Role-based UI rendering
 * - Real-time data updates and refreshes
 *
 * @example
 * ```jsx
 * import CleaningJobsPool from './components/CleaningJobsPool';
 *
 * function App() {
 *   return (
 *     <UserProvider>
 *       <CleaningJobsPool />
 *     </UserProvider>
 *   );
 * }
 * ```
 */
const CleaningJobsPool = () => {
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]); // Array of all jobs visible to current user
  const [properties, setProperties] = useState([]); // User's properties (clients only)
  const [serviceTypes, setServiceTypes] = useState([]); // Available cleaning service types
  const [loading, setLoading] = useState(true); // Loading state for initial data fetch
  const [error, setError] = useState(''); // Error message for failed operations

  // Modal visibility states
  const [showCreateModal, setShowCreateModal] = useState(false); // Job creation modal
  const [showJobModal, setShowJobModal] = useState(false); // Job details modal
  const [selectedJob, setSelectedJob] = useState(null); // Currently selected job for modals

  // Job creation form state
  const [formData, setFormData] = useState({
    property: '', // Selected property ID
    scheduled_date: '', // Job date (YYYY-MM-DD)
    start_time: '', // Job start time (HH:MM)
    end_time: '', // Job end time (HH:MM)
    services_description: '', // Description of required services
    client_budget: '', // Client's budget for the job
    checklist: [], // Array of checklist items
    notes: '', // Additional notes
    estimated_duration: 60 // Estimated duration in minutes
  });

  // Bidding related states (for cleaners)
  const [bids, setBids] = useState([]); // All bids across all jobs
  const [showBidModal, setShowBidModal] = useState(false); // Bid submission modal
  const [bidFormData, setBidFormData] = useState({
    bid_amount: '', // Cleaner's bid amount
    estimated_duration: 60, // Cleaner's estimated duration
    message: '' // Message to client explaining the bid
  });

  // Location filter state (for cleaners)
  const [locationFilter, setLocationFilter] = useState({
    type: 'all', // Filter type: 'all', 'myAreas', 'distance'
    areaId: '', // Selected service area ID
    distance: '5' // Distance in km for proximity filtering
  });

  // Job workflow modal states
  const [showWorkflowModal, setShowWorkflowModal] = useState(false); // Workflow modal visibility
  const [workflowAction, setWorkflowAction] = useState(null); // Current workflow action: 'confirm', 'start', 'finish'

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false); // Payment modal visibility
  const [paymentJobData, setPaymentJobData] = useState(null); // Job data for payment (job ID, amount, title)
  const [pendingBidId, setPendingBidId] = useState(null); // Bid ID pending payment confirmation

  // Ref to prevent multiple simultaneous fetch calls
  const fetchingRef = useRef(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  /**
   * Fetches all jobs visible to the current user
   * Applies location filtering for cleaners
   * Includes bid information for job display
   */
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

  /**
   * Fetches user properties for job creation (clients only)
   * Required before clients can create new cleaning jobs
   */
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

  /**
   * Fetches available service types for job creation
   * Used to populate service type options in forms
   */
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

  // Handle pre-selected job from navigation state (e.g., from cleaner profile)
  useEffect(() => {
    if (location.state?.selectedJobId && jobs.length > 0) {
      const jobToSelect = jobs.find(job => job.id === location.state.selectedJobId);
      if (jobToSelect) {
        setSelectedJob(jobToSelect);
        setShowJobModal(true);
        // Clear the navigation state so it doesn't re-trigger
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, jobs, navigate, location.pathname]);

  // Handle URL parameters for highlighting/opening specific jobs
  useEffect(() => {
    const highlightParam = searchParams.get('highlight');
    const jobParam = searchParams.get('job');
    const jobId = highlightParam || jobParam;
    
    if (jobId && jobs.length > 0) {
      // Find the job in the loaded jobs
      const job = jobs.find(j => j.id === parseInt(jobId));
      
      if (job) {
        console.log('📌 Opening job from notification:', job);
        setSelectedJob(job);
        setShowJobModal(true);
        
        // Clear the URL parameter after opening the modal
        setSearchParams({});
        
        // Show a toast to indicate the job was highlighted
        toast.info(`Viewing job: ${job.services_description || 'Cleaning Job'}`, {
          autoClose: 3000
        });
      } else {
        console.warn('⚠️ Job not found in current jobs list:', jobId);
      }
    }
  }, [jobs, searchParams, setSearchParams]);

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

  /**
   * Fetches all bids for job display and management
   * Used to show bid counts and details on calendar events
   */
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
      
      console.log('📤 Sending job data:', JSON.stringify(jobData, null, 2));
      
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

  /**
   * Handles job status updates (primarily for cleaners)
   * Updates job status and refreshes the job list
   */
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

  /**
   * Initiates workflow actions that require photo documentation
   * Opens the JobWorkflowModal for confirm/start/finish actions
   * @param {string} action - The workflow action: 'confirm', 'start', or 'finish'
   */
  const handleWorkflowAction = (action) => {
    setWorkflowAction(action);
    setShowWorkflowModal(true);
  };

  /**
   * Callback function for when a job is updated through the workflow modal
   * Updates the local job state and closes the modal
   * @param {Object} updatedJob - The updated job object from the workflow
   */
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

  /**
   * Closes the workflow modal and resets the workflow action state
   */
  const closeWorkflowModal = () => {
    setShowWorkflowModal(false);
    setWorkflowAction(null);
  };

  /**
   * Handles bid submission from cleaners
   * Validates bid data and creates a new bid for the specified job
   * @param {Event} e - Form submission event
   * @param {number} jobId - ID of the job being bid on
   */
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

  /**
   * Handles bid acceptance by clients
   * Opens payment modal first, bid is accepted only after successful payment
   * Payment flow: Open payment modal → Process payment → Accept bid on success
   * @param {number} bidId - ID of the bid to accept
   * @param {object} bid - Bid object with amount and job details
   */
  const handleAcceptBid = async (bidId, bid) => {
    try {
      // Find the job associated with this bid
      const job = jobs.find(j => j.id === bid.job);
      
      if (!job) {
        toast.error('Job not found for this bid');
        return;
      }

      // Prepare payment data and open modal
      setPaymentJobData({
        bidId: bidId,
        jobId: job.id,
        amount: parseFloat(bid.bid_amount),
        jobTitle: `${job.service_type_name || 'Cleaning Service'} - ${job.property_address || 'Property'}`,
      });
      
      // Store bid ID for reference
      setPendingBidId(bidId);
      
      // Close job modal and open payment modal
      setShowJobModal(false);
      setShowPaymentModal(true);
      
      toast.info('Please complete payment to accept this bid.');
      
    } catch (err) {
      const errorMessage = err.message || 'Failed to process bid';
      console.error('Error in handleAcceptBid:', err);
      toast.error(errorMessage);
    }
  };

  /**
   * Handle successful payment
   * Called after payment is confirmed with Stripe
   * Refreshes job data to show updated payment status
   */
  const handlePaymentSuccess = async (paymentIntent) => {
    try {
      toast.success('Payment successful! Your booking is confirmed.');
      
      // Clear payment state
      setShowPaymentModal(false);
      setPaymentJobData(null);
      setPendingBidId(null);

      // Refresh all data to show updated job status
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
      console.error('Error refreshing after payment:', err);
      toast.error('Payment successful, but failed to refresh job data. Please refresh the page.');
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

  /**
   * Handles calendar event clicks to open job details modal
   * @param {Object} clickInfo - FullCalendar click event information
   */
  const handleEventClick = (clickInfo) => {
    setSelectedJob(clickInfo.event.extendedProps);
    setShowJobModal(true);
  };

  /**
   * Converts jobs data into FullCalendar event objects
   * Includes bid information and status-based styling
   */
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

  /**
   * Returns color code based on job status for calendar visualization
   * @param {string} status - Job status
   * @returns {string} Hex color code
   */
  function getStatusColor(status) {
    switch (status) {
      case 'open_for_bids': return '#f59e0b'; // amber - available for bidding
      case 'bid_accepted': return '#06b6d4'; // cyan - bid accepted, awaiting confirmation
      case 'confirmed': return '#3b82f6'; // blue - confirmed by cleaner
      case 'ready_to_start': return '#6366f1'; // indigo - ready to begin work
      case 'in_progress': return '#8b5cf6'; // purple - job actively being worked on
      case 'awaiting_review': return '#14b8a6'; // teal - waiting for client review
      case 'completed': return '#10b981'; // green - job finished successfully
      case 'cancelled': return '#ef4444'; // red - job cancelled
      default: return '#6b7280'; // gray - unknown status
    }
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section - Role-based title and quick stats */}
      <div className="bg-gradient-to-r from-white to-blue-50 shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                {user?.role === 'cleaner' ? (
                  <>
                    <svg className="w-8 h-8 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6m0 0a2 2 0 002 2h2m-2-2a2 2 0 00-2-2m2 2v12a2 2 0 002 2h-2a2 2 0 01-2-2V8z" />
                    </svg>
                    Find Jobs & Manage Work
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    My Cleaning Jobs
                  </>
                )}
              </h1>
              <p className="text-gray-600 text-lg">
                {user?.role === 'cleaner'
                  ? 'Browse available jobs, submit bids, and manage your accepted assignments'
                  : 'Create new cleaning requests and track your scheduled services'
                }
              </p>

              {/* Quick Stats - Job status overview */}
              <div className="flex items-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {jobs.filter(job => job.status === 'pending').length} Pending
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {jobs.filter(job => job.status === 'in_progress').length} In Progress
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {jobs.filter(job => job.status === 'completed').length} Completed
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons - Role-based primary actions */}
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

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Location Filter - Geographic filtering for cleaners */}
        {user?.role === 'cleaner' && (
          <div className="mb-6">
            <LocationFilter
              onFilterChange={handleLocationFilterChange}
              currentFilter={locationFilter}
            />
          </div>
        )}

        {/* Loading State - Spinner during data fetch */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading jobs...</span>
          </div>
        )}

        {/* Error State - Display API or network errors */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Main Calendar View - FullCalendar.js integration */}
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
                <div className="flex items-center space-x-3">
                  {/* Close Button */}
                  <button
                    onClick={() => setShowJobModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
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
                    selectedJob.status === 'awaiting_review' ? 'bg-teal-100 text-teal-800' :
                    selectedJob.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                    selectedJob.status === 'ready_to_start' ? 'bg-indigo-100 text-indigo-800' :
                    selectedJob.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                    selectedJob.status === 'bid_accepted' ? 'bg-cyan-100 text-cyan-800' :
                    selectedJob.status === 'open_for_bids' ? 'bg-amber-100 text-amber-800' :
                    selectedJob.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedJob.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>

                {/* Payment Status */}
                {selectedJob.payment_info && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-700 flex items-center gap-2">
                          💳 Payment Status:
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedJob.payment_info.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                            selectedJob.payment_info.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            selectedJob.payment_info.status === 'failed' ? 'bg-red-100 text-red-800' :
                            selectedJob.payment_info.status === 'refunded' ? 'bg-purple-100 text-purple-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {selectedJob.payment_info.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-900">
                          ${parseFloat(selectedJob.payment_info.amount).toFixed(2)}
                        </div>
                        {selectedJob.payment_info.payment_method && (
                          <div className="text-xs text-gray-600 mt-1">
                            {selectedJob.payment_info.payment_method.brand?.toUpperCase()} ••••{' '}
                            {selectedJob.payment_info.payment_method.last4}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedJob.payment_info.paid_at && (
                      <div className="text-xs text-gray-600 mt-2">
                        Paid on {new Date(selectedJob.payment_info.paid_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                )}
                
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
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">${bid.bid_amount}</p>
                              <p className="text-sm text-gray-600">
                                {bid.cleaner?.first_name || bid.cleaner?.username || 'Unknown'} • {bid.estimated_duration} min
                              </p>
                              {bid.message && (
                                <p className="text-sm text-gray-700 mt-1">{bid.message}</p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              {/* Chat button - Available for both client and the bidder */}
                              {(user?.role === 'client' || (user?.role === 'cleaner' && bid.cleaner?.id === user.id)) && (
                                <button
                                  onClick={() => {
                                    navigate(`/jobs/${selectedJob.id}/chat?bidder=${bid.cleaner.id}`);
                                    setShowJobModal(false);
                                  }}
                                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center space-x-1"
                                  title={user?.role === 'client' ? `Chat with ${bid.cleaner?.username}` : 'Chat with client'}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  <span>Chat</span>
                                </button>
                              )}
                              
                              {/* Accept & Pay button - Only for client on open jobs */}
                              {user?.role === 'client' && selectedJob.status === 'open_for_bids' && bid.status === 'pending' && (
                                <button
                                  onClick={() => handleAcceptBid(bid.id, bid)}
                                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                  Accept & Pay
                                </button>
                              )}
                              
                              {/* Withdraw button - Only for cleaner's own bids */}
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
                      {(selectedJob.status === 'confirmed' || selectedJob.status === 'bid_accepted') && (
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
                {/* Info Message */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> After submitting your bid, you'll be able to chat with the client to discuss job details!
                    </p>
                  </div>
                </div>
                
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

      {/* Payment Modal */}
      {showPaymentModal && paymentJobData && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentJobData(null);
            setPendingBidId(null);
          }}
          jobId={paymentJobData.jobId}
          bidId={paymentJobData.bidId}
          amount={paymentJobData.amount}
          jobTitle={paymentJobData.jobTitle}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default CleaningJobsPool;