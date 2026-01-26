import React, { useState, useMemo } from 'react';
import { User, Goal, WeeklyUpdate, Proof, WorkoutDay } from '../types';
import { getCurrentWeek, getChallengeProgress, getDaysUntilStart } from '../utils/dateUtils';
import { Calendar, Users, ChevronDown, ChevronUp } from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  users: User[];
  goals: Goal[];
  weeklyUpdates: WeeklyUpdate[];
  proofs: Proof[];
  workoutDays: WorkoutDay[];
}

interface HeatmapDay {
  date: string;
  dayOfWeek: number;
  weekNumber: number;
  isCompleted: boolean;
  workoutType?: string;
  goalsCompleted: number;
  month: number;
  day: number;
}

interface HeatmapWeek {
  weekNumber: number;
  days: (HeatmapDay | null)[];
  metWeeklyGoal: boolean;
  totalWorkouts: number;
}

interface HeatmapMonth {
  month: number;
  name: string;
  startCol: number;
  endCol: number;
  width: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  users,
  goals,
  weeklyUpdates,
  proofs,
  workoutDays
}) => {
  const [selectedHeatmapUser, setSelectedHeatmapUser] = useState<string>(users[0]?.id || '');
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  // Calculate current week and challenge progress
  const currentWeek = getCurrentWeek();
  const { progressPercentage } = getChallengeProgress();
  const activeParticipants = users.filter(u => u.isActive).length;

  // Calculate leaderboard data
  const leaderboardData = useMemo(() => {
    return users
      .filter(u => u.isActive)
      .sort((a, b) => a.name.localeCompare(b.name)) // Start with alphabetical base
      .map(user => {
        const userGoals = goals.filter(g => g.userId === user.id);
        const completedGoals = userGoals.filter(g => g.isCompleted).length;
        
        // Categories covered = count of completed goals (can be > 5 with multiple sets)
        // This represents total goal achievements across all attempts
        const categoriesCovered = completedGoals;
        
        return {
          ...user,
          completedGoals,
          categoriesCovered,
          consistencyScore: user.cleanWeeks * 10 - user.missedWeeks * 5,
        };
      })
      .sort((a, b) => {
        // Sort by points, then consistency, then alphabetically
        // Note: Points already include completed goals (1 point each) + clean weeks (1 point each)
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.consistencyScore !== a.consistencyScore) return b.consistencyScore - a.consistencyScore;
        return a.name.localeCompare(b.name); // Alphabetical tiebreaker
      });
  }, [users, goals]);

  // Get bottom 2 performers for risk highlighting
  const bottomPerformers = leaderboardData.slice(-2).map(u => u.id);

  // Calculate heatmap data for selected user (GitHub-style layout)
  const heatmapData = useMemo(() => {
    if (!selectedHeatmapUser) return { weeks: [] as HeatmapWeek[], months: [] as HeatmapMonth[] };
    
    const user = users.find(u => u.id === selectedHeatmapUser);
    if (!user) return { weeks: [] as HeatmapWeek[], months: [] as HeatmapMonth[] };
    
    const startDate = new Date('2026-01-19'); // Sunday, January 19, 2026
    const endDate = new Date('2026-07-31');
    
    // Generate all weeks from start to end
    const weeks: HeatmapWeek[] = [];
    const months: HeatmapMonth[] = [];
    
    let currentDate = new Date(startDate);
    let weekIndex = 0;
    
    while (currentDate <= endDate) {
      const weekDays: (HeatmapDay | null)[] = [];
      const weekNumber = weekIndex + 1;
      
      // Create 7 days for this week (Sunday to Saturday)
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Find workout for this day
          const workout = workoutDays.find(w => 
            w.userId === selectedHeatmapUser && 
            w.date === dateStr
          );
          
          // Find goals completed on this day
          const goalsCompletedToday = goals.filter(g => 
            g.userId === selectedHeatmapUser && 
            g.isCompleted && 
            g.completedDate === dateStr
          ).length;
          
          weekDays.push({
            date: dateStr,
            dayOfWeek,
            weekNumber,
            isCompleted: workout?.isCompleted || false,
            workoutType: workout?.workoutType,
            goalsCompleted: goalsCompletedToday,
            month: currentDate.getMonth(),
            day: currentDate.getDate()
          });
          
          currentDate.setDate(currentDate.getDate() + 1);
        } else {
          weekDays.push(null);
        }
      }
      
      // Calculate if weekly goal was met
      const completedWorkouts = weekDays.filter((d): d is HeatmapDay => d?.isCompleted || false).length;
      const metWeeklyGoal = completedWorkouts >= user.currentConsistencyLevel;
      
      weeks.push({
        weekNumber,
        days: weekDays,
        metWeeklyGoal,
        totalWorkouts: completedWorkouts
      });
      
      weekIndex++;
    }
    
    // Calculate month headers based on actual calendar positioning
    let currentMonth = -1;
    let monthStartWeek = 0;
    
    weeks.forEach((week, weekIndex) => {
      // Check the first day of the week to see if we're in a new month
      const firstDay = week.days.find(d => d !== null);
      if (firstDay && firstDay.month !== currentMonth) {
        // If we have a previous month, finalize it
        if (currentMonth !== -1) {
          months.push({
            month: currentMonth,
            name: new Date(2026, currentMonth).toLocaleString('default', { month: 'short' }),
            startCol: monthStartWeek,
            endCol: weekIndex - 1,
            width: weekIndex - monthStartWeek
          });
        }
        
        currentMonth = firstDay.month;
        monthStartWeek = weekIndex;
      }
    });
    
    // Add the final month
    if (currentMonth !== -1) {
      months.push({
        month: currentMonth,
        name: new Date(2026, currentMonth).toLocaleString('default', { month: 'short' }),
        startCol: monthStartWeek,
        endCol: weeks.length - 1,
        width: weeks.length - monthStartWeek
      });
    }
    
    return { weeks, months };
  }, [selectedHeatmapUser, users, workoutDays, goals]);

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="mt-4 bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {currentWeek > 0 ? `Week ${currentWeek}` : getDaysUntilStart() > 0 ? `Starts in ${getDaysUntilStart()} days` : 'Starting today'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{activeParticipants} active</span>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-900">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-primary-500 rounded-full h-2 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Leaderboard</h2>
        <div className="space-y-3">
          {leaderboardData.map((user, index) => {
            const isAtRisk = bottomPerformers.includes(user.id);
            return (
              <div
                key={user.id}
                className={`p-3 md:p-4 rounded-lg border-2 transition-colors ${
                  isAtRisk
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Mobile Layout */}
                <div className="md:hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-base font-bold text-gray-500 w-6">
                        #{index + 1}
                      </div>
                      <div className="w-9 h-9 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{user.name}</h3>
                        <p className="text-xs text-gray-500">Level {user.currentConsistencyLevel}</p>
                      </div>
                    </div>
                    {isAtRisk && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                        ⚠️
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-sm font-bold text-green-600">{user.cleanWeeks}</div>
                      <div className="text-[10px] text-gray-500">Clean</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-red-600">{user.missedWeeks}</div>
                      <div className="text-[10px] text-gray-500">Missed</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-blue-600">{user.completedGoals}</div>
                      <div className="text-[10px] text-gray-500">Goals</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-purple-600">{user.totalPoints}</div>
                      <div className="text-[10px] text-gray-500">Points</div>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:flex md:items-center md:justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-lg font-bold text-gray-500 w-8">
                      #{index + 1}
                    </div>
                    <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center">
                      {user.avatar || user.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <p className="text-sm text-gray-500">Level {user.currentConsistencyLevel}</p>
                    </div>
                    {isAtRisk && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                        ⚠️ At Risk
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-6 text-center">
                    <div>
                      <div className="text-lg font-bold text-green-600">{user.cleanWeeks}</div>
                      <div className="text-xs text-gray-500">Clean Weeks</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-600">{user.missedWeeks}</div>
                      <div className="text-xs text-gray-500">Missed Weeks</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">{user.completedGoals}</div>
                      <div className="text-xs text-gray-500">Goals Done</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">{user.totalPoints}</div>
                      <div className="text-xs text-gray-500">Points</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Heatmap - Collapsible */}
      <div className="bg-white rounded-xl border border-gray-100">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <h2 className="text-lg font-semibold text-gray-900">Activity Heatmap</h2>
          {showHeatmap ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showHeatmap && (
          <div className="px-4 pb-4">
            {/* User Selector */}
            <div className="relative mb-4">
              <select
                value={selectedHeatmapUser}
                onChange={(e) => setSelectedHeatmapUser(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto"
              >
                {users.filter(u => u.isActive).sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.avatar} {user.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* GitHub-style Heatmap - Scrollable on mobile */}
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div style={{ minWidth: '600px' }}>
            {/* Month headers - distributed across full width */}
            <div className="flex mb-3 w-full">
              <div className="w-10 md:w-16 flex-shrink-0"></div> {/* Space for day labels */}
              <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, 1fr)` }}>
                {heatmapData.weeks.map((week, weekIndex) => {
                  // Find the first day of this week to determine the month
                  const firstDay = week.days.find(d => d !== null);
                  const isFirstWeekOfMonth = heatmapData.months.some(m => m.startCol === weekIndex);

                  return (
                    <div key={weekIndex} className="text-center">
                      {isFirstWeekOfMonth && firstDay && (
                        <div className="text-xs md:text-sm text-gray-700 font-medium">
                          {new Date(2026, firstDay.month).toLocaleString('default', { month: 'short' })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main heatmap container */}
            <div className="flex w-full">
              {/* Day of week labels on the left */}
              <div className="w-10 md:w-16 flex-shrink-0 flex flex-col justify-start pr-1 md:pr-3">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div
                    key={i}
                    className="flex items-center text-xs md:text-sm text-gray-600 text-right"
                    style={{ height: '20px', marginBottom: '2px' }}
                  >
                    <span className="md:hidden">{day}</span>
                    <span className="hidden md:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                  </div>
                ))}
              </div>

              {/* Heatmap grid - distributed across full width */}
              <div className="flex-1 grid gap-0.5 md:gap-1" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, 1fr)` }}>
                {heatmapData.weeks.map((week) => (
                  <div key={week.weekNumber} className="flex flex-col space-y-0.5 justify-start">
                    {week.days.map((day, dayIndex) => {
                      if (!day) {
                        return (
                          <div
                            key={`${week.weekNumber}-empty-${dayIndex}`}
                            className="w-full aspect-square"
                            style={{ maxWidth: '20px', maxHeight: '20px' }}
                          ></div>
                        );
                      }

                      // Color logic based on your specifications
                      let cellColor = 'bg-gray-100 border border-gray-200'; // Default: no workout

                      if (day.isCompleted) {
                        if (week.metWeeklyGoal) {
                          cellColor = 'bg-green-600 border border-green-700'; // Dark green: workout + weekly goal met
                        } else {
                          cellColor = 'bg-green-300 border border-green-400'; // Light green: workout but weekly goal not met
                        }
                      }

                      // Special shade for goal completion
                      if (day.goalsCompleted > 0) {
                        cellColor = 'bg-green-400 border-2 border-yellow-400';
                      }

                      return (
                        <div
                          key={`${week.weekNumber}-${day.dayOfWeek}`}
                          className={`w-full aspect-square rounded-sm ${cellColor} transition-all cursor-pointer hover:scale-105`}
                          style={{ maxWidth: '20px', maxHeight: '20px' }}
                          title={`${day.date}: ${
                            day.isCompleted
                              ? `✅ Workout completed${day.workoutType ? ` (${day.workoutType})` : ''}${
                                  week.metWeeklyGoal ? ' | 🎯 Weekly goal met' : ''
                                }`
                              : '❌ No workout'
                          }${day.goalsCompleted > 0 ? ` | 🏆 ${day.goalsCompleted} goal(s) completed` : ''}`}
                        ></div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-4 md:mt-6 flex flex-wrap gap-3 md:gap-6 text-xs md:text-sm text-gray-600">
          <span>
            <strong>{heatmapData.weeks.filter(w => w.metWeeklyGoal).length}</strong> weeks completed
          </span>
          <span>
            <strong>{heatmapData.weeks.reduce((sum, w) => sum + w.totalWorkouts, 0)}</strong> total workouts
          </span>
          <span>
            <strong>{goals.filter(g => g.userId === selectedHeatmapUser && g.isCompleted).length}</strong> goals achieved
          </span>
        </div>

            {/* Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t gap-3">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-600">Less</span>
                <div className="flex items-center space-x-0.5">
                  <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-200 border border-green-300 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-300 border border-green-400 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-500 border border-green-600 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-600 border border-green-700 rounded-sm"></div>
                </div>
                <span className="text-gray-600">More</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 border-2 border-yellow-400 rounded-sm"></div>
                <span className="text-gray-600 text-xs">Goal completed</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;