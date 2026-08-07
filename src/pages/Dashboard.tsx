import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { api } from '../lib/api';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import AdminDashboard from './AdminDashboard';
import { Shield, BookOpen, PenTool, Sun, Moon, Eye, LogOut, UserCheck } from 'lucide-react';

export default function Dashboard() {
  const { dbUser, signOut, isImpersonating, impersonateUser, exitImpersonation } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [adminTab, setAdminTab] = useState<'teacher' | 'student' | 'admin'>('teacher');
  const [allUsersList, setAllUsersList] = useState<any[]>([]);

  useEffect(() => {
    if (dbUser?.role === 'admin') {
      api.get('/api/users').then(setAllUsersList).catch(() => {});
    }
  }, [dbUser?.role]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm shadow-md sticky top-0 z-50">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 shrink-0" />
            <span>
              Viewing as <strong>{dbUser?.name}</strong> ({dbUser?.role}) — Impersonating Account
            </span>
          </div>
          <button
            onClick={exitImpersonation}
            className="bg-slate-950 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors font-semibold flex items-center text-xs shadow"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Exit to Admin Account
          </button>
        </div>
      )}

      <header className="glass-header px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-40">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold gradient-text">IELTS Workspace</h1>
          
          {dbUser?.role === 'admin' && (
            <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button 
                onClick={() => setAdminTab('teacher')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center ${
                  adminTab === 'teacher' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Teacher Panel
              </button>
              <button 
                onClick={() => setAdminTab('student')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center ${
                  adminTab === 'student' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 mr-1.5" /> Student View
              </button>
              <button 
                onClick={() => setAdminTab('admin')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center ${
                  adminTab === 'admin' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5 mr-1.5" /> User Accounts
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Quick Impersonation Dropdown for Admin */}
          {dbUser?.role === 'admin' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-400 font-medium hidden md:inline">Switch Account:</span>
              <select
                className="glass-input px-3 py-1.5 rounded-xl text-xs bg-slate-900 border-slate-700"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val) impersonateUser(val);
                }}
                defaultValue=""
              >
                <option value="" disabled>Enter Teacher / Student Account...</option>
                <optgroup label="Teachers">
                  {allUsersList.filter(u => u.role === 'teacher' && u.id !== dbUser.id).map(u => (
                    <option key={u.id} value={u.id}>Teacher: {u.name} (@{u.username})</option>
                  ))}
                </optgroup>
                <optgroup label="Students">
                  {allUsersList.filter(u => u.role === 'student' && u.id !== dbUser.id).map(u => (
                    <option key={u.id} value={u.id}>Student: {u.name} (@{u.username})</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl glass-card hover:bg-slate-800/60 transition-colors text-slate-300 hover:text-white"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <span className="text-sm text-slate-300 capitalize font-medium flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
            {dbUser?.name} ({dbUser?.role})
          </span>
          
          <button 
            onClick={signOut}
            className="text-sm px-3.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors border border-slate-700 text-slate-300 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>
      
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {dbUser?.role === 'admin' && (
          <>
            {adminTab === 'teacher' && <TeacherDashboard />}
            {adminTab === 'student' && <StudentDashboard />}
            {adminTab === 'admin' && <AdminDashboard />}
          </>
        )}

        {dbUser?.role === 'teacher' && (
          <TeacherDashboard />
        )}

        {dbUser?.role === 'student' && <StudentDashboard />}
      </main>
    </div>
  );
}
