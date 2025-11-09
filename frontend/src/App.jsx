import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { UnifiedChatProvider } from './contexts/UnifiedChatContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import NotificationToast from './components/notifications/NotificationToast';
import FloatingChatPanel from './components/chat/FloatingChatPanel';
import ConnectionStateIndicator from './components/chat/ConnectionStateIndicator';
import DirectMessages from './components/chat/DirectMessages';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import OAuthCallback from './pages/OAuthCallback';
import OAuth2FAVerify from './pages/OAuth2FAVerify';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './components/Dashboard';
import PropertiesDashboard from './components/PropertiesDashboard';
import CleaningJobsPool from './components/CleaningJobsPool';
import CompletedJobsDashboard from './components/CompletedJobsDashboard';
import ChatPage from './pages/ChatPage';
import FindCleaners from './pages/FindCleaners';
import Payments from './pages/Payments';
import Payouts from './pages/Payouts';
import AdminFinancials from './pages/AdminFinancials';
import CleanerProfilePage from './components/CleanerProfilePage';
import ClientProfilePage from './components/ClientProfilePage';
// Modern settings pages
import SettingsLayout from './pages/settings/SettingsLayout';
import ProfileSettings from './pages/settings/ProfileSettings';
import SecuritySettings from './pages/settings/SecuritySettings';
import NotificationsSettings from './pages/settings/NotificationsSettings';
import ServiceAreasSettings from './pages/settings/ServiceAreasSettings';
import ConnectedAccountsSettings from './pages/settings/ConnectedAccountsSettings';
import AccountSettings from './pages/settings/AccountSettings';
import './utils/globalSetup'; // Initialize global error handling
import './App.css';

// Dashboard route to be expanded with dashboards in Days 12-13 per DevelopmentTimeline.rtf
// Use kebab-case for URL paths per DEVELOPMENT_STANDARDS.md
function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <WebSocketProvider>
          <UnifiedChatProvider>
            <Router>
              <div className="App min-h-screen flex flex-col">
                <Navigation />
                <NotificationToast />
                <ConnectionStateIndicator />
                <FloatingChatPanel />
                <main className="flex-1">
                <Routes>
                  <Route path="/login" element={<LoginForm />} />
                  <Route path="/register" element={<RegisterForm />} />
                  <Route path="/auth/callback" element={<OAuthCallback />} />
                  <Route path="/auth/2fa-verify" element={<OAuth2FAVerify />} />
                  <Route path="/verify-email/:token" element={<VerifyEmail />} />
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                  path="/properties" 
                  element={
                    <ProtectedRoute>
                      <PropertiesDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/jobs" 
                  element={
                    <ProtectedRoute>
                      <CleaningJobsPool />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/jobs/:jobId/chat" 
                  element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/messages" 
                  element={
                    <ProtectedRoute>
                      <DirectMessages />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/find-cleaners" 
                  element={
                    <ProtectedRoute>
                      <FindCleaners />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/completed-jobs" 
                  element={
                    <ProtectedRoute>
                      <CompletedJobsDashboard />
                    </ProtectedRoute>
                  } 
                />
                {/* Modern Settings Pages with Nested Routes */}
                <Route 
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Redirect /settings to /settings/profile */}
                  <Route index element={<Navigate to="/settings/profile" replace />} />
                  <Route path="profile" element={<ProfileSettings />} />
                  <Route path="security" element={<SecuritySettings />} />
                  <Route path="notifications" element={<NotificationsSettings />} />
                  <Route path="service-areas" element={<ServiceAreasSettings />} />
                  <Route path="connected-accounts" element={<ConnectedAccountsSettings />} />
                  <Route path="account" element={<AccountSettings />} />
                </Route>
                {/* Legacy /profile route - redirect to new settings */}
                <Route path="/profile" element={<Navigate to="/settings/profile" replace />} />
                <Route 
                  path="/cleaner/:cleanerId" 
                  element={<CleanerProfilePage />} 
                />
                <Route 
                  path="/client/:clientId" 
                  element={<ClientProfilePage />} 
                />
                <Route 
                  path="/payments" 
                  element={
                    <ProtectedRoute>
                      <Payments />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/payouts" 
                  element={
                    <ProtectedRoute>
                      <Payouts />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/financials" 
                  element={
                    <ProtectedRoute>
                      <AdminFinancials />
                    </ProtectedRoute>
                  } 
                />
                {/* <Route 
                  path="/stripe-connect" 
                  element={
                    <ProtectedRoute>
                      <StripeConnect />
                    </ProtectedRoute>
                  } 
                /> */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
          </UnifiedChatProvider>
        </WebSocketProvider>
      </ToastProvider>
    </UserProvider>
  );
}

export default App;
