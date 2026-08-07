import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { BookOpen, Clock, CheckCircle, ArrowRight } from 'lucide-react';

export default function StudentDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/tasks').then(setTasks);
  }, []);

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Student Workspace</h2>
        <p className="text-slate-400">Select an assignment to start writing or view feedback.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map(task => {
          const sub = task.submission;
          return (
            <motion.div 
              key={task.id}
              whileHover={{ y: -4 }}
              className="glass-card p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {task.ieltsType}
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
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                        In Progress
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {task.timerMinutes ? `${task.timerMinutes} mins` : 'No limit'}
                  </span>
                </div>

                <h3 className="text-xl font-semibold mb-2">{task.title}</h3>
                <p className="text-slate-400 text-sm line-clamp-3 mb-4">
                  {task.promptText}
                </p>

                {sub?.status === 'graded' && sub.feedback?.comments && (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200 mb-4 line-clamp-2">
                    <strong className="block text-emerald-400 font-semibold mb-0.5">Teacher Feedback:</strong>
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

        {tasks.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No assignments available yet.
          </div>
        )}
      </div>
    </div>
  );
}
