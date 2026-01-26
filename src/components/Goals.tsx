import React, { useState } from 'react';
import { User, Goal, GOAL_CATEGORIES, GoalCategory } from '../types';
import { Target, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface GoalsProps {
  user: User;
  users: User[];
  goals: Goal[];
  onAddGoal: (goal: Goal) => void;
  onUpdateGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
}

const Goals: React.FC<GoalsProps> = ({ user, users, goals, onAddGoal, onUpdateGoal, onDeleteGoal }) => {
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [newGoal, setNewGoal] = useState({
    category: 'cardio' as GoalCategory,
    description: '',
    isDifficult: false,
  });

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Group goals by user (sorted alphabetically)
  const goalsByUser = users.sort((a, b) => a.name.localeCompare(b.name)).map(user => {
    const userGoals = goals.filter(g => g.userId === user.id);
    const activeGoals = userGoals.filter(g => !g.isCompleted);
    const completedGoals = userGoals.filter(g => g.isCompleted);
    const difficultGoals = activeGoals.filter(g => g.isDifficult);
    
    // Check which categories are covered
    const coveredCategories = activeGoals.map(g => g.category);
    const missingCategories = GOAL_CATEGORIES.filter(c => !coveredCategories.includes(c.id as GoalCategory));
    
    return {
      user,
      activeGoals,
      completedGoals,
      difficultGoals,
      totalGoals: userGoals.length,
      missingCategories,
      hasAllCategories: missingCategories.length === 0,
      needsDifficultGoal: activeGoals.length > 0 && difficultGoals.length === 0,
    };
  });

  const handleCompleteGoal = (goal: Goal) => {
    const updatedGoal = {
      ...goal,
      isCompleted: true,
      completedDate: new Date().toISOString().split('T')[0],
    };
    onUpdateGoal(updatedGoal);
  };

  const handleAddGoal = () => {
    if (!newGoal.description.trim() || !selectedUserId) return;

    console.log('🎯 Creating goal for user:', selectedUserId);
    console.log('👥 Available users:', users.map(u => ({ id: u.id, name: u.name })));

    const goal: Goal = {
      id: `goal-${Date.now()}`,
      userId: selectedUserId,
      category: newGoal.category,
      description: newGoal.description,
      isDifficult: newGoal.isDifficult,
      isCompleted: false,
      proofs: [],
      createdDate: new Date().toISOString(),
    };

    console.log('📝 Goal data being sent:', goal);
    onAddGoal(goal);
    setNewGoal({
      category: 'cardio',
      description: '',
      isDifficult: false,
    });
    setSelectedUserId('');
    setShowAddGoal(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
      </div>

      {/* Goals by User - Accordion Format */}
      <div className="space-y-3">
        {goalsByUser.map((userGoals) => {
          const { user, activeGoals, completedGoals, missingCategories, hasAllCategories, needsDifficultGoal } = userGoals;
          const isExpanded = expandedUsers.has(user.id);

          return (
            <div key={user.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* User Header - Clickable */}
              <button
                onClick={() => toggleUserExpanded(user.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm">
                    {user.avatar || user.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{user.name}</h2>
                    <p className="text-xs text-gray-500">
                      {activeGoals.length}/5 goals • {completedGoals.length} completed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Indicators */}
                  {hasAllCategories ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      Complete
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                      {missingCategories.length} missing
                    </span>
                  )}

                  {needsDifficultGoal && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                      ⚠️
                    </span>
                  )}

                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expandable Content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* Alerts for this user */}
                  {(needsDifficultGoal || !hasAllCategories) && (
                    <div className="mt-3 space-y-2">
                      {needsDifficultGoal && (
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-2">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-orange-500" />
                            <p className="text-xs text-orange-700">
                              Needs at least one difficult goal
                            </p>
                          </div>
                        </div>
                      )}

                      {!hasAllCategories && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                          <div className="flex items-center space-x-2">
                            <Target className="w-4 h-4 text-blue-500" />
                            <p className="text-xs text-blue-700">
                              Missing: {missingCategories.map(c => c.name).join(', ')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Goals List */}
                  <div className="mt-3 space-y-2">
                    {GOAL_CATEGORIES.map((category) => {
                    const goal = [...activeGoals, ...completedGoals].find(g => g.category === category.id);

                    return (
                      <div key={category.id} className={`p-3 sm:p-4 rounded-lg border ${
                        goal?.isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}>
                        {/* Mobile Layout */}
                        <div className="sm:hidden">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{category.icon}</span>
                              <div className="font-medium text-gray-900 text-sm">{category.name}</div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {goal?.isDifficult && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                                  Difficult
                                </span>
                              )}
                              {goal?.isCompleted && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                                  ✅
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mb-2">
                            {goal ? (
                              <div className="text-xs text-gray-600">{goal.description}</div>
                            ) : (
                              <div className="text-xs text-gray-400 italic">No goal set</div>
                            )}
                            {goal?.completedDate && (
                              <div className="text-xs text-green-600 mt-1">
                                Completed {new Date(goal.completedDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {goal ? (
                              <>
                                {!goal.isCompleted && (
                                  <button
                                    onClick={() => handleCompleteGoal(goal)}
                                    className="flex-1 bg-green-500 text-white px-2 py-1.5 rounded text-xs hover:bg-green-600"
                                  >
                                    Complete
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: 'Delete Goal',
                                      message: `Are you sure you want to delete this ${category.name} goal?`,
                                      onConfirm: () => {
                                        onDeleteGoal(goal.id);
                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                      }
                                    });
                                  }}
                                  className={`${goal.isCompleted ? 'flex-1' : ''} bg-red-500 text-white px-2 py-1.5 rounded text-xs hover:bg-red-600`}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setNewGoal({ ...newGoal, category: category.id as GoalCategory });
                                  setShowAddGoal(true);
                                }}
                                className="flex-1 bg-primary-500 text-white px-2 py-1.5 rounded text-xs hover:bg-primary-600"
                              >
                                Add Goal
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Desktop Layout */}
                        <div className="hidden sm:flex sm:items-center sm:justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <span className="text-xl">{category.icon}</span>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{category.name}</div>
                              {goal ? (
                                <div className="text-sm text-gray-600">{goal.description}</div>
                              ) : (
                                <div className="text-sm text-gray-400 italic">No goal set for this category</div>
                              )}
                              {goal?.completedDate && (
                                <div className="text-xs text-green-600 mt-1">
                                  ✅ Completed on {new Date(goal.completedDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {goal?.isDifficult && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                                Difficult
                              </span>
                            )}

                            {goal?.isCompleted && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                ✅ Complete
                              </span>
                            )}

                            {goal ? (
                              <div className="flex space-x-2">
                                {!goal.isCompleted && (
                                  <button
                                    onClick={() => handleCompleteGoal(goal)}
                                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                                  >
                                    Complete
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: 'Delete Goal',
                                      message: `Are you sure you want to delete this ${category.name} goal?`,
                                      onConfirm: () => {
                                        onDeleteGoal(goal.id);
                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                      }
                                    });
                                  }}
                                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setNewGoal({ ...newGoal, category: category.id as GoalCategory });
                                  setShowAddGoal(true);
                                }}
                                className="bg-primary-500 text-white px-3 py-1 rounded text-sm hover:bg-primary-600"
                              >
                                Add Goal
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Goal</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Choose a participant...</option>
                  {users.sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.avatar} {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value as GoalCategory })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {GOAL_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
                  placeholder="e.g., Run 5K in under 30 minutes (current best: 32:15)"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDifficult"
                  checked={newGoal.isDifficult}
                  onChange={(e) => setNewGoal({ ...newGoal, isDifficult: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isDifficult" className="text-sm text-gray-700">
                  This is a difficult goal (a real stretch)
                </label>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddGoal(false);
                  setSelectedUserId('');
                  setNewGoal({
                    category: 'cardio',
                    description: '',
                    isDifficult: false,
                  });
                }}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGoal}
                disabled={!newGoal.description.trim() || !selectedUserId}
                className="flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                Add Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Goals;