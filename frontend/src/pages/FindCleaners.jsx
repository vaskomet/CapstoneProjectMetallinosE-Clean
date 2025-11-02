/**
 * FindCleaners Page
 * 
 * Allows clients to search for nearby cleaners and start direct message conversations.
 * Uses the existing CleanerSearch component with integrated DM functionality.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useUnifiedChat } from '../contexts/UnifiedChatContext';
import { useToast } from '../contexts/ToastContext';
import CleanerSearch from '../components/CleanerSearch';

const FindCleaners = () => {
  const { user } = useUser();
  const { createDirectMessage } = useUnifiedChat();
  const navigate = useNavigate();
  const toast = useToast();
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // Redirect if not a client
  if (user?.role !== 'client') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            This page is only available to clients.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleStartConversation = async (cleaner) => {
    setIsCreatingChat(true);
    try {
      // Create a direct message room with the selected cleaner
      const room = await createDirectMessage(cleaner.id);
      
      if (room) {
        toast.success(`Started conversation with ${cleaner.first_name} ${cleaner.last_name}`);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Find Nearby Cleaners</h1>
            <p className="mt-2 text-gray-600">
              Search for cleaners in your area and click "Message" to start a conversation
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - CleanerSearch Component */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <CleanerSearch
            onSelectCleaners={null}
            selectedCleaners={[]}
            multiSelect={false}
            onMessageCleaner={handleStartConversation}
          />

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">How to use:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Use your GPS location or search by city/postal code</li>
                  <li>• Browse the search results to find cleaners in your area</li>
                  <li>• Click the "Message" button next to any cleaner to start a conversation</li>
                  <li>• You'll be redirected to the Messages page to continue chatting</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindCleaners;
