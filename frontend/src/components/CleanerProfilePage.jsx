/**
 * CleanerProfilePage - Public profile view for cleaners
 * Shows reviews, ratings, job stats, and eco-impact
 * Used by clients to evaluate cleaners before hiring
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import ReviewList from './ReviewList';
import ReviewStats from './ReviewStats';

const CleanerProfilePage = () => {
  const { cleanerId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCleanerProfile();
  }, [cleanerId]);

  const fetchCleanerProfile = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/profile/cleaner/${cleanerId}/`);
      
      if (!response.ok) {
        throw new Error('Failed to load profile');
      }
      
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching cleaner profile:', error);
      toast.error('Failed to load cleaner profile');
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
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
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
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cleaner Not Found</h2>
            <p className="text-gray-600 mb-6">The cleaner profile you're looking for doesn't exist.</p>
            <button 
              onClick={() => navigate('/find-cleaners')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Browse Other Cleaners
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const initials = `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back</span>
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          {/* Cover gradient */}
          <div className="h-32 md:h-48 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"></div>
          
          {/* Profile info */}
          <div className="px-6 md:px-8 pb-8">
            <div className="flex flex-col md:flex-row md:items-end md:space-x-6 -mt-16 md:-mt-20">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {profile.profile_picture ? (
                  <img 
                    src={profile.profile_picture} 
                    alt={fullName}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-white shadow-xl object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-4 border-white shadow-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-4xl md:text-5xl font-bold text-white">{initials}</span>
                  </div>
                )}
              </div>
              
              {/* Name and stats */}
              <div className="mt-4 md:mt-0 flex-1">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{fullName}</h1>
                <div className="flex flex-wrap items-center gap-4 text-gray-600">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold">{profile.job_stats.total_completed} Jobs Completed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span className="font-semibold">{profile.review_stats.total_reviews} Reviews</span>
                  </div>
                  {profile.location && (
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{profile.location}</span>
                    </div>
                  )}
                </div>
                
                {profile.bio && (
                  <p className="mt-4 text-gray-700 leading-relaxed">{profile.bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Eco Impact Stats */}
        {(profile.eco_impact.water_saved_liters > 0 || profile.eco_impact.chemicals_avoided_kg > 0 || profile.eco_impact.co2_saved_kg > 0) && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-lg p-6 md:p-8 mb-8 border border-green-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
              <span>🌱</span>
              <span>Environmental Impact</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-md">
                <div className="text-blue-600 text-3xl font-bold mb-2">{profile.eco_impact.water_saved_liters}L</div>
                <div className="text-gray-600 font-medium">Water Saved</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <div className="text-purple-600 text-3xl font-bold mb-2">{profile.eco_impact.chemicals_avoided_kg}kg</div>
                <div className="text-gray-600 font-medium">Chemicals Avoided</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <div className="text-green-600 text-3xl font-bold mb-2">{profile.eco_impact.co2_saved_kg}kg</div>
                <div className="text-gray-600 font-medium">CO₂ Saved</div>
              </div>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="space-y-8">
          <ReviewStats userId={parseInt(cleanerId)} />
          <ReviewList 
            revieweeId={parseInt(cleanerId)} 
            currentUser={null} 
            onResponseSubmit={() => {}}
            onFlag={() => {}}
            showActions={false}
          />
        </div>
      </div>
    </div>
  );
};

export default CleanerProfilePage;
