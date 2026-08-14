import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { getAllUsers, createUser, updateUser, deleteUser } from '../lib/db';
import { motion } from 'motion/react';
import { UserPlus, Users, Edit2, Trash2, Shield, AlertCircle, LogIn } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard() {
  const { dbUser } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteUserData, setDeleteUserData] = useState<{ id: string; username: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'student' as 'student' | 'teacher' | 'admin',
    teacherId: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setTeachersList(data.filter(u => u.role === 'teacher'));
      if (dbUser?.role === 'teacher') {
        setUsersList(data.filter(u => u.role === 'student' && u.teacherId === dbUser.id));
      } else {
        setUsersList(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingUserId(null);
    setFormData({ name: '', username: '', password: '', role: 'student', teacherId: '' });
    setError('');
    setShowCreate(!showCreate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const payload: any = { ...formData };
      if (dbUser?.role === 'teacher') {
        payload.role = 'student';
        payload.teacherId = dbUser.id;
      }
      
      if (editingUserId) {
        await updateUser(editingUserId, payload);
        setSuccess('User account updated successfully');
      } else {
        if (!formData.password) {
          setError('Password is required for new accounts');
          setSubmitting(false);
          return;
        }
        await createUser(payload);
        setSuccess('User account created successfully');
      }
      setShowCreate(false);
      setEditingUserId(null);
      setFormData({ name: '', username: '', password: '', role: 'student', teacherId: '' });
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAssignTeacher = async (studentId: string, teacherId: string) => {
    try {
      await updateUser(studentId, { teacherId: teacherId || null });
      setSuccess('Teacher linkage updated!');
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to assign teacher');
    }
  };

  const handleStartEdit = (u: any) => {
    setEditingUserId(u.id);
    setFormData({
      name: u.name,
      username: u.username,
      password: '',
      role: u.role,
      teacherId: u.teacherId || ''
    });
    setShowCreate(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserData) return;
    try {
      await deleteUser(deleteUserData.id);
      setSuccess(`User @${deleteUserData.username} deleted`);
      setDeleteUserData(null);
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
      setDeleteUserData(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 flex items-center">
            <Users className="w-6 h-6 mr-2 text-indigo-400" />
            User Account & Teacher Linkage Management
          </h2>
          <p className="text-sm text-slate-400">
            Manage user accounts, assign students to specific teachers directly from the list, and control access.
          </p>
        </div>

        <button 
          onClick={handleOpenCreateModal}
          className="gradient-btn px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center w-full sm:w-fit shadow-lg"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {showCreate ? 'Close Form' : 'Create Account'}
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl font-medium">
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 text-red-300 text-sm rounded-xl flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {showCreate && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleSubmit}
          autoComplete="off"
          className="glass-card p-4 sm:p-6 rounded-2xl space-y-4"
        >
          <h3 className="text-base sm:text-lg font-semibold border-b border-slate-800 pb-3">
            {editingUserId ? 'Edit Account Details' : 'New User Registration'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
              <input 
                type="text" 
                required 
                autoComplete="off"
                className="w-full glass-input px-4 py-2 rounded-xl text-sm"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Username (Login ID)</label>
              <input 
                type="text" 
                required 
                autoComplete="off"
                className="w-full glass-input px-4 py-2 rounded-xl text-sm"
                placeholder="e.g. johndoe"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Password {editingUserId && '(leave blank to keep current password)'}
              </label>
              <input 
                type="password" 
                required={!editingUserId}
                autoComplete="new-password"
                className="w-full glass-input px-4 py-2 rounded-xl text-sm"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
              <select 
                className="w-full glass-input px-4 py-2 rounded-xl text-sm appearance-none bg-slate-900"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value as any })}
              >
                <option value="student">Student</option>
                {dbUser?.role === 'admin' && <option value="teacher">Teacher</option>}
                {dbUser?.role === 'admin' && <option value="admin">Admin</option>}
              </select>
            </div>

            {formData.role === 'student' && dbUser?.role === 'admin' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-indigo-300 mb-1">Assigned Teacher (Teacher Linkage)</label>
                <select 
                  className="w-full glass-input px-4 py-2 rounded-xl text-sm appearance-none bg-slate-900"
                  value={formData.teacherId}
                  onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                >
                  <option value="">-- Unassigned --</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>Teacher: {t.name} (@{t.username})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button 
              type="button" 
              onClick={() => { setShowCreate(false); setEditingUserId(null); }}
              className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className="gradient-btn px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-60"
            >
              {submitting ? 'Saving...' : editingUserId ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </motion.form>
      )}

      <div className="glass-card rounded-2xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider bg-slate-900/60">
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Username</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">Link Student to Teacher</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {usersList.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-200">{u.name}</td>
                <td className="px-6 py-4 font-mono text-slate-400">@{u.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    u.role === 'admin' 
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : u.role === 'teacher'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {u.role === 'student' ? (
                    <select
                      value={u.teacherId || ''}
                      onChange={e => handleQuickAssignTeacher(u.id, e.target.value)}
                      className="glass-input px-3 py-1 rounded-lg text-xs bg-slate-900 text-indigo-200 border border-indigo-500/40"
                    >
                      <option value="">-- Unassigned --</option>
                      {teachersList.map(t => (
                        <option key={t.id} value={t.id}>Teacher: {t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500">Staff Account</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right flex items-center justify-end space-x-3">
                  <button 
                    onClick={() => handleStartEdit(u)}
                    className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                    title="Edit User"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {u.id !== dbUser?.id && (
                    <button 
                      onClick={() => setDeleteUserData({ id: u.id, username: u.username })}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {usersList.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No user accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal 
        isOpen={deleteUserData !== null}
        title="Delete Account"
        message={`Are you sure you want to delete the user account "${deleteUserData?.username}"? All submissions associated with this account will be removed.`}
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setDeleteUserData(null)}
      />
    </div>
  );
}
