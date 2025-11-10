import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { cleaningJobsAPI } from '../services/api';
import OnboardingCard from './common/OnboardingCard';
import ClientDashboard from './dashboard/ClientDashboard';
import CleanerDashboard from './dashboard/CleanerDashboard';

export default function Dashboard() {
  const { user } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        let data;
        if (user?.role === 'client') {
          data = await cleaningJobsAPI.getClientStats();
        } else if (user?.role === 'cleaner') {
          data = await cleaningJobsAPI.getCleanerStats();
        }
        setStats(data);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user && (user.role === 'client' || user.role === 'cleaner')) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  const getWelcomeMessage = (role) => {
    switch(role) {
      case 'client':
        return 'Ready to book your next cleaning service? Let\'s get your space sparkling clean!';
      case 'cleaner':
        return 'Find new cleaning opportunities and manage your current assignments.';
      case 'admin':
        return 'Monitor platform activity and manage users efficiently.';
      default:
        return 'Welcome to E-Clean - your sustainable cleaning platform.';
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'client': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg';
      case 'cleaner': return 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg';
      case 'admin': return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg';
      default: return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-white to-blue-50 rounded-2xl shadow-lg p-8 border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
                Welcome back, {user?.first_name}! 👋
              </h1>
              <p className="text-gray-700 text-xl font-medium">
                {getWelcomeMessage(user?.role)}
              </p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right space-y-1">
                <p className="text-sm text-gray-500 font-medium">Your Role</p>
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${getRoleColor(user?.role)}`}>
                  {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Onboarding Section */}
        <OnboardingCard user={user} />

        {/* Role-Specific Dashboard */}
        {user?.role === 'client' && <ClientDashboard stats={stats} loading={loading} />}
        {user?.role === 'cleaner' && <CleanerDashboard stats={stats} loading={loading} />}
        
        {/* Admin Dashboard Placeholder */}
        {user?.role === 'admin' && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h2>
            <p className="text-gray-600 mb-8">Advanced analytics and user management coming soon</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link to="/admin/financials" className="p-6 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                <div className="text-purple-600 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900">Financial Overview</p>
              </Link>
              <div className="p-6 bg-gray-50 rounded-lg">
                <div className="text-gray-400 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-500">User Management (Coming Soon)</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg">
                <div className="text-gray-400 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-500">Analytics (Coming Soon)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
