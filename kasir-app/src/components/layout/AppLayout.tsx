// @ts-nocheck
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, History, Clock, Settings } from 'lucide-react';
import { useCartStore } from '../../store/useCartStore';
import { getContrastColor } from '../../lib/utils';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const cartItemsCount = useCartStore((state) => state.totalItems());
  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';
  const brandName = import.meta.env.VITE_BRAND_NAME || 'Kasir';

  const tabs = [
    { name: 'POS', path: '/', icon: ShoppingBag },
    { name: 'History', path: '/history', icon: History },
    { name: 'Shift', path: '/shift', icon: Clock },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-full w-24 lg:w-64 flex-col bg-white border-r border-gray-100 py-6">
        <div className="flex items-center justify-center lg:justify-start px-6 mb-10">
          <div 
            className="flex h-10 w-10 items-center justify-center rounded-xl font-bold mr-0 lg:mr-3 shadow-sm"
            style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}
          >
            {brandName.charAt(0)}
          </div>
          <span className="hidden lg:block text-xl font-extrabold tracking-tight text-gray-900">
            {brandName}
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className={`relative flex w-full items-center justify-center lg:justify-start rounded-2xl py-3 px-0 lg:px-4 transition-all duration-200 ${
                  isActive ? 'font-bold' : 'text-gray-500 hover:bg-gray-50'
                }`}
                style={isActive ? {
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                } : {}}
              >
                <Icon className={`h-6 w-6 ${!isActive && 'text-gray-400'}`} />
                <span className="hidden lg:block ml-4 text-sm">{tab.name}</span>
                
                {tab.name === 'POS' && cartItemsCount > 0 && (
                  <span className="absolute top-2 right-2 lg:right-4 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 w-full border-t border-gray-200 bg-white z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className="relative flex flex-1 flex-col items-center justify-center py-3 transition-colors"
                style={{ color: isActive ? primaryColor : '#9CA3AF' }}
              >
                <Icon className={`h-6 w-6 ${isActive ? '' : 'stroke-[1.5]'}`} />
                <span className={`mt-1 text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.name}</span>
                
                {tab.name === 'POS' && cartItemsCount > 0 && (
                  <span className="absolute top-1 right-1/4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
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
