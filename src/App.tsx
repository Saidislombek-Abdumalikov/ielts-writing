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
        <div className="min-h-screen flex flex-col font-sans transition-colors duration-150 pt-6 sm:pt-8">
          <div className="min-h-screen flex flex-col">
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
