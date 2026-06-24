import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { insforge } from '../lib/insforge';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';
  const brandName = import.meta.env.VITE_BRAND_NAME || 'Kasir App';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await insforge.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!data || !data.user) throw new Error('User not found');

      // Verify user is active staff
      const { data: userData, error: userError } = await insforge.database
        .from('users')
        .select('role, is_active')
        .eq('id', data.user?.id)
        .single();

      if (userError) throw userError;

      if (!userData.is_active) {
        await insforge.auth.signOut();
        throw new Error('Your account is inactive. Please contact your manager.');
      }

      if (userData?.role === 'OWNER') {
        await insforge.auth.signOut();
        throw new Error('Owner should use dashboard.');
      }

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: primaryColor }}>
            {brandName}
          </h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to your staff account</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md px-4 py-2 text-white font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
