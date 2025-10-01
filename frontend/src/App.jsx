import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { UserProvider } from './contexts/UserContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Dashboard from './components/Dashboard';
import PropertiesDashboard from './components/PropertiesDashboard';
import CleaningJobsPool from './components/CleaningJobsPool';
import Profile from './components/Profile';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Dashboard route to be expanded with dashboards in Days 12-13 per DevelopmentTimeline.rtf
// Use kebab-case for URL paths per DEVELOPMENT_STANDARDS.md
function App() {
  return (
    <UserProvider>
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
          
          {/* Toast Container for notifications */}
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
