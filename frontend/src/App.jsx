import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Dashboard from './components/Dashboard';
import PropertiesDashboard from './components/PropertiesDashboard';
import CleaningJobsPool from './components/CleaningJobsPool';
import CompletedJobsDashboard from './components/CompletedJobsDashboard';
import Profile from './components/Profile';
import './utils/globalSetup'; // Initialize global error handling
import './App.css';

// Dashboard route to be expanded with dashboards in Days 12-13 per DevelopmentTimeline.rtf
// Use kebab-case for URL paths per DEVELOPMENT_STANDARDS.md
function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <Router>
          <div className="App min-h-screen flex flex-col">
            <Navigation />
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
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ToastProvider>
    </UserProvider>
  );
}

export default App;
