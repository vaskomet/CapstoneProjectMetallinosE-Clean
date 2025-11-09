import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import TwoFactorLogin from '../components/TwoFactorLogin';
import { toast } from 'react-toastify';

export default function OAuth2FAVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useUser();
  
  const requires2FA = searchParams.get('requires_2fa');
  const email = searchParams.get('email');
  const provider = searchParams.get('provider');

  useEffect(() => {
    // Validate that we have the required parameters
    if (!requires2FA || !email) {
      toast.error('Invalid 2FA verification request');
      navigate('/login');
    }
  }, [requires2FA, email, navigate]);

  const handle2FASuccess = (response) => {
    // Set user in context
    setUser(response.user);
    toast.success(`Welcome back! Logged in via ${provider || 'OAuth'}`);
    navigate('/dashboard');
  };

  const handle2FACancel = () => {
    toast.info('Login cancelled');
    navigate('/login');
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-50 to-indigo-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-2xl">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            2FA Verification Required
          </h2>
          <p className="mt-2 text-gray-600">
            You logged in via {provider || 'OAuth'}, but your account has 2FA enabled
          </p>
        </div>

        <TwoFactorLogin
          email={email}
          onSuccess={handle2FASuccess}
          onCancel={handle2FACancel}
        />
      </div>
    </div>
  );
}
