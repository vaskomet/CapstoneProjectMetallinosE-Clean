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
import Dashboard from './components/Dashboard';
import PropertiesDashboard from './components/PropertiesDashboard';
import CleaningJobsPool from './components/CleaningJobsPool';
import CompletedJobsDashboard from './components/CompletedJobsDashboard';
import Profile from './components/Profile';
import ChatPage from './pages/ChatPage';
// import PaymentHistory from './pages/PaymentHistory.jsx';
// import StripeConnect from './pages/StripeConnect.jsx';
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
                  path="/completed-jobs" 
                  element={
                    <ProtectedRoute>
                      <CompletedJobsDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />
                {/* <Route 
                  path="/payments" 
                  element={
                    <ProtectedRoute>
                      <PaymentHistory />
                    </ProtectedRoute>
                  } 
                /> */}
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
