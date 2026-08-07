import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { api } from '../lib/api';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import AdminDashboard from './AdminDashboard';
import { Shield, BookOpen, PenTool, Sun, Moon } from 'lucide-react';

export default function Dashboard() {
  const { dbUser, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [adminTab, setAdminTab] = useState<'teacher' | 'student' | 'admin'>('admin');

  return (
    <div className="flex-1 flex flex-col">
      <header className="glass-header px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-40">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold gradient-text">IELTS Workspace</h1>
          
          {dbUser?.role === 'admin' && (
            <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button 
                onClick={() => setAdminTab('admin')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center ${
                  adminTab === 'admin' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5 mr-1.5" /> User Accounts
              </button>
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
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">

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
