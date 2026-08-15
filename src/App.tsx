import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskWorkspace from './pages/TaskWorkspace';
import EvaluationWorkspace from './pages/EvaluationWorkspace';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: 'teacher' | 'student' | 'admin' }) {
  const { dbUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-400">Loading IELTS Workspace...</p>
      </div>
    );
  }
  
  if (!dbUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (role && dbUser.role !== role && dbUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen flex flex-col font-sans transition-colors duration-150 pt-6 sm:pt-8">
            <div className="min-h-screen flex flex-col">
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/tasks/:id" element={<ProtectedRoute role="student"><TaskWorkspace /></ProtectedRoute>} />
                  <Route path="/teacher/submissions/:id" element={<ProtectedRoute role="teacher"><EvaluationWorkspace /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </div>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
