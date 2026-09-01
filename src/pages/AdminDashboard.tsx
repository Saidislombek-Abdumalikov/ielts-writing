import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { 
  getAllUsers, createUser, updateUser, deleteUser,
  getAllCenters, createCenter, updateCenter, deleteCenter, DbCenter 
} from '../lib/db';
import { motion } from 'motion/react';
import { 
  UserPlus, Users, Edit2, Trash2, Shield, AlertCircle, LogIn, 
  Search, GraduationCap, UserCheck, AlertTriangle, Building2, Plus, CheckCircle2 
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard() {
  const { dbUser, impersonateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'centers'>('users');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [centersList, setCentersList] = useState<DbCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateCenter, setShowCreateCenter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [deleteUserData, setDeleteUserData] = useState<{ id: string; username: string } | null>(null);
  const [deleteCenterData, setDeleteCenterData] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'student' as 'student' | 'teacher',
    teacherId: '',
    centerId: '',
  });

  const [centerFormData, setCenterFormData] = useState({
    name: '',
    code: '',
    address: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, centersData] = await Promise.all([
        getAllUsers(),
        getAllCenters(),
      ]);
      setCentersList(centersData);
      setTeachersList(usersData.filter(u => u.role === 'teacher'));
      if (dbUser?.role === 'teacher') {
        setUsersList(usersData.filter(u => u.role === 'student' && u.teacherId === dbUser.id));
      } else {
        // Exclude system admin accounts so admins are completely hidden from regular rosters
        setUsersList(usersData.filter(u => u.role !== 'admin'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const studentsCount = usersList.filter(u => u.role === 'student').length;
  const teachersCount = usersList.filter(u => u.role === 'teacher').length;
  const unlinkedStudentsCount = usersList.filter(u => u.role === 'student' && !u.teacherId).length;

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesCenter = centerFilter === 'all' 
      ? true 
      : centerFilter === 'none' 
      ? !u.centerId 
      : u.centerId === centerFilter;

    return matchesSearch && matchesRole && matchesCenter;
  });

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
      await loadData();
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
      await loadData();
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
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
      setDeleteUserData(null);
    }
  };

  const handleOpenCreateCenterModal = () => {
    setEditingCenterId(null);
    setCenterFormData({ name: '', code: '', address: '' });
    setError('');
    setShowCreateCenter(!showCreateCenter);
  };

  const handleStartEditCenter = (center: DbCenter) => {
    setEditingCenterId(center.id);
    setCenterFormData({
      name: center.name,
      code: center.code,
      address: center.address || '',
    });
    setShowCreateCenter(true);
  };

  const handleSubmitCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      if (editingCenterId) {
        await updateCenter(editingCenterId, centerFormData);
        setSuccess('Education Center updated successfully!');
      } else {
        await createCenter(centerFormData);
        setSuccess('Education Center created successfully!');
      }
      setShowCreateCenter(false);
      setEditingCenterId(null);
      setCenterFormData({ name: '', code: '', address: '' });
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeleteCenter = async () => {
    if (!deleteCenterData) return;
    try {
      await deleteCenter(deleteCenterData.id);
      setSuccess(`Education Center "${deleteCenterData.name}" removed`);
      setDeleteCenterData(null);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete center');
      setDeleteCenterData(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 flex items-center">
            <Building2 className="w-6 h-6 mr-2 text-indigo-400" />
            Education Center & User Governance Hub
          </h2>
          <p className="text-sm text-slate-400">
            Multi-tenant center management, teacher-student linkages, role authorization, and platform roster.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'users' ? (
            <button 
              onClick={handleOpenCreateModal}
              className="gradient-btn px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center w-full sm:w-fit shadow-lg"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {showCreate ? 'Close Form' : 'Create Account'}
            </button>
          ) : (
            <button 
              onClick={handleOpenCreateCenterModal}
              className="gradient-btn px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center w-full sm:w-fit shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              {showCreateCenter ? 'Close Form' : 'Add Learning Center'}
            </button>
          )}
        </div>
      </div>

      {/* Center Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl flex items-center space-x-3 border border-slate-800">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Total Users</span>
            <strong className="text-xl font-bold text-slate-100">{usersList.length}</strong>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center space-x-3 border border-slate-800">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Teachers</span>
            <strong className="text-xl font-bold text-purple-300">{teachersCount}</strong>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center space-x-3 border border-slate-800">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Students</span>
            <strong className="text-xl font-bold text-emerald-300">{studentsCount}</strong>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center space-x-3 border border-slate-800">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Learning Centers</span>
            <strong className="text-xl font-bold text-blue-300">{centersList.length}</strong>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-slate-800 space-x-3">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 font-semibold text-sm border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'users'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & Staff Roster ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('centers')}
          className={`pb-3 font-semibold text-sm border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'centers'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Education Centers ({centersList.length})</span>
        </button>
      </div>

      {/* Search & Role Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 glass-card p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              roleFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Accounts ({usersList.length})
          </button>
          <button
            onClick={() => setRoleFilter('student')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              roleFilter === 'student' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Students ({studentsCount})
          </button>
          <button
            onClick={() => setRoleFilter('teacher')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              roleFilter === 'teacher' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Teachers ({teachersCount})
          </button>

          {centersList.length > 0 && (
            <select
              value={centerFilter}
              onChange={e => setCenterFilter(e.target.value)}
              className="glass-input px-3 py-1.5 rounded-xl text-xs bg-slate-900 appearance-none text-slate-300 border border-slate-700 ml-0 sm:ml-2"
            >
              <option value="all">🏢 All Learning Centers</option>
              <option value="none">Independent / Unassigned</option>
              {centersList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or username..."
            className="glass-input pl-9 pr-4 py-1.5 rounded-xl text-xs w-full sm:w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
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

      {/* ================= USERS TAB ================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
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
                    <option value="teacher">Teacher</option>
                  </select>
                </div>

                {centersList.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-blue-300 mb-1">Learning Center</label>
                    <select 
                      className="w-full glass-input px-4 py-2 rounded-xl text-sm appearance-none bg-slate-900"
                      value={formData.centerId}
                      onChange={e => setFormData({ ...formData, centerId: e.target.value })}
                    >
                      <option value="">-- No Center Assigned --</option>
                      {centersList.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.role === 'student' && dbUser?.role === 'admin' && (
                  <div>
                    <label className="block text-xs font-medium text-indigo-300 mb-1">Assigned Teacher</label>
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
                {filteredUsers.map(u => (
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

                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No user accounts found matching your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= CENTERS TAB ================= */}
      {activeTab === 'centers' && (
        <div className="space-y-4">
          {showCreateCenter && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleSubmitCenter}
              autoComplete="off"
              className="glass-card p-4 sm:p-6 rounded-2xl space-y-4"
            >
              <h3 className="text-base sm:text-lg font-semibold border-b border-slate-800 pb-3 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-indigo-400" />
                {editingCenterId ? 'Edit Learning Center' : 'Register New Education Center'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Center Name</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full glass-input px-4 py-2 rounded-xl text-sm"
                    placeholder="e.g. Oxford Learning Academy"
                    value={centerFormData.name}
                    onChange={e => setCenterFormData({ ...centerFormData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Center Code (Unique Identifier)</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full glass-input px-4 py-2 rounded-xl text-sm uppercase"
                    placeholder="e.g. OXFORD-MAIN"
                    value={centerFormData.code}
                    onChange={e => setCenterFormData({ ...centerFormData, code: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Address / Campus Location</label>
                  <input 
                    type="text" 
                    className="w-full glass-input px-4 py-2 rounded-xl text-sm"
                    placeholder="e.g. 124 Amir Temur Avenue, Tashkent"
                    value={centerFormData.address}
                    onChange={e => setCenterFormData({ ...centerFormData, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowCreateCenter(false); setEditingCenterId(null); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="gradient-btn px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingCenterId ? 'Save Changes' : 'Register Center'}
                </button>
              </div>
            </motion.form>
          )}

          <div className="glass-card rounded-2xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider bg-slate-900/60">
                  <th className="px-6 py-4 font-medium">Center Name</th>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Teachers</th>
                  <th className="px-6 py-4 font-medium">Students</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {centersList.map(c => {
                  const centerTeachers = usersList.filter(u => u.centerId === c.id && u.role === 'teacher').length;
                  const centerStudents = usersList.filter(u => u.centerId === c.id && u.role === 'student').length;

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-200 flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-indigo-400" />
                        <span>{c.name}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-indigo-300 font-semibold">{c.code}</td>
                      <td className="px-6 py-4 text-slate-300 text-xs font-semibold">{centerTeachers} staff</td>
                      <td className="px-6 py-4 text-slate-300 text-xs font-semibold">{centerStudents} enrolled</td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{c.address || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end space-x-3">
                        <button 
                          onClick={() => handleStartEditCenter(c)}
                          className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                          title="Edit Center"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => setDeleteCenterData({ id: c.id, name: c.name })}
                          className="text-red-400 hover:text-red-300 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                          title="Delete Center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {centersList.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No learning centers registered yet. Click &quot;Add Learning Center&quot; to register one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete User Confirm Modal */}
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

      {/* Delete Center Confirm Modal */}
      <ConfirmModal 
        isOpen={deleteCenterData !== null}
        title="Delete Learning Center"
        message={`Are you sure you want to delete the learning center "${deleteCenterData?.name}"?`}
        confirmText="Delete Center"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDeleteCenter}
        onCancel={() => setDeleteCenterData(null)}
      />
    </div>
  );
}
