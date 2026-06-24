// @ts-nocheck
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, History, Clock, Settings } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const cartItemsCount = useCartStore((state) => state.totalItems());
  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';

  const tabs = [
    { name: 'POS', path: '/', icon: ShoppingBag },
    { name: 'History', path: '/history', icon: History },
    { name: 'Shift', path: '/shift', icon: Clock },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen flex-col bg-gray-50 pb-16">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full border-t border-gray-200 bg-white">
        <div className="flex justify-around">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className="relative flex flex-1 flex-col items-center justify-center py-3 transition-colors"
                style={{ color: isActive ? primaryColor : '#6B7280' }}
              >
                <Icon className="h-6 w-6" />
                <span className="mt-1 text-xs font-medium">{tab.name}</span>
                
                {tab.name === 'POS' && cartItemsCount > 0 && (
                  <span className="absolute top-1 right-1/4 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
