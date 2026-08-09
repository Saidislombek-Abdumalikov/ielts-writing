import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext.tsx';
import { getTasksForStudent } from '../lib/db';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { BookOpen, Clock, CheckCircle, ArrowRight, Search, Trophy, Sparkles, Filter } from 'lucide-react';

export default function StudentDashboard() {
  const { dbUser } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (dbUser) {
      getTasksForStudent(dbUser.id).then(setTasks);
    }
  }, [dbUser]);

  const gradedTasksCount = tasks.filter(t => t.submission?.status === 'graded').length;

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.promptText?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const subStatus = task.submission?.status;
    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = !subStatus || subStatus === 'draft';
    else if (statusFilter === 'submitted') matchesStatus = subStatus === 'submitted';
    else if (statusFilter === 'graded') matchesStatus = subStatus === 'graded';

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Student Workspace</h2>
          <p className="text-slate-400">Select an assignment to start writing or view teacher evaluation feedback.</p>
        </div>

        {gradedTasksCount > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card px-4 py-2.5 rounded-2xl border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold flex items-center shadow-lg"
          >
            <span className="relative flex h-2.5 w-2.5 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            🔔 {gradedTasksCount} {gradedTasksCount === 1 ? 'Assignment' : 'Assignments'} Graded with Teacher Feedback!
          </motion.div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 glass-card p-3 rounded-2xl">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'pending' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pending / Draft ({tasks.filter(t => !t.submission?.status || t.submission?.status === 'draft').length})
          </button>
          <button
            onClick={() => setStatusFilter('submitted')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'submitted' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Submitted ({tasks.filter(t => t.submission?.status === 'submitted').length})
          </button>
          <button
            onClick={() => setStatusFilter('graded')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'graded' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Graded ({gradedTasksCount})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search assignments..." 
            className="glass-input pl-9 pr-4 py-1.5 rounded-xl text-xs w-full sm:w-56"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks.map(task => {
          const sub = task.submission;
          const isMock = task.ieltsType === 'mock';

          return (
            <motion.div 
              key={task.id}
              whileHover={{ y: -4 }}
              className="glass-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      isMock 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center' 
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}>
                      {isMock ? '🏆 Full Mock Exam' : task.ieltsType === 'task1' ? 'Task 1 (Report)' : 'Task 2 (Essay)'}
                    </span>

                    {sub?.status === 'graded' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Band {sub.feedback?.bandScore || 'Evaluated'}
                      </span>
                    )}
                    {sub?.status === 'submitted' && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Submitted
                      </span>
                    )}
                    {sub?.status === 'draft' && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        In Progress
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 flex items-center shrink-0">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {task.timerMinutes ? `${task.timerMinutes} mins` : 'No limit'}
                  </span>
                </div>

                <h3 className="text-xl font-semibold mb-2">{task.title}</h3>
                <p className="text-slate-400 text-sm line-clamp-3 mb-4">
                  {isMock ? (task.task1Prompt || task.promptText) : task.promptText}
                </p>

                {sub?.status === 'graded' && sub.feedback?.comments && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200 mb-4 line-clamp-2">
                    <strong className="block text-emerald-400 font-semibold mb-0.5 flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Teacher Feedback:
                    </strong>
                    {sub.feedback.comments}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </span>
                <button 
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="gradient-btn px-4 py-2 rounded-xl text-sm font-medium flex items-center"
                >
                  <span>{sub?.status === 'graded' ? 'View Feedback' : sub?.status === 'submitted' ? 'View Submission' : 'Open Assignment'}</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500 glass-card rounded-2xl">
            No assignments match your search or status filter.
          </div>
        )}
      </div>
    </div>
  );
}
