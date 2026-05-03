import React, { useState, useMemo } from 'react';
import { Goal, GOAL_CATEGORIES } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface GoalCategoryProgressProps {
  goals: Goal[];
}

const GoalCategoryProgress: React.FC<GoalCategoryProgressProps> = ({ goals }) => {
  const [isOpen, setIsOpen] = useState(true);

  const categoryStats = useMemo(() => {
    return GOAL_CATEGORIES.map((cat) => {
      const catGoals = goals.filter((g) => g.category === cat.id);
      const completed = catGoals.filter((g) => g.isCompleted).length;
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        completed,
        total: catGoals.length,
        pct: catGoals.length > 0 ? (completed / catGoals.length) * 100 : 0,
      };
    });
  }, [goals]);

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">
          Goal Progress by Category
        </h2>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {categoryStats.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </div>
                <span className="text-sm tabular-nums text-gray-500">
                  {cat.completed}/{cat.total}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-500 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${cat.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoalCategoryProgress;
