import React from "react";
import { Target, BarChart3, Settings, Dumbbell } from "lucide-react";

interface HeaderProps {
  activeView: string;
  onViewChange: (view: "workout" | "goals" | "dashboard" | "admin") => void;
}

const Header: React.FC<HeaderProps> = ({ activeView, onViewChange }) => {
  const navItems = [
    { id: "workout", label: "Workout", icon: Dumbbell },
    { id: "goals", label: "Goals", icon: Target },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "admin", label: "Admin", icon: Settings },
  ] as const;

  return (
    <>
      {/* Desktop Header */}
      <header className="bg-white border-b border-gray-100 hidden md:block">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900">
                💪 FitBois 2.0
              </h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id as any)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      activeView === item.id
                        ? "bg-primary-500 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Header - Simple title bar */}
      <header className="bg-white border-b border-gray-100 md:hidden">
        <div className="px-4 h-14 flex items-center">
          <h1 className="text-lg font-bold text-gray-900">💪 FitBois 2.0</h1>
        </div>
      </header>

      {/* Mobile Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 pb-safe">
        <div className="flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id as any)}
                className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
                  isActive ? "text-primary-500" : "text-gray-400"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span
                  className={`text-xs mt-1 ${isActive ? "font-semibold" : "font-medium"}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Header;
