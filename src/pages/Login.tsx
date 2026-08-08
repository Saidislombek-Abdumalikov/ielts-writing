import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext.tsx';
import { useNavigate } from 'react-router';
import { BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const { dbUser, login, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  useEffect(() => {
    if (dbUser && !loading) {
      navigate('/');
    }
  }, [dbUser, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const cleanUsername = formData.username.trim();
      await login(cleanUsername, formData.password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-10 rounded-3xl w-full max-w-md"
      >
        <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6">
          <BookOpen className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2 tracking-tight text-center">IELTS Workspace</h1>
        <p className="text-slate-400 mb-8 text-center">Sign in to access your assignments.</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input 
              type="text" 
              required 
              className="w-full glass-input px-4 py-3 rounded-xl text-sm" 
              placeholder="student123"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input 
              type="password" 
              required 
              className="w-full glass-input px-4 py-3 rounded-xl text-sm" 
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full gradient-btn py-3 px-4 rounded-xl font-medium flex items-center justify-center space-x-2 mt-2"
          >
            <span>Sign In</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
