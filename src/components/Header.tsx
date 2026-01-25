import React from 'react';
import { Target, BarChart3, Settings, Dumbbell } from 'lucide-react';

interface HeaderProps {
  activeView: string;
  onViewChange: (view: 'workout' | 'goals' | 'dashboard' | 'admin') => void;
}

const Header: React.FC<HeaderProps> = ({ activeView, onViewChange }) => {
  const navItems = [
    { id: 'workout', label: 'Workout', icon: Dumbbell },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'admin', label: 'Admin', icon: Settings },
  ] as const;

  return (
    <header className="bg-white shadow-lg border-b-4 border-primary-500">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="text-3xl">💪</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">FitBois 2.0</h1>
              <p className="text-xs text-gray-500">Consistency & Progress</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    activeView === item.id
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex space-x-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    activeView === item.id
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;