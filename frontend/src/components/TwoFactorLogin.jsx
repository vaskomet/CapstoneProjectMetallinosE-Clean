import { useState } from 'react';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';

export default function TwoFactorLogin({ email, onSuccess, onCancel }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (code.length !== 6) {
      setError('Please enter a complete 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verify2FALogin(email, code);
      toast.success('2FA verification successful! Welcome back!');
      onSuccess(response);
    } catch (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      let errorMessage = 'Invalid verification code';
      
      // Provide more helpful error messages
      if (error.response?.status === 401) {
        errorMessage = 'Invalid code. Please check your authenticator app and try again.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setError(errorMessage);
      toast.error(errorMessage, {
        autoClose: 5000,
        icon: '🔒'
      });
      
      // Clear the code input for retry
      setCode('');
      
      // Show additional help after multiple failed attempts
      if (newAttempts >= 3) {
        setTimeout(() => {
          toast.info('💡 Tip: Make sure your phone\'s time is synchronized. Codes expire every 30 seconds.', {
            autoClose: 7000
          });
        }, 1000);
      }
      
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white shadow-md rounded-lg p-8">
        <div className="text-center mb-6">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 transition-colors ${
            error ? 'bg-red-100' : 'bg-blue-100'
          }`}>
            <svg className={`h-6 w-6 transition-colors ${error ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Two-Factor Authentication
          </h3>
          <p className="text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* Error message banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 animate-shake">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-red-800 font-medium">{error}</p>
                {attempts >= 2 && (
                  <p className="text-xs text-red-600 mt-1">
                    Attempts: {attempts}/5 - Codes expire every 30 seconds
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError(''); // Clear error when user starts typing
              }}
              maxLength={6}
              placeholder="000000"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent text-center text-2xl font-mono tracking-widest transition-all ${
                error 
                  ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              autoFocus
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500 text-center">
              {code.length}/6 digits
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </span>
              ) : 'Verify'}
            </button>
          </div>
        </form>

        <div className="mt-6 space-y-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Codes refresh every 30 seconds in your authenticator app
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Lost your device?{' '}
              <button 
                type="button"
                className="text-blue-600 hover:text-blue-700 font-medium"
                onClick={() => toast.info('Backup code feature coming soon!')}
              >
                Use backup code
              </button>
            </p>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>
    </div>
  );
}
