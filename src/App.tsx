import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TaskWorkspace from './pages/TaskWorkspace';
import EvaluationWorkspace from './pages/EvaluationWorkspace';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: 'teacher' | 'student' | 'admin' }) {
  const { dbUser, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
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
    <ThemeProvider>
      <AuthProvider>
        <div className="relative overflow-x-hidden min-h-screen">
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="animate-pulse absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" style={{ animationDuration: '8s' }} />
            <div className="animate-pulse absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-purple-600/20 blur-[140px]" style={{ animationDelay: "-3s", animationDuration: '10s' }} />
            <div className="animate-pulse absolute -bottom-40 left-1/3 h-[30rem] w-[30rem] rounded-full bg-blue-600/15 blur-[160px]" style={{ animationDelay: "-5s", animationDuration: '12s' }} />
          </div>
          
          <div className="relative z-10 min-h-screen flex flex-col">
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/tasks/:id" element={<ProtectedRoute role="student"><TaskWorkspace /></ProtectedRoute>} />
                <Route path="/teacher/submissions/:id" element={<ProtectedRoute role="teacher"><EvaluationWorkspace /></ProtectedRoute>} />
              </Routes>
            </BrowserRouter>
          </div>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
