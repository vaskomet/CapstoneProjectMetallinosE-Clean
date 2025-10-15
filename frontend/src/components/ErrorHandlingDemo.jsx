import React, { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { authAPI, cleaningJobsAPI } from '../services/api';

const ErrorHandlingDemo = () => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const testErrorHandling = async () => {
    try {
      setIsLoading(true);
      // This should trigger our error handling
      await cleaningJobsAPI.getById(999); // Non-existent job
    } catch (error) {
      console.log('Error caught in component:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testSuccessMessage = async () => {
    try {
      await cleaningJobsAPI.getAll();
      toast.success('Successfully loaded jobs!');
    } catch (error) {
      console.log('Error:', error);
    }
  };

  const testManualToasts = () => {
    toast.success('Success message!');
    setTimeout(() => toast.error('Error message!'), 1000);
    setTimeout(() => toast.warning('Warning message!'), 2000);
    setTimeout(() => toast.info('Info message!'), 3000);
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Error Handling Demo</h2>
      
      <div className="space-y-3">
        <button
          onClick={testErrorHandling}
          disabled={isLoading}
          className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white py-2 px-4 rounded"
        >
          {isLoading ? 'Loading...' : 'Test Error Handling'}
        </button>
        
        <button
          onClick={testSuccessMessage}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
        >
          Test Success Message
        </button>
        
        <button
          onClick={testManualToasts}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Test All Toast Types
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>• First button tests automatic error handling</p>
        <p>• Second button tests success messages</p>
        <p>• Third button shows all toast types</p>
      </div>
    </div>
  );
};

export default ErrorHandlingDemo;