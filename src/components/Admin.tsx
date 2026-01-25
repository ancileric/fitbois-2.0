import React, { useState } from 'react';
import { User, WorkoutDay, AdminSettings } from '../types';
// Date utilities moved to Workout component
// Database operations are handled through the API service
import { 
  CheckCircle, 
  Users, 
  Edit,
  Trash2,
  UserPlus,
  Download,
  RotateCcw
} from 'lucide-react';

interface AdminProps {
  users: User[];
  workoutDays: WorkoutDay[];
  adminSettings: AdminSettings;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateWorkoutDay: (workoutDay: WorkoutDay) => void;
  onUpdateAdminSettings: (settings: AdminSettings) => void;
  onRecalculateConsistency?: () => void;
}

const Admin: React.FC<AdminProps> = ({
  users,
  workoutDays,
  adminSettings,
  onUpdateUser,
  onDeleteUser,
  onUpdateWorkoutDay,
  onUpdateAdminSettings,
  onRecalculateConsistency,
}) => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showUsersTable, setShowUsersTable] = useState(false);
  const [showWorkoutStats, setShowWorkoutStats] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    avatar: '',
    currentConsistencyLevel: 5 as 3 | 4 | 5,
    cleanWeeks: 0,
    missedWeeks: 0,
    isActive: true,
    specialRules: {
      startingLevel: undefined as number | undefined
    }
  });

  // Admin-specific calculations (workout tracking moved to Workout component)

  // Workout tracking functions moved to Workout component

  // Weekly stats functions moved to Workout component

  // Add new user
  const handleAddUser = () => {
    if (!newUser.name.trim()) return;

    console.log('👤 Adding new user:', newUser);

    const userToAdd: User = {
      id: `user-${Date.now()}`, // This will be replaced by the database
      name: newUser.name,
      avatar: newUser.avatar || newUser.name.charAt(0).toUpperCase(),
      startDate: adminSettings.challengeStartDate,
      currentConsistencyLevel: newUser.currentConsistencyLevel,
      cleanWeeks: newUser.cleanWeeks,
      missedWeeks: newUser.missedWeeks,
      totalPoints: 0,
      isActive: newUser.isActive,
      specialRules: newUser.specialRules.startingLevel ? {
        startingLevel: newUser.specialRules.startingLevel
      } : undefined,
    };

    console.log('📤 Sending user to API:', userToAdd);
    onUpdateUser(userToAdd);
    setNewUser({
      name: '',
      avatar: '',
      currentConsistencyLevel: 5,
      cleanWeeks: 0,
      missedWeeks: 0,
      isActive: true,
      specialRules: { startingLevel: undefined }
    });
    setShowAddUser(false);
  };

  // Edit user
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewUser({
      name: user.name,
      avatar: user.avatar || '',
      currentConsistencyLevel: user.currentConsistencyLevel,
      cleanWeeks: user.cleanWeeks,
      missedWeeks: user.missedWeeks,
      isActive: user.isActive,
      specialRules: { startingLevel: user.specialRules?.startingLevel }
    });
    setShowAddUser(true);
  };

  // Save edited user
  const handleSaveUser = () => {
    if (!editingUser || !newUser.name.trim()) return;

    const updatedUser: User = {
      ...editingUser,
      name: newUser.name,
      avatar: newUser.avatar || newUser.name.charAt(0).toUpperCase(),
      currentConsistencyLevel: newUser.currentConsistencyLevel,
      cleanWeeks: newUser.cleanWeeks,
      missedWeeks: newUser.missedWeeks,
      isActive: newUser.isActive,
      specialRules: newUser.specialRules.startingLevel ? {
        startingLevel: newUser.specialRules.startingLevel
      } : undefined,
    };

    onUpdateUser(updatedUser);
    setEditingUser(null);
    setNewUser({
      name: '',
      avatar: '',
      currentConsistencyLevel: 5,
      cleanWeeks: 0,
      missedWeeks: 0,
      isActive: true,
      specialRules: { startingLevel: undefined }
    });
    setShowAddUser(false);
  };

  // Delete user (deactivate)
  const handleDeactivateUser = (user: User) => {
    if (window.confirm(`Are you sure you want to remove ${user.name} from the challenge? This will delete all their data.`)) {
      onDeleteUser(user.id);
    }
  };

  // Weekly stats calculations moved to Workout component

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Manage participants and track weekly workouts
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowUsersTable(!showUsersTable)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Users size={18} />
            <span>Manage Users</span>
          </button>
          <button
            onClick={() => setShowWorkoutStats(!showWorkoutStats)}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center space-x-2"
          >
            <CheckCircle size={18} />
            <span>Workout Stats</span>
          </button>
          <button
            onClick={() => setShowAddUser(true)}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 flex items-center space-x-2"
          >
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
          <button
            onClick={() => alert('Database export feature coming soon!')}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2"
          >
            <Download size={18} />
            <span>Export DB</span>
          </button>
          <button
            onClick={() => {
              if (onRecalculateConsistency) {
                onRecalculateConsistency();
                alert('Consistency metrics recalculated for all users!');
              }
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <RotateCcw size={18} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* Data Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <p className="text-sm text-blue-800">
            🗄️ Data is stored in SQLite database: <code className="bg-blue-100 px-1 rounded">backend/database/fitbois.db</code>
          </p>
        </div>
      </div>


      {/* Users Management Table */}
      {showUsersTable && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Users Management</h2>
            <button
              onClick={() => setShowAddUser(true)}
              className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 flex items-center space-x-2"
            >
              <UserPlus size={18} />
              <span>Add New User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Avatar</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Consistency Level</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Clean Weeks</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Missed Weeks</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Total Points</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Special Rules</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">ID: {user.id}</div>
                    </td>
                    
                    <td className="py-4 px-4 text-center">
                      <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center mx-auto">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                        {user.currentConsistencyLevel} days/week
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="text-green-600 font-medium">{user.cleanWeeks}</span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="text-red-600 font-medium">{user.missedWeeks}</span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="text-purple-600 font-medium">{user.totalPoints}</span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      {user.specialRules?.startingLevel ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                          🏆 Starts at {user.specialRules.startingLevel} days
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit size={16} />
                        </button>
                        {user.isActive && (
                          <button
                            onClick={() => handleDeactivateUser(user)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Deactivate user"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No users found. Add your first participant!</p>
            </div>
          )}
        </div>
      )}

      {/* Workout Statistics */}
      {showWorkoutStats && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Workout Statistics</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {users.filter(u => u.isActive).sort((a, b) => a.name.localeCompare(b.name)).map((user) => {
              const userWorkouts = workoutDays.filter(w => w.userId === user.id);
              const completedWorkouts = userWorkouts.filter(w => w.isCompleted).length;
              const totalWorkouts = userWorkouts.length;
              const completionRate = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
              const weeksWithData = new Set(userWorkouts.map(w => w.week)).size;
              
              return (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center">
                      {user.avatar || user.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <p className="text-sm text-gray-500">Level {user.currentConsistencyLevel}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="text-lg font-bold text-green-600">{completedWorkouts}</div>
                      <div className="text-green-700">Completed</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="text-lg font-bold text-blue-600">{completionRate}%</div>
                      <div className="text-blue-700">Success Rate</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="text-lg font-bold text-purple-600">{weeksWithData}</div>
                      <div className="text-purple-700">Weeks Active</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-600">{totalWorkouts}</div>
                      <div className="text-gray-700">Total Days</div>
                    </div>
                  </div>
                  
                  {completionRate > 0 && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 rounded-full h-2 transition-all duration-300"
                          style={{ width: `${completionRate}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {users.filter(u => u.isActive).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No active users found.</p>
            </div>
          )}
        </div>
      )}


      {/* Add/Edit User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingUser ? 'Edit Participant' : 'Add New Participant'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Enter participant name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avatar (emoji/letter)</label>
                  <input
                    type="text"
                    value={newUser.avatar}
                    onChange={(e) => setNewUser({ ...newUser, avatar: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="😊 or A"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consistency Level</label>
                  <select
                    value={newUser.currentConsistencyLevel}
                    onChange={(e) => setNewUser({ ...newUser, currentConsistencyLevel: Number(e.target.value) as 3 | 4 | 5 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value={5}>5 days/week</option>
                    <option value={4}>4 days/week</option>
                    <option value={3}>3 days/week</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clean Weeks</label>
                  <input
                    type="number"
                    min="0"
                    value={newUser.cleanWeeks}
                    onChange={(e) => setNewUser({ ...newUser, cleanWeeks: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Missed Weeks</label>
                  <input
                    type="number"
                    min="0"
                    value={newUser.missedWeeks}
                    onChange={(e) => setNewUser({ ...newUser, missedWeeks: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={newUser.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setNewUser({ ...newUser, isActive: e.target.value === 'active' })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Starting Level</label>
                  <select
                    value={newUser.specialRules.startingLevel || ''}
                    onChange={(e) => setNewUser({ 
                      ...newUser, 
                      specialRules: { 
                        startingLevel: e.target.value ? Number(e.target.value) : undefined 
                      } 
                    })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">None</option>
                    <option value="4">4 days/week (Winner Bonus)</option>
                    <option value="3">3 days/week</option>
                  </select>
                </div>
              </div>

              {newUser.specialRules.startingLevel && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    🏆 This participant will start at {newUser.specialRules.startingLevel} days/week instead of the default 5 days/week.
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setEditingUser(null);
                  setNewUser({
                    name: '',
                    avatar: '',
                    currentConsistencyLevel: 5,
                    cleanWeeks: 0,
                    missedWeeks: 0,
                    isActive: true,
                    specialRules: { startingLevel: undefined }
                  });
                }}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingUser ? handleSaveUser : handleAddUser}
                disabled={!newUser.name.trim()}
                className="flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {editingUser ? 'Save Changes' : 'Add Participant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;