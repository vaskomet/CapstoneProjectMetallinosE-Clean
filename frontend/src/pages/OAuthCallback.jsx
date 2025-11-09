import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

/**
 * OAuth Callback Handler
 * 
 * This page receives JWT tokens from the backend after successful OAuth authentication
 * and stores them in localStorage, then redirects to the dashboard
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useUser();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Get tokens from URL parameters
      const access = searchParams.get('access');
      const refresh = searchParams.get('refresh');
      const error = searchParams.get('error');

      // Handle error
      if (error) {
        console.error('OAuth error:', error);
        navigate('/register?error=oauth_failed');
        return;
      }

      // Validate tokens
      if (!access || !refresh) {
        console.error('Missing tokens in OAuth callback');
        navigate('/register?error=missing_tokens');
        return;
      }

      try {
        // Store tokens in localStorage (use same keys as login)
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);

        // Fetch user data using the access token
        const response = await fetch('http://localhost:8000/api/auth/profile/', {
          headers: {
            'Authorization': `Bearer ${access}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();

        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(userData));

        // Redirect to profile (page will reload and UserContext will pick up the stored data)
        window.location.href = '/profile';
      } catch (error) {
        console.error('Error processing OAuth callback:', error);
        navigate('/register?error=callback_failed');
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600">
      <div className="text-center text-white">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-4"></div>
        <h2 className="text-2xl font-bold">Completing Sign In...</h2>
        <p className="mt-2">Please wait while we set up your account</p>
      </div>
    </div>
  );
}
