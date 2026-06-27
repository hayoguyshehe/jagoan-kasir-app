import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';

import { getContrastColor } from '../lib/utils';

// Idle timeout in milliseconds (7 minutes = 420000ms)
// For testing purposes, you can change this to 5000 (5 seconds)
const IDLE_TIMEOUT_MS = 7 * 60 * 1000; 

export default function LockScreen({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  const resetTimer = () => {
    if (isLocked) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setIsLocked(true);
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    // Initial timer
    resetTimer();

    // Event listeners for activity
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isLocked]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("Not logged in");

      // Verify PIN against the currently logged in user
      const { data: userRow, error: dbError } = await supabase
        .from('users')
        .select('pin')
        .eq('id', userData.user.id)
        .single();

      if (dbError) throw dbError;

      if (userRow.pin !== pin) {
        throw new Error("Invalid PIN");
      }

      setIsLocked(false);
      setPin('');
      resetTimer();
    } catch (err: any) {
      setError(err.message || "Failed to unlock");
    } finally {
      setLoading(false);
    }
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center">
        <div className="h-16 w-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Screen Locked</h2>
        <p className="text-gray-500 text-center text-sm mb-8">
          For your security, the app has been locked due to inactivity. Enter your PIN to unlock.
        </p>

        {error && (
          <div className="w-full bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock} className="w-full">
          <input
            type="password"
            placeholder="Enter PIN"
            required
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full h-14 bg-gray-100 border-0 rounded-xl px-4 text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-offset-0 mb-6"
            style={{ '--tw-ring-color': primaryColor } as any}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-8 h-16 rounded-2xl font-extrabold text-xl shadow-xl shadow-black/20 active:scale-95 transition-all flex items-center justify-center"
            style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
