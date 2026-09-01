import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext.tsx';
import { getTasksForStudent, syncPendingSubmissions, getAllCourses, DbCourse } from '../lib/db';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { BookOpen, Clock, CheckCircle, ArrowRight, Search, Trophy, Sparkles, Filter, WifiOff, RefreshCw, PenTool, Award, GraduationCap } from 'lucide-react';
import { SkeletonTaskCard } from '../components/ui/Skeleton';

export default function StudentDashboard() {
  const { dbUser } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [courses, setCourses] = useState<DbCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [syncedBanner, setSyncedBanner] = useState('');
  const [feedbackModalTask, setFeedbackModalTask] = useState<any>(null);
  const [showScoreHistoryModal, setShowScoreHistoryModal] = useState(false);
  const navigate = useNavigate();

  const loadStudentTasks = async () => {
    if (!dbUser) return;
    try {
      if (navigator.onLine) {
        const syncedCount = await syncPendingSubmissions(dbUser.id);
        if (syncedCount > 0) {
          setSyncedBanner(`🎉 ${syncedCount} offline ${syncedCount === 1 ? 'submission' : 'submissions'} synced successfully!`);
          setTimeout(() => setSyncedBanner(''), 6000);
        }
      }
      const [data, crs] = await Promise.all([
        getTasksForStudent(dbUser.id),
        getAllCourses(),
      ]);
      setTasks(data);
      setCourses(crs);
    } catch (err) {
      console.warn('Student dashboard load warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentTasks();

    const handleOnline = () => {
      loadStudentTasks();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [dbUser]);

  const gradedTasks = tasks.filter(t => t.submission?.status === 'graded');
  const gradedTasksCount = gradedTasks.length;
  const submittedTasksCount = tasks.filter(t => t.submission?.status === 'submitted' || t.submission?.status === 'graded').length;
  const totalWordsWritten = tasks.reduce((acc, t) => acc + (t.submission?.wordCount || 0), 0);
  
  const validScores = gradedTasks.map(t => parseFloat(t.submission?.feedback?.bandScore)).filter(s => !isNaN(s) && s > 0);
  const avgBandScore = validScores.length > 0 
    ? (validScores.reduce((acc, s) => acc + s, 0) / validScores.length).toFixed(1)
    : null;

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.promptText?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const subStatus = task.submission?.status;
    let matchesStatus = true;
    if (statusFilter === 'pending') matchesStatus = !subStatus || subStatus === 'draft';
    else if (statusFilter === 'submitted') matchesStatus = subStatus === 'submitted';
    else if (statusFilter === 'graded') matchesStatus = subStatus === 'graded';

    const matchesCourse = courseFilter === 'all' || task.courseId === courseFilter;

    return matchesSearch && matchesStatus && matchesCourse;
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Student Workspace</h2>
          <p className="text-slate-400">Select an assignment to start writing or view teacher evaluation feedback.</p>
        </div>

        {syncedBanner && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center shadow-lg">
            <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" />
            {syncedBanner}
          </div>
        )}

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

      {/* Student Analytics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => { if (gradedTasksCount > 0) setShowScoreHistoryModal(true); }}
          className={`glass-card p-4 sm:p-5 rounded-2xl flex items-center justify-between border border-slate-800 transition-all ${
            gradedTasksCount > 0 ? 'cursor-pointer hover:border-amber-500/40 hover:bg-slate-800/40' : ''
          }`}
          title={gradedTasksCount > 0 ? "Click to view complete band score progression" : undefined}
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium block">Average Band Score</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <strong className="text-2xl font-bold text-slate-100">
                  {avgBandScore ? `Band ${avgBandScore}` : '—'}
                </strong>
                {avgBandScore && (
                  <span className="text-[11px] text-slate-500 font-normal">({gradedTasksCount} graded)</span>
                )}
              </div>
            </div>
          </div>

          {gradedTasksCount > 0 && (
            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl flex items-center shrink-0">
              History →
            </span>
          )}
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl flex items-center space-x-4 border border-slate-800">
          <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Assignments Progress</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <strong className="text-2xl font-bold text-slate-100">{submittedTasksCount}</strong>
              <span className="text-xs text-slate-500 font-medium">/ {tasks.length} submitted</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl flex items-center space-x-4 border border-slate-800">
          <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <PenTool className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Practice Volume</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <strong className="text-2xl font-bold text-slate-100">{totalWordsWritten.toLocaleString()}</strong>
              <span className="text-xs text-slate-500 font-medium">words written</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 glass-card p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
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
            Pending ({tasks.filter(t => !t.submission?.status || t.submission?.status === 'draft').length})
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

          {courses.length > 0 && (
            <div className="ml-0 sm:ml-2">
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="glass-input px-3 py-1.5 rounded-xl text-xs bg-slate-900 appearance-none text-slate-300 border border-slate-700"
              >
                <option value="all">📚 All Course Tracks</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
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
        {loading ? (
          <>
            <SkeletonTaskCard />
            <SkeletonTaskCard />
            <SkeletonTaskCard />
          </>
        ) : (
          <>
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

                        {task.courseId && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {courses.find(c => c.id === task.courseId)?.title || 'Curriculum Track'}
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
                      <div 
                        onClick={() => setFeedbackModalTask(task)}
                        className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200 mb-4 line-clamp-2 cursor-pointer hover:bg-emerald-950/50 hover:border-emerald-700/60 transition-all group"
                        title="Click to expand feedback"
                      >
                        <strong className="block text-emerald-400 font-semibold mb-0.5 flex items-center justify-between">
                          <span className="flex items-center">
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Teacher Feedback:
                          </span>
                          <span className="text-[10px] text-emerald-400/80 group-hover:underline">Expand ↗</span>
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
          </>
        )}
      </div>

      {/* Quick Feedback Preview Modal */}
      {feedbackModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card max-w-lg w-full p-6 rounded-2xl border border-slate-700 space-y-4 shadow-2xl relative"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Award className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{feedbackModalTask.title}</h3>
                  <p className="text-xs text-slate-400">Teacher Evaluation Feedback</p>
                </div>
              </div>
              <button 
                onClick={() => setFeedbackModalTask(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Assessed Score</span>
                <strong className="text-2xl font-black text-emerald-300">
                  Band {feedbackModalTask.submission?.feedback?.bandScore || 'N/A'}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Word Count</span>
                <strong className="text-sm font-semibold text-slate-200">
                  {feedbackModalTask.submission?.wordCount || 0} words
                </strong>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-emerald-400 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Detailed Teacher Comments
              </label>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-200 max-h-60 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {feedbackModalTask.submission?.feedback?.comments || 'No written comments provided.'}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button 
                onClick={() => setFeedbackModalTask(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 text-slate-300 transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  const id = feedbackModalTask.id;
                  setFeedbackModalTask(null);
                  navigate(`/tasks/${id}`);
                }}
                className="gradient-btn px-5 py-2 rounded-xl text-sm font-medium flex items-center"
              >
                <span>Open Full Exam Workspace</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* IELTS Band Score History & Progression Modal */}
      {showScoreHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card max-w-2xl w-full p-6 rounded-3xl border border-slate-700 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <span className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Trophy className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">IELTS Band Score Progression</h3>
                  <p className="text-xs text-slate-400">Complete historical breakdown of your evaluated writing exams</p>
                </div>
              </div>
              <button 
                onClick={() => setShowScoreHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium block">Average Band</span>
                <strong className="text-xl font-bold text-amber-400">Band {avgBandScore || '—'}</strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium block">Highest Score</span>
                <strong className="text-xl font-bold text-emerald-400">
                  {validScores.length > 0 ? `Band ${Math.max(...validScores)}` : '—'}
                </strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium block">Graded Tests</span>
                <strong className="text-xl font-bold text-indigo-400">{gradedTasksCount}</strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium block">Total Words</span>
                <strong className="text-xl font-bold text-slate-200">{totalWordsWritten.toLocaleString()}</strong>
              </div>
            </div>

            {/* Historical Score Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exam Results History</h4>
              <div className="rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase font-medium">
                      <th className="px-4 py-3">Assignment</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Words</th>
                      <th className="px-4 py-3">Assessed Band</th>
                      <th className="px-4 py-3 text-right">Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {gradedTasks.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-200 max-w-[180px] truncate">
                          {t.title}
                        </td>
                        <td className="px-4 py-3 text-slate-400 uppercase">
                          {t.ieltsType === 'mock' ? 'Mock Exam' : t.ieltsType}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {t.submission?.wordCount || 0}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Band {t.submission?.feedback?.bandScore || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setShowScoreHistoryModal(false);
                              setFeedbackModalTask(t);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 font-medium transition-colors"
                          >
                            View Comments
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowScoreHistoryModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close History
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
