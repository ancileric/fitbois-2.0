import React, { useState, useMemo } from 'react';
import { User, Goal, WeeklyUpdate, Proof, WorkoutDay } from '../types';
import { getCurrentWeek, getChallengeProgress, getDaysUntilStart } from '../utils/dateUtils';
import { Calendar, Target, Trophy, Users, AlertCircle, ChevronDown } from 'lucide-react';

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
  
  // Calculate current week and challenge progress
  const currentWeek = getCurrentWeek();
  const { daysPassed, totalDays, progressPercentage } = getChallengeProgress();
  
  // Calculate challenge-wide statistics
  const totalGoalsCompleted = goals.filter(g => g.isCompleted).length;
  const activeParticipants = users.filter(u => u.isActive).length;
  const totalWorkoutsThisWeek = workoutDays.filter(w => w.week === currentWeek && w.isCompleted).length;
  
  // Calculate total required workouts for this week
  const totalRequiredThisWeek = users.filter(u => u.isActive).reduce((sum, user) => sum + user.currentConsistencyLevel, 0);

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

  // Identify participants at risk
  const participantsAtRisk = useMemo(() => {
    const atRisk = users.filter(u => u.isActive).filter(user => {
      const userGoals = goals.filter(g => g.userId === user.id);
      const difficultGoals = userGoals.filter(g => g.isDifficult && !g.isCompleted);
      // Note: missingCategories can be used for future risk factor analysis
      // const missingCategories = GOAL_CATEGORIES.length - new Set(userGoals.map(g => g.category)).size;

      return (
        // Risk Factor 1: Elimination danger (1+ missed weeks at 5-day level)
        (user.currentConsistencyLevel === 5 && user.missedWeeks >= 1) ||
        
        // Risk Factor 2: Multiple missed weeks (any level)
        user.missedWeeks >= 2 ||
        
        // Risk Factor 3: No goals set up yet
        userGoals.length === 0 ||
        
        // Risk Factor 4: Incomplete goal set (less than 5 goals)
        (userGoals.length > 0 && userGoals.length < 5) ||
        
        // Risk Factor 5: Missing difficult goal (has goals but none are difficult)
        (userGoals.length > 0 && difficultGoals.length === 0)
        
        // Removed "No completed goals yet" risk factor - not a real risk
      );
    });
    
    return atRisk;
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

  // Overview stats for the challenge
  const overviewStats = [
    {
      title: 'Current Week',
      value: currentWeek > 0 ? currentWeek : 'Not Started',
      subtitle: currentWeek > 0 ? `Week ${currentWeek} of challenge` : getDaysUntilStart() > 0 ? `Starts in ${getDaysUntilStart()} days` : 'Starting today!',
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Participants',
      value: activeParticipants,
      total: users.length,
      subtitle: `${users.length - activeParticipants} eliminated`,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Goals Completed',
      value: totalGoalsCompleted,
      subtitle: `Across all participants`,
      icon: Trophy,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'This Week\'s Progress',
      value: totalRequiredThisWeek > 0 ? `${Math.round((totalWorkoutsThisWeek / totalRequiredThisWeek) * 100)}%` : '0%',
      subtitle: `${totalWorkoutsThisWeek}/${totalRequiredThisWeek} workouts`,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Challenge Overview */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">FitBois 2.0 Dashboard 💪</h1>
        <p className="text-primary-100 mb-4">
          Challenge overview and participant tracking
        </p>
        
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Challenge Progress</span>
            <span className="text-sm">{Math.round(progressPercentage)}% Complete</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-xs text-primary-100 mt-2">
            {daysPassed <= 0 
              ? `Challenge starts today! • Ends July 31, 2026`
              : `Day ${daysPassed} of ${totalDays} • Ends July 31, 2026`
            }
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{stat.title}</h3>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </span>
                  {stat.total && (
                    <span className="text-sm text-gray-500">/ {stat.total}</span>
                  )}
                </div>
                {stat.subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{stat.subtitle}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Leaderboard - All Users */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Leaderboard</h2>
        <div className="space-y-3">
          {leaderboardData.map((user, index) => {
            const isAtRisk = bottomPerformers.includes(user.id);
            return (
              <div
                key={user.id}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  isAtRisk 
                    ? 'border-red-200 bg-red-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
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

      {/* 3. Participants at Risk */}
      {participantsAtRisk.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-red-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <span>Participants at Risk</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {participantsAtRisk.map((user) => {
              const userGoals = goals.filter(g => g.userId === user.id);
              const difficultGoals = userGoals.filter(g => g.isDifficult && !g.isCompleted);
              
              return (
                <div key={user.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm">
                      {user.avatar || user.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-medium text-red-900">{user.name}</h3>
                      <p className="text-sm text-red-700">Level {user.currentConsistencyLevel}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm text-red-800">
                    {user.missedWeeks >= 2 && (
                      <p>• {user.missedWeeks} missed weeks (concerning pattern)</p>
                    )}
                    {user.currentConsistencyLevel === 5 && user.missedWeeks >= 1 && (
                      <p className="font-medium">⚠️ Close to elimination ({user.missedWeeks}/2 missed weeks)</p>
                    )}
                    {userGoals.length === 0 && (
                      <p>• No goals set up yet</p>
                    )}
                    {userGoals.length > 0 && userGoals.length < 5 && (
                      <p>• Incomplete goal set ({userGoals.length}/5 goals)</p>
                    )}
                    {userGoals.length > 0 && difficultGoals.length === 0 && (
                      <p>• Missing difficult goal</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. User Activity Heatmap */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Activity Heatmap</h2>
          
          {/* User Selector */}
          <div className="relative">
            <select
              value={selectedHeatmapUser}
              onChange={(e) => setSelectedHeatmapUser(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {users.filter(u => u.isActive).sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.avatar} {user.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* GitHub-style Heatmap - Full Width */}
        <div className="w-full">
          {/* Calculate total weeks for proper distribution */}
          <div className="relative" style={{ minHeight: '200px' }}>
            {/* Month headers - distributed across full width */}
            <div className="flex mb-3 w-full">
              <div className="w-16"></div> {/* Space for day labels */}
              <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, 1fr)` }}>
                {heatmapData.weeks.map((week, weekIndex) => {
                  // Find the first day of this week to determine the month
                  const firstDay = week.days.find(d => d !== null);
                  const isFirstWeekOfMonth = heatmapData.months.some(m => m.startCol === weekIndex);
                  
                  return (
                    <div key={weekIndex} className="text-center">
                      {isFirstWeekOfMonth && firstDay && (
                        <div className="text-sm text-gray-700 font-medium">
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
              <div className="w-16 flex flex-col justify-start pr-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div 
                    key={day} 
                    className="flex items-center text-sm text-gray-600 text-right"
                    style={{ height: '28px', marginBottom: '2px' }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Heatmap grid - distributed across full width */}
              <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapData.weeks.length}, 1fr)` }}>
                {heatmapData.weeks.map((week) => (
                  <div key={week.weekNumber} className="flex flex-col space-y-0.5 justify-start">
                    {week.days.map((day, dayIndex) => {
                      if (!day) {
                        return (
                          <div
                            key={`${week.weekNumber}-empty-${dayIndex}`}
                            className="w-full aspect-square max-w-7 max-h-7"
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
                          className={`w-full aspect-square max-w-7 max-h-7 rounded-sm ${cellColor} transition-all cursor-pointer hover:scale-105`}
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

            {/* Summary stats */}
            <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-6">
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
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-gray-600">Less</span>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded-sm"></div>
                  <div className="w-4 h-4 bg-green-200 border border-green-300 rounded-sm"></div>
                  <div className="w-4 h-4 bg-green-300 border border-green-400 rounded-sm"></div>
                  <div className="w-4 h-4 bg-green-500 border border-green-600 rounded-sm"></div>
                  <div className="w-4 h-4 bg-green-600 border border-green-700 rounded-sm"></div>
                </div>
                <span className="text-gray-600">More</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-400 border-2 border-yellow-400 rounded-sm"></div>
                <span className="text-gray-600 text-sm">Goal completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;