import React from "react";
import { User } from "../types";
import { Target, Settings, Dumbbell, IndianRupee } from "lucide-react";

interface HeaderProps {
  activeView: string;
  onViewChange: (view: "season" | "workout" | "goals" | "admin") => void;
  users: User[];
  currentUser: User | null;
  onChangePlayer: (id: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  activeView,
  onViewChange,
  users,
  currentUser,
  onChangePlayer,
}) => {
  const navItems = [
    { id: "season", label: "Season", icon: IndianRupee },
    { id: "workout", label: "Workout", icon: Dumbbell },
    { id: "goals", label: "Goals", icon: Target },
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
                💪 FitBros 3.0
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

            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-gray-400">Playing as</span>
              <select
                value={currentUser?.id ?? ""}
                onChange={(e) => onChangePlayer(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-900"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header - Simple title bar */}
      <header className="bg-white border-b border-gray-100 md:hidden">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-900">💪 FitBros 3.0</h1>
          <select
            value={currentUser?.id ?? ""}
            onChange={(e) => onChangePlayer(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 max-w-[45%]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
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
