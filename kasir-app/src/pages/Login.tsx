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
  const bgImage = import.meta.env.VITE_LOGIN_BG_IMAGE || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2047&auto=format&fit=crop';

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
    <div className="flex min-h-screen items-center justify-center bg-[#E5EAE9] p-4 md:p-8">
      <div className="flex w-full max-w-[1200px] h-[800px] max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative">
        {/* LEFT COLUMN: Login Form */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-center items-center lg:items-start h-full overflow-y-auto">
          <div className="w-full max-w-sm mx-auto flex flex-col items-center">
            <div className="mb-10 text-center">
              <h2 className="text-xl font-bold mb-6" style={{ color: primaryColor }}>
                {brandName}
              </h2>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
                Welcome<br />back
              </h1>
              <p className="mt-4 font-medium text-gray-500">Sign in to your staff account</p>
            </div>

            {error && (
              <div className="mb-6 w-full rounded-2xl bg-red-50 p-4 text-center text-sm font-medium text-red-500">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="w-full space-y-5">
              <div className="space-y-1">
                <input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  required
                  className="w-full h-14 bg-gray-100/80 border-0 rounded-full px-6 text-base focus-visible:outline-none focus:ring-2 focus:ring-offset-0 focus:bg-white transition-all placeholder:text-gray-400 font-medium"
                  style={{ '--tw-ring-color': primaryColor } as any}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1 relative">
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  required
                  className="w-full h-14 bg-gray-100/80 border-0 rounded-full px-6 pr-12 text-base focus-visible:outline-none focus:ring-2 focus:ring-offset-0 focus:bg-white transition-all placeholder:text-gray-400 font-medium"
                  style={{ '--tw-ring-color': primaryColor } as any}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full text-lg text-white font-bold shadow-lg mt-8 hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? 'Signing in...' : 'Start'}
              </button>
            </form>

            <div className="mt-10 text-gray-500 font-medium text-sm">
              Lost password? <span className="text-gray-900 font-bold cursor-pointer">Contact Manager</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Image Area */}
        <div className="hidden lg:block w-1/2 p-4 h-full relative">
          <div 
            className="w-full h-full rounded-[2rem] overflow-hidden bg-cover bg-center shadow-inner relative"
            style={{ backgroundImage: `url(${bgImage})` }}
          >
            <div className="absolute inset-0 bg-black/10 mix-blend-multiply"></div>
            
            <div className="absolute top-1/3 left-1/4 bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-white/20 text-sm shadow-xl font-medium">
              Start Shift
            </div>
            <div className="absolute bottom-1/4 right-1/4 bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-white/20 text-sm shadow-xl font-medium">
              Process Orders
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
