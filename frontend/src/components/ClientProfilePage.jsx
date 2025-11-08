/**
 * ClientProfilePage - Public profile view for clients
 * Shows reviews, ratings, and job stats
 * Used by cleaners to evaluate clients before accepting jobs
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import ReviewList from './ReviewList';
import ReviewStats from './ReviewStats';

const ClientProfilePage = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientProfile();
  }, [clientId]);

  const fetchClientProfile = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/profile/client/${clientId}/`);
      
      if (!response.ok) {
        throw new Error('Failed to load profile');
      }
      
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching client profile:', error);
      toast.error('Failed to load client profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <p className="text-gray-600 mb-4">Profile not found</p>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12">
            <div className="flex items-start space-x-6">
              {/* Profile Picture */}
              <div className="flex-shrink-0">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt={`${profile.first_name} ${profile.last_name}`}
                    className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-white mb-2">
                  {profile.first_name} {profile.last_name}
                </h1>
                <div className="flex items-center space-x-4 text-blue-100 mb-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span>Client</span>
                  </div>
                  {profile.member_since && (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      <span>Member since {profile.member_since}</span>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex space-x-6">
                  <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3 backdrop-blur-sm">
                    <div className="text-3xl font-bold text-white">
                      {profile.review_stats?.overall_average?.toFixed(1) || '0.0'}
                    </div>
                    <div className="text-blue-100 text-sm">Average Rating</div>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3 backdrop-blur-sm">
                    <div className="text-3xl font-bold text-white">
                      {profile.review_stats?.total_reviews || 0}
                    </div>
                    <div className="text-blue-100 text-sm">Reviews</div>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-lg px-6 py-3 backdrop-blur-sm">
                    <div className="text-3xl font-bold text-white">
                      {profile.job_stats?.total_completed || 0}
                    </div>
                    <div className="text-blue-100 text-sm">Completed Jobs</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Review Statistics */}
        {profile.review_stats && profile.review_stats.total_reviews > 0 && (
          <div className="mb-6">
            <ReviewStats stats={profile.review_stats} />
          </div>
        )}

        {/* Reviews List */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Reviews from Cleaners
          </h2>
          
          {profile.id && (
            <ReviewList
              revieweeId={profile.id}
              revieweeRole="client"
              showFilters={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientProfilePage;
