import React from 'react';
import { 
  LayoutDashboard, 
  Trash2, 
  Navigation, 
  BarChart3, 
  Leaf, 
  MapPin, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, urgentCount = 0 }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bins', label: 'Bin Monitoring', icon: Trash2, badge: urgentCount > 0 ? urgentCount : null },
    { id: 'optimizer', label: 'Route Optimizer', icon: Navigation },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-[#E5E8DF] flex flex-col justify-between shrink-0 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-[#E5E8DF]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Custom Brand Logo */}
            <div className="w-10 h-10 rounded-xl bg-[#234C36] flex items-center justify-center text-white shadow-sm ring-2 ring-[#8BA88E]/20">
              <div className="relative">
                <Leaf className="w-5 h-5 text-[#E6EFE5]" />
                <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-[#8BA88E] ring-1 ring-[#234C36]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[17px] tracking-tight text-[#183D2B]"></h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#E6EFE5] text-[#234C36]">
                  PROTOTYPE
                </span>
              </div>
              <p className="text-[11px] text-[#788278] font-medium tracking-tight">Smarter Routes. Cleaner Cities.</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#788278]">
            Platform Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#E6EFE5] text-[#183D2B] font-semibold shadow-xs'
                    : 'text-[#252B26]/80 hover:bg-[#F8F7F1] hover:text-[#183D2B]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#234C36]' : 'text-[#788278]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-[#234C36] text-white' : 'bg-red-100 text-red-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info / Node Status */}
      <div className="p-4 border-t border-[#E5E8DF] bg-[#F8F7F1]/60">
        <div className="p-3 rounded-lg bg-white border border-[#E5E8DF] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#788278] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#234C36]" />
              Sector
            </span>
            <span className="font-semibold text-[#183D2B] text-[11px]">Delhi DTU / Rohini</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#788278] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8BA88E]" />
              Fleet Depots
            </span>
            <span className="font-semibold text-[#183D2B] text-[11px]">1 Active</span>
          </div>
        </div>

      </div>
    </aside>
  );
}
