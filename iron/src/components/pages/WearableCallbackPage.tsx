import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../../context/userContext';
import { apiWearableConnect } from '../../api';

export default function WearableCallbackPage() {
  const [searchParams] = useSearchParams();
  const { token } = useUser();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const err  = searchParams.get('error');

    if (err || !code) {
      setError(err === 'access_denied' ? 'Access denied. Please try again.' : 'No authorization code received.');
      setStatus('error');
      return;
    }
    if (!token) {
      navigate('/signup');
      return;
    }

    apiWearableConnect(token, code)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/user?tab=settings&settings=appearance'), 1500);
      })
      .catch(e => {
        setError(e.message ?? 'Connection failed');
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 max-w-sm w-full text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="text-4xl animate-pulse">⌚</div>
            <p className="text-white font-black uppercase text-lg">Connecting…</p>
            <p className="text-gray-400 text-sm">Verifying with Google Fit</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl">✅</div>
            <p className="text-white font-black uppercase text-lg">Connected!</p>
            <p className="text-gray-400 text-sm">Google Fit is now linked. Redirecting…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl">❌</div>
            <p className="text-white font-black uppercase text-lg">Connection failed</p>
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => navigate('/user')}
              className="mt-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase"
              style={{ background: '#facc15', color: '#000' }}
            >
              Back to App
            </button>
          </>
        )}
      </div>
    </div>
  );
}
