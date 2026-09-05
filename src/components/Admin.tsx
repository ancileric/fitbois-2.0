import React, { useState } from 'react';
import { User, WorkoutDay, AdminSettings } from '../types';
import {
  Users,
  Edit,
  Trash2,
  UserPlus,
  RotateCcw,
  UserCheck
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './ToastContext';
import { getCurrentWeek } from '../utils/dateUtils';

interface AdminProps {
  users: User[];
  workoutDays: WorkoutDay[];
  adminSettings: AdminSettings;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateWorkoutDay: (workoutDay: WorkoutDay) => void;
  onRecalculateConsistency?: () => void;
}

const Admin: React.FC<AdminProps> = ({
  users,
  workoutDays,
  adminSettings,
  onUpdateUser,
  onDeleteUser,
  onRecalculateConsistency,
}) => {
  const { showToast } = useToast();
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [newUser, setNewUser] = useState({
    name: '',
    avatar: '',
    cleanWeeks: 0,
    missedWeeks: 0,
    isActive: true,
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
      // Everyone opens at the cheapest price, active, on the group's default clock.
      priceLevel: 1,
      cleanWeeks: newUser.cleanWeeks,
      missedWeeks: newUser.missedWeeks,
      standing: 'active',
      cutoffHour: 0,
      weekEndDay: 7,
      isActive: newUser.isActive,
    };

    console.log('📤 Sending user to API:', userToAdd);
    onUpdateUser(userToAdd);
    setNewUser({ name: '', avatar: '', cleanWeeks: 0, missedWeeks: 0, isActive: true });
    setShowAddUser(false);
  };

  // Edit user
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewUser({
      name: user.name,
      avatar: user.avatar || '',
      cleanWeeks: user.cleanWeeks,
      missedWeeks: user.missedWeeks,
      isActive: user.isActive,
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
      cleanWeeks: newUser.cleanWeeks,
      missedWeeks: newUser.missedWeeks,
      isActive: newUser.isActive,
    };

    onUpdateUser(updatedUser);
    setEditingUser(null);
    setNewUser({
      name: '',
      avatar: '',
      cleanWeeks: 0,
      missedWeeks: 0,
      isActive: true,
    });
    setShowAddUser(false);
  };

  // Delete user (deactivate)
  const handleDeactivateUser = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Participant',
      message: `Are you sure you want to remove ${user.name} from the challenge? This will delete all their data.`,
      onConfirm: () => {
        onDeleteUser(user.id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Weekly stats calculations moved to Workout component

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Admin</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddUser(true)}
            className="bg-primary-500 text-paper px-3 py-2 rounded-lg hover:bg-primary-600 flex items-center space-x-2"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add User</span>
          </button>
          <button
            onClick={() => {
              if (onRecalculateConsistency) {
                onRecalculateConsistency();
                showToast('Consistency metrics recalculated', 'success');
              }
            }}
            className="bg-paper-sunk text-ink px-3 py-2 rounded-lg hover:bg-line flex items-center space-x-2"
          >
            <RotateCcw size={18} />
            <span className="hidden sm:inline">Recalc</span>
          </button>
        </div>
      </div>

      {/* What the season looks like right now, straight off the sheet. */}
      <section className=" p-4 mb-4">
        <h3 className="display text-xl mb-3">Season at a glance</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-line border border-line rounded-lg overflow-hidden">
          <div className="bg-paper-card px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Week</dt>
            <dd className="display text-2xl tnum mt-0.5">{adminSettings.currentWeek}</dd>
          </div>
          <div className="bg-paper-card px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Active</dt>
            <dd className="display text-2xl tnum mt-0.5 text-clean-600">
              {users.filter((u) => u.standing === 'active').length}
            </dd>
          </div>
          <div className="bg-paper-card px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Suspended</dt>
            <dd className="display text-2xl tnum mt-0.5 text-skip-600">
              {users.filter((u) => u.standing === 'suspended').length}
            </dd>
          </div>
          <div className="bg-paper-card px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Out</dt>
            <dd className="display text-2xl tnum mt-0.5 text-owed-600">
              {users.filter((u) => u.standing === 'out').length}
            </dd>
          </div>
          <div className="bg-paper-card px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">At ₹2,000</dt>
            <dd className="display text-2xl tnum mt-0.5">
              {users.filter((u) => u.priceLevel === 3).length}
            </dd>
          </div>
        </dl>
      </section>

      {/* Users Table - Always visible */}
      <div className="pb-2">

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {users.sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
              <div key={user.id} className="border border-line rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-500 text-paper rounded-full flex items-center justify-center">
                      {user.avatar || user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-ink">{user.name}</div>
                      <div className="text-xs text-ink-muted tnum">₹{(user.priceLevel === 3 ? 2000 : user.priceLevel === 2 ? 1000 : 500).toLocaleString('en-IN')} a miss</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.isActive
                      ? 'bg-clean-100 text-green-800'
                      : 'bg-owed-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-clean-50 rounded p-2">
                    <div className="text-sm font-bold text-clean-600">{user.cleanWeeks}</div>
                    <div className="text-[10px] text-clean-700">Clean</div>
                  </div>
                  <div className="bg-owed-50 rounded p-2">
                    <div className="text-sm font-bold text-owed-600">{user.missedWeeks}</div>
                    <div className="text-[10px] text-owed-600">Missed</div>
                  </div>
                  <div className="bg-paper-sunk rounded p-2">
                    <div className="text-sm font-bold text-ink tnum">
                      ₹{(user.priceLevel === 3 ? 2000 : user.priceLevel === 2 ? 1000 : 500).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-ink-muted">A miss</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="flex-1 bg-paper-sunk text-blue-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-200 flex items-center justify-center space-x-1"
                  >
                    <Edit size={14} />
                    <span>Edit</span>
                  </button>
                  {user.isActive ? (
                    <button
                      onClick={() => handleDeactivateUser(user)}
                      className="flex-1 bg-owed-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-200 flex items-center justify-center space-x-1"
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  ) : (
                    <span className="flex-1 text-xs text-ink-muted text-center py-2">
                      Out for the season — no buy-backs
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-3 px-4 font-medium text-ink">Name</th>
                  <th className="text-center py-3 px-4 font-medium text-ink">Avatar</th>
                  <th className="text-center py-3 px-4 font-medium text-ink">Miss costs</th>
                  <th className="text-center py-3 px-4 font-medium text-ink">Clean Weeks</th>
                  <th className="text-center py-3 px-4 font-medium text-ink">Missed Weeks</th>
                                    <th className="text-center py-3 px-4 font-medium text-ink">Status</th>
                                    <th className="text-center py-3 px-4 font-medium text-ink">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
                  <tr key={user.id} className="border-b border-line-soft hover:bg-paper-sunk">
                    <td className="py-4 px-4">
                      <div className="font-medium text-ink">{user.name}</div>
                      <div className="text-sm text-ink-muted">ID: {user.id}</div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <div className="w-10 h-10 bg-primary-500 text-paper rounded-full flex items-center justify-center mx-auto">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="px-3 py-1 bg-paper-sunk text-ink text-sm font-medium rounded-full">
                        ₹{(user.priceLevel === 3 ? 2000 : user.priceLevel === 2 ? 1000 : 500).toLocaleString('en-IN')}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="text-clean-600 font-medium">{user.cleanWeeks}</span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="text-owed-600 font-medium">{user.missedWeeks}</span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-clean-100 text-green-800'
                          : 'bg-owed-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-blue-600 hover:bg-paper-sunk rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit size={16} />
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => handleDeactivateUser(user)}
                            className="p-2 text-owed-600 hover:bg-owed-100 rounded-lg transition-colors"
                            title="Remove user"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-ink-muted">Out</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 text-ink-muted">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No users found. Add your first participant!</p>
            </div>
          )}
        </div>

      {/* Add/Edit User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-paper-card rounded-xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-ink mb-4">
              {editingUser ? 'Edit Participant' : 'Add New Participant'}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Name *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2"
                    placeholder="Enter participant name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Avatar (emoji/letter)</label>
                  <input
                    type="text"
                    value={newUser.avatar}
                    onChange={(e) => setNewUser({ ...newUser, avatar: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2"
                    placeholder="😊 or A"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Clean Weeks</label>
                  <input
                    type="number"
                    min="0"
                    value={newUser.cleanWeeks}
                    onChange={(e) => setNewUser({ ...newUser, cleanWeeks: Number(e.target.value) })}
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Missed Weeks</label>
                  <input
                    type="number"
                    min="0"
                    value={newUser.missedWeeks}
                    onChange={(e) => setNewUser({ ...newUser, missedWeeks: Number(e.target.value) })}
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Status</label>
                  <select
                    value={newUser.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setNewUser({ ...newUser, isActive: e.target.value === 'active' })}
                    className="w-full border border-line rounded-lg px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setEditingUser(null);
                  setNewUser({
                    name: '',
                    avatar: '',
                    cleanWeeks: 0,
                    missedWeeks: 0,
                    isActive: true,
                  });
                }}
                className="flex-1 border border-line text-ink px-4 py-2 rounded-lg hover:bg-paper-sunk"
              >
                Cancel
              </button>
              <button
                onClick={editingUser ? handleSaveUser : handleAddUser}
                disabled={!newUser.name.trim()}
                className="flex-1 bg-primary-500 text-paper px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {editingUser ? 'Save Changes' : 'Add Participant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivation Modal */}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Remove"
        isDestructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Admin;