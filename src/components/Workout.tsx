import React, { useState, useMemo } from 'react';
import { User, WorkoutDay, AdminSettings } from '../types';
import { 
  CheckCircle, 
  XCircle, 
  Users, 
  Calendar
} from 'lucide-react';
import { getCurrentWeek, getDaysUntilStart } from '../utils/dateUtils';

interface WorkoutProps {
  users: User[];
  workoutDays: WorkoutDay[];
  adminSettings: AdminSettings;
  onUpdateWorkoutDay: (workoutDay: WorkoutDay) => void;
}

const Workout: React.FC<WorkoutProps> = ({
  users,
  workoutDays,
  adminSettings,
  onUpdateWorkoutDay,
}) => {
  const [selectedWeek, setSelectedWeek] = useState(1);

  // Calculate current week and total weeks
  const startDate = new Date(adminSettings.challengeStartDate);
  const endDate = new Date(adminSettings.challengeEndDate);
  
  const currentWeek = getCurrentWeek(adminSettings.challengeStartDate);
  const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Get workout data for a specific user, week, and day
  const getWorkoutDay = (userId: string, week: number, dayOfWeek: number): WorkoutDay | null => {
    return workoutDays.find(w => 
      w.userId === userId && 
      w.week === week && 
      w.dayOfWeek === dayOfWeek
    ) || null;
  };

  // Toggle workout completion
  const toggleWorkout = (userId: string, week: number, dayOfWeek: number) => {
    const existing = getWorkoutDay(userId, week, dayOfWeek);
    // Create a new Date object to avoid mutating startDate
    const date = new Date(startDate.getTime());
    date.setDate(date.getDate() + (week - 1) * 7 + (dayOfWeek - 1));

    const workoutDay: WorkoutDay = {
      id: existing?.id || `workout-${userId}-${week}-${dayOfWeek}-${Date.now()}`,
      userId,
      week,
      dayOfWeek,
      date: date.toISOString().split('T')[0],
      isCompleted: existing ? !existing.isCompleted : true,
      markedBy: 'admin',
      timestamp: new Date().toISOString(),
      workoutType: existing?.workoutType,
      notes: existing?.notes,
    };

    onUpdateWorkoutDay(workoutDay);
  };

  // Calculate weekly stats for each user using database data
  const getUserWeekStats = (userId: string, week: number) => {
    const user = users.find(u => u.id === userId);
    const requiredDays = user?.currentConsistencyLevel || 5;
    
    // Get completed workouts from database for this user and week
    const completedWorkouts = workoutDays.filter(w => 
      w.userId === userId && 
      w.week === week && 
      w.isCompleted
    );
    
    const completedDays = completedWorkouts.length;

    return {
      completed: completedDays,
      required: requiredDays,
      isComplete: completedDays >= requiredDays,
    };
  };

  // Stats summary - calculates completion based on individual requirements from database
  const weeklyStats = useMemo(() => {
    return weeks.map(week => {
      const activeUsers = users.filter(u => u.isActive);
      
      if (activeUsers.length === 0) {
        return {
          week,
          totalUsers: 0,
          completedUsers: 0,
          completionRate: 0,
          totalWorkoutsRequired: 0,
          totalWorkoutsCompleted: 0,
        };
      }

      let totalWorkoutsRequired = 0;
      let totalWorkoutsCompleted = 0;
      let usersWhoMetRequirement = 0;

      activeUsers.forEach(user => {
        // Get user's required workouts per week based on their consistency level
        const requiredWorkouts = user.currentConsistencyLevel;
        
        // Get actual completed workouts for this user and week from database
        const userWeekWorkouts = workoutDays.filter(w => 
          w.userId === user.id && 
          w.week === week && 
          w.isCompleted
        );
        
        const completedWorkouts = userWeekWorkouts.length;
        
        totalWorkoutsRequired += requiredWorkouts;
        totalWorkoutsCompleted += completedWorkouts;
        
        // Check if user met their individual requirement
        if (completedWorkouts >= requiredWorkouts) {
          usersWhoMetRequirement++;
        }
      });
      
      return {
        week,
        totalUsers: activeUsers.length,
        completedUsers: usersWhoMetRequirement,
        completionRate: totalWorkoutsRequired > 0 ? (totalWorkoutsCompleted / totalWorkoutsRequired) * 100 : 0,
        totalWorkoutsRequired,
        totalWorkoutsCompleted,
      };
    });
  }, [users, workoutDays, weeks]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Workout Tracking</h1>
        <p className="text-gray-600 mt-1">
          Track daily workouts and weekly progress for all participants
        </p>
      </div>

      {/* 1. Challenge Overview (4 Summary Tiles) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <Users className="w-6 h-6 text-primary-500" />
            <h3 className="font-medium text-gray-900">Total Participants</h3>
          </div>
          <div className="text-2xl font-bold text-primary-600">{users.filter(u => u.isActive).length}</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <Calendar className="w-6 h-6 text-green-500" />
            <h3 className="font-medium text-gray-900">Current Week</h3>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {currentWeek <= 0 ? 'Not Started' : currentWeek}
          </div>
          {currentWeek <= 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Starts in {getDaysUntilStart(adminSettings.challengeStartDate)} days
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="w-6 h-6 text-blue-500" />
            <h3 className="font-medium text-gray-900">Week Completion</h3>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {currentWeek <= 0 
              ? '0%' 
              : (weeklyStats[Math.max(0, currentWeek - 1)]?.completionRate.toFixed(0) || '0') + '%'
            }
          </div>
          {currentWeek > 0 && weeklyStats[Math.max(0, currentWeek - 1)] && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 rounded-full h-1.5 transition-all duration-300"
                  style={{ 
                    width: `${weeklyStats[Math.max(0, currentWeek - 1)].completionRate}%` 
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {weeklyStats[Math.max(0, currentWeek - 1)].totalWorkoutsCompleted}/
                {weeklyStats[Math.max(0, currentWeek - 1)].totalWorkoutsRequired} workouts completed
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle className="w-6 h-6 text-purple-500" />
            <h3 className="font-medium text-gray-900">Challenge Status</h3>
          </div>
          <div className="text-sm font-bold text-purple-600">
            {adminSettings.isActive ? 'ACTIVE' : 'INACTIVE'}
          </div>
        </div>
      </div>

      {/* 2. Week Selector */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Week to Manage</h2>
        <div className="flex flex-wrap gap-2">
          {weeks.slice(0, 12).map((week) => {
            const stats = weeklyStats[week - 1];
            const isCurrent = currentWeek > 0 && week === currentWeek;
            
            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedWeek === week
                    ? 'bg-primary-500 text-white'
                    : isCurrent
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Week {week}
                {isCurrent && <span className="ml-1 text-xs">(Current)</span>}
                <div className="text-xs mt-1">
                  {stats.completedUsers}/{stats.totalUsers}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Workout Tracking Grid */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Week {selectedWeek} Workout Tracking
          </h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Click checkmarks to toggle workout completion
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-blue-600">Database Connected</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900 w-64">Participant</th>
                <th className="text-center py-3 px-3 font-medium text-gray-900 w-16">Level</th>
                {daysOfWeek.map((day, index) => (
                  <th key={day} className="text-center py-3 px-3 font-medium text-gray-900 w-16">
                    {day}
                  </th>
                ))}
                <th className="text-center py-3 px-4 font-medium text-gray-900 w-20">Progress</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.isActive).sort((a, b) => a.name.localeCompare(b.name)).map((user) => {
                const weekStats = getUserWeekStats(user.id, selectedWeek);
                
                return (
                  <tr key={user.id} className={`border-b border-gray-100 transition-colors ${
                    weekStats.isComplete 
                      ? 'bg-green-50 hover:bg-green-100 border-green-200' 
                      : 'hover:bg-gray-50'
                  }`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm">
                          {user.avatar || user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{user.name}</span>
                            {weekStats.isComplete && (
                              <span className="text-green-600 text-sm">✅</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.cleanWeeks} clean weeks
                            {weekStats.isComplete && (
                              <span className="text-green-600 ml-1">• Week completed!</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-3 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {user.currentConsistencyLevel}
                      </span>
                    </td>

                    {daysOfWeek.map((day, dayIndex) => {
                      const workoutDay = getWorkoutDay(user.id, selectedWeek, dayIndex + 1);
                      const isCompleted = workoutDay?.isCompleted || false;
                      
                      return (
                        <td key={day} className="py-4 px-3 text-center">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleWorkout(user.id, selectedWeek, dayIndex + 1)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                isCompleted
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle size={16} />
                              ) : (
                                <XCircle size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className={`text-sm font-medium ${
                          weekStats.isComplete ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {weekStats.completed}/{weekStats.required}
                        </div>
                        {weekStats.isComplete && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Weekly Progress Summary */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Progress Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {weeklyStats.slice(0, 8).map((stats) => (
            <div
              key={stats.week}
              className={`p-4 rounded-lg border ${
                stats.week === currentWeek
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">Week {stats.week}</div>
                <div className="text-sm text-gray-600 mb-2">
                  {stats.completedUsers}/{stats.totalUsers} users met goals
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 rounded-full h-2 transition-all duration-300"
                    style={{ width: `${stats.completionRate}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {stats.completionRate.toFixed(0)}% ({stats.totalWorkoutsCompleted}/{stats.totalWorkoutsRequired})
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Smart Calculation:</strong> Completion % accounts for individual consistency levels 
            (5 days/week = 5 required, 4 days/week = 4 required, etc.)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Workout;