import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext.tsx';
import { useNavigate } from 'react-router';
import { BookOpen, Send, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTelegram } from '../hooks/useTelegram';

export default function Login() {
  const { dbUser, login, loginWithTelegram, loading } = useAuth();
  const { isTelegram, initData, user: tgUser, hapticFeedback } = useTelegram();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isTelegramLoading, setIsTelegramLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  useEffect(() => {
    if (dbUser && !loading) {
      navigate('/');
    }
  }, [dbUser, loading, navigate]);

  const handleTelegramAuth = async () => {
    if (!initData) {
      setError('Telegram authentication session not detected. Please open inside Telegram or use credentials.');
      return;
    }
    setError('');
    setIsTelegramLoading(true);
    hapticFeedback?.impactOccurred('medium');

    try {
      await loginWithTelegram({ initData });
      hapticFeedback?.notificationOccurred('success');
    } catch (err: any) {
      hapticFeedback?.notificationOccurred('error');
      setError(err.message || 'Telegram authentication failed. Please try again.');
    } finally {
      setIsTelegramLoading(false);
    }
  };

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
    <div className="flex-1 flex items-center justify-center p-4 min-h-[85vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 sm:p-10 rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 relative overflow-hidden"
      >
        <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
          <BookOpen className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight text-center">IELTS Workspace</h1>
        <p className="text-slate-400 mb-6 text-center text-sm">Sign in to access your classroom and assignments.</p>
        
        {error && (
          <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        {/* Telegram Instant Auth (When inside Telegram WebApp) */}
        {isTelegram && initData && (
          <div className="mb-6 space-y-3">
            <button
              type="button"
              onClick={handleTelegramAuth}
              disabled={isTelegramLoading}
              className="w-full py-3.5 px-4 rounded-xl font-semibold bg-[#2AABEE] hover:bg-[#229ED9] text-white flex items-center justify-center space-x-2.5 transition-all shadow-lg shadow-[#2AABEE]/20 disabled:opacity-70"
            >
              {isTelegramLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Telegram Identity...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 fill-white" />
                  <span>Log In as {tgUser?.first_name || 'Telegram User'}</span>
                </>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or sign in with password</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center">
              <UserIcon className="w-3.5 h-3.5 mr-1 text-slate-400" /> Username
            </label>
            <input 
              type="text" 
              required 
              autoComplete="username"
              className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" 
              placeholder="e.g. student123"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center">
              <Lock className="w-3.5 h-3.5 mr-1 text-slate-400" /> Password
            </label>
            <input 
              type="password" 
              required 
              autoComplete="current-password"
              className="w-full glass-input px-4 py-2.5 rounded-xl text-sm" 
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full gradient-btn py-3 px-4 rounded-xl font-medium flex items-center justify-center space-x-2 mt-3 shadow-lg"
          >
            <span>Sign In</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
