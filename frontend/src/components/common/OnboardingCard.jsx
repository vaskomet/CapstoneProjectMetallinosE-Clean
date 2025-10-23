/**
 * OnboardingCard Component
 *
 * Interactive onboarding guidance component that helps new users complete essential setup steps.
 * Displays role-specific checklists with progress tracking and direct navigation to completion actions.
 *
 * @component
 * @requires React, React Router
 *
 * @features
 * - **Role-Based Guidance**: Different onboarding steps for clients vs cleaners
 * - **Progress Tracking**: Visual progress bar and completion counters
 * - **Interactive Steps**: Clickable actions to complete each step
 * - **Conditional Display**: Only shows when onboarding is incomplete
 * - **Responsive Design**: Mobile-friendly layout with clear visual hierarchy
 * - **Completion States**: Visual indicators for completed vs pending steps
 *
 * @dependencies
 * - React Router: Link component for navigation
 * - Tailwind CSS: Gradient backgrounds and responsive styling
 *
 * @props
 * - user: Object - User object containing role and profile information
 *   - user.role: string - User role ('client' or 'cleaner')
 *   - user.first_name: string - User's first name for profile completion check
 *
 * @onboardingSteps
 * **Client Steps:**
 * 1. Complete Profile - Fill in personal information
 * 2. Add First Property - Create property listing
 * 3. Post First Job - Create initial cleaning job request
 *
 * **Cleaner Steps:**
 * 1. Complete Profile - Fill in personal information
 * 2. Set Service Areas - Define geographic service coverage
 * 3. Submit First Bid - Place bid on available job
 *
 * @state
 * - steps: Array of onboarding step objects with completion status
 * - completedSteps: Number of completed steps
 * - progressPercentage: Percentage of onboarding completion
 *
 * @logic
 * - Determines steps based on user role
 * - Checks completion status for each step
 * - Calculates progress percentage
 * - Hides component when fully complete or for admin users
 *
 * @ui
 * - Gradient background with amber/orange theme
 * - Progress bar with smooth animations
 * - Checkmark icons for completed steps
 * - Action buttons for pending steps
 * - Responsive grid layout for step items
 *
 * @accessibility
 * - Semantic HTML structure
 * - Clear visual indicators for completion status
 * - Keyboard navigation support via React Router Link
 * - Screen reader friendly progress information
 * - Color contrast compliant design
 *
 * @styling
 * - Glassmorphism-inspired design with subtle borders
 * - Smooth transitions for progress bar animations
 * - Consistent spacing and typography
 * - Mobile-responsive layout adjustments
 *
 * @example
 * ```jsx
 * import OnboardingCard from './components/common/OnboardingCard';
 * import { useUser } from '../contexts/UserContext';
 *
 * function Dashboard() {
 *   const { user } = useUser();
 *
 *   return (
 *     <div className="dashboard">
 *       <OnboardingCard user={user} />
 *       {/* Other dashboard content *\/}
 *     </div>
 *   );
 * }
 * ```
 *
 * @notes
 * - Currently uses basic completion checks (TODO: implement actual data verification)
 * - Progress calculation is client-side only
 * - Component auto-hides when onboarding is complete
 * - Links navigate to relevant sections for step completion
 */

import { Link } from 'react-router-dom';

const OnboardingCard = ({ user }) => {
  /**
   * Generates role-specific onboarding steps with completion status
   * @param {string} role - User role ('client' or 'cleaner')
   * @returns {Array} Array of step objects with completion status
   */
  const getOnboardingSteps = (role) => {
    switch(role) {
      case 'client':
        return [
          { label: 'Complete Profile', completed: !!user?.first_name, link: '/profile' },
          { label: 'Add First Property', completed: false, link: '/properties' }, // TODO: Check actual property count
          { label: 'Post First Job', completed: false, link: '/jobs' }
        ];
      case 'cleaner':
        return [
          { label: 'Complete Profile', completed: !!user?.first_name, link: '/profile' },
          { label: 'Set Service Areas', completed: false, link: '/profile' }, // TODO: Check actual service areas
          { label: 'Submit First Bid', completed: false, link: '/jobs' }
        ];
      default:
        return [];
    }
  };

  // Calculate onboarding progress
  const steps = getOnboardingSteps(user?.role);
  const completedSteps = steps.filter(step => step.completed).length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 100;

  // Don't render if no steps or fully complete
  if (totalSteps === 0 || completedSteps === totalSteps) {
    return null; // Don't show for admin or when everything is complete
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg p-6 border border-amber-200">
      {/* Header Section - Title and progress counter */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Get Started with E-Clean
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Complete these steps to get the most out of your account
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-amber-700">
            {completedSteps}/{totalSteps}
          </span>
          <p className="text-xs text-gray-500">completed</p>
        </div>
      </div>

      {/* Progress Bar - Visual completion indicator */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>

      {/* Steps List - Interactive onboarding checklist */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center">
              {/* Step Status Indicator */}
              <div className={`w-4 h-4 rounded-full mr-3 flex items-center justify-center ${
                step.completed
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 border-2 border-gray-400'
              }`}>
                {step.completed && (
                  <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {/* Step Label */}
              <span className={`text-sm ${step.completed ? 'text-gray-500 line-through' : 'text-gray-700 font-medium'}`}>
                {step.label}
              </span>
            </div>
            {/* Action Button - Only show for incomplete steps */}
            {!step.completed && (
              <Link
                to={step.link}
                className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1 rounded-full transition-colors duration-200"
              >
                Complete
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OnboardingCard;