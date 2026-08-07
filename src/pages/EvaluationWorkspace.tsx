import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Users, FileText, CheckCircle, Clock, 
  Sparkles, Send, ShieldAlert, Award, AlertCircle, RefreshCw, UserX 
} from 'lucide-react';

export default function EvaluationWorkspace() {
  const { id: taskId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<any>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [missingStudents, setMissingStudents] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [submittedCount, setSubmittedCount] = useState<number>(0);

  const [selectedSub, setSelectedSub] = useState<any>(null);
  const selectedSubIdRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'submissions' | 'missing'>('submissions');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Grading form state
  const [bandScore, setBandScore] = useState<number>(6.5);
  const [comments, setComments] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [error, setError] = useState('');

  const fetchSubmissionsData = async (isInitial = false) => {
    if (!taskId) return;
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const taskData = await api.get(`/api/tasks/${taskId}`);
      setTask(taskData);

      const data = await api.get(`/api/tasks/${taskId}/submissions`);
      const subs = data.submissions || [];
      setSubmissionsList(subs);
      setMissingStudents(data.missingStudents || []);
      setTotalStudents(data.totalStudents || 0);
      setSubmittedCount(data.submittedCount || 0);

      // Preserve currently selected submission or select first available
      if (subs.length > 0) {
        if (selectedSubIdRef.current) {
          const matched = subs.find((s: any) => s.submission.id === selectedSubIdRef.current);
          if (matched) {
            setSelectedSub(matched);
          } else {
            setSelectedSub(subs[0]);
            selectedSubIdRef.current = subs[0].submission.id;
            loadExistingFeedback(subs[0].submission.id);
          }
        } else {
          setSelectedSub(subs[0]);
          selectedSubIdRef.current = subs[0].submission.id;
          loadExistingFeedback(subs[0].submission.id);
        }
      } else {
        setSelectedSub(null);
        selectedSubIdRef.current = null;
      }
    } catch (err: any) {
      if (isInitial) setError(err.message || 'Failed to load submissions');
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubmissionsData(true);

    // Live Polling every 3 seconds so teacher gets submissions in real-time
    const interval = setInterval(() => {
      fetchSubmissionsData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [taskId]);

  const loadExistingFeedback = async (subId: number) => {
    try {
      const fb = await api.get(`/api/submissions/${subId}/feedback`);
      if (fb) {
        setBandScore(parseFloat(fb.bandScore) || 6.5);
        setComments(fb.comments || '');
      }
    } catch {
      // No feedback yet
      setBandScore(6.5);
      setComments('');
    }
  };

  const handleSelectSubmission = (subItem: any) => {
    setSelectedSub(subItem);
    selectedSubIdRef.current = subItem.submission.id;
    setFeedbackSuccess('');
    setError('');
    loadExistingFeedback(subItem.submission.id);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    try {
      setSubmittingFeedback(true);
      setError('');
      await api.post(`/api/submissions/${selectedSub.submission.id}/feedback`, {
        bandScore,
        comments
      });
      
      setFeedbackSuccess('Feedback successfully published!');
      setTimeout(() => setFeedbackSuccess(''), 3000);

      fetchSubmissionsData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const notSubmittedCount = totalStudents - submittedCount;

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl mx-auto pb-12 px-2 sm:px-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => fetchSubmissionsData(false)}
            disabled={refreshing}
            className="glass-card px-3 py-1.5 rounded-xl text-xs font-medium flex items-center text-slate-300 hover:text-white transition-colors"
            title="Check for new submissions"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking...' : 'Refresh Live'}
          </button>

          {task && (
            <div className="text-right">
              <h1 className="text-lg sm:text-xl font-bold">{task.title}</h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider">
                {task.ieltsType} • Deadline: {new Date(task.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Submission Roster Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-indigo-500/20">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Registered Students</p>
            <p className="text-2xl font-bold text-slate-100">{totalStudents}</p>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-emerald-500/20">
          <div>
            <p className="text-xs text-slate-400 font-medium">Submissions Received</p>
            <p className="text-2xl font-bold text-emerald-400">{submittedCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-amber-500/20">
          <div>
            <p className="text-xs text-slate-400 font-medium">Not Submitted Yet</p>
            <p className="text-2xl font-bold text-amber-400">{notSubmittedCount > 0 ? notSubmittedCount : 0}</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Submissions & Missing Roster Tabs */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button 
              onClick={() => setActiveTab('submissions')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center ${
                activeTab === 'submissions' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Received ({submissionsList.length})
            </button>
            <button 
              onClick={() => setActiveTab('missing')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center ${
                activeTab === 'missing' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserX className="w-3.5 h-3.5 mr-1.5" /> Missing ({missingStudents.length})
            </button>
          </div>

          {activeTab === 'submissions' ? (
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {submissionsList.map(item => {
                const sub = item.submission;
                const student = item.student;
                const isSelected = selectedSub?.submission.id === sub.id;

                return (
                  <motion.div 
                    key={sub.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => handleSelectSubmission(item)}
                    className={`glass-card p-4 rounded-xl cursor-pointer transition-all border ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-slate-200">{student.name}</h4>
                        <p className="text-[11px] text-slate-400">@{student.username}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        sub.status === 'graded' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : sub.status === 'submitted'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {sub.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <span>{sub.wordCount || 0} words</span>
                      <span>{sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Drafting'}</span>
                    </div>

                    {(sub.pasteAttemptCount > 0 || sub.suspiciousBurstFlag) && (
                      <div className="mt-2 text-[11px] text-amber-400 flex items-center">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Integrity Flags Detected
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {submissionsList.length === 0 && (
                <div className="glass-card p-8 text-center text-slate-400 rounded-2xl text-xs">
                  No student has submitted this assignment yet.
                </div>
              )}
            </div>
          ) : (
            /* Missing Students List */
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {missingStudents.map(student => (
                <div key={student.id} className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-slate-200">{student.name}</h4>
                      <p className="text-xs text-slate-400">@{student.username}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-semibold">
                      Not Sent
                    </span>
                  </div>
                </div>
              ))}

              {missingStudents.length === 0 && (
                <div className="glass-card p-8 text-center text-emerald-400 rounded-2xl text-xs flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  All enrolled students have submitted their homework!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Evaluation Workspace */}
        {selectedSub && activeTab === 'submissions' ? (
          <div className="lg:col-span-8 space-y-6">
            {/* Student Submission View */}
            <div className="glass-card p-6 rounded-2xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedSub.student.name}</h2>
                  <p className="text-xs text-slate-400">@{selectedSub.student.username}</p>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <span className="glass-card px-3 py-1 rounded-lg">Words: <strong className="text-indigo-400">{selectedSub.submission.wordCount}</strong></span>
                  <span className="glass-card px-3 py-1 rounded-lg">Status: <strong className="text-indigo-400 capitalize">{selectedSub.submission.status}</strong></span>
                </div>
              </div>

              {/* Anti-cheat alerts */}
              {(selectedSub.submission.pasteAttemptCount > 0 || selectedSub.submission.suspiciousBurstFlag) && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                  <div className="flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-2 text-amber-400" />
                    <span><strong>Anti-Cheat Metrics:</strong> Pastes ({selectedSub.submission.pasteAttemptCount || 0}), Fast Bursts ({selectedSub.submission.suspiciousBurstFlag ? 'Yes' : 'No'})</span>
                  </div>
                </div>
              )}

              {/* Essay Text */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 text-sm leading-relaxed min-h-[250px] whitespace-pre-wrap font-mono">
                {selectedSub.submission.content || <em className="text-slate-500">No content submitted yet.</em>}
              </div>
            </div>

            {/* Evaluation Form */}
            <form onSubmit={handleSubmitFeedback} className="glass-card p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold flex items-center">
                  <Award className="w-5 h-5 mr-2 text-indigo-400" />
                  Teacher Evaluation & Scoring
                </h3>
              </div>

              {feedbackSuccess && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {feedbackSuccess}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 text-red-300 text-sm rounded-xl flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Overall Band Score</label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number"
                      step="0.5"
                      min="0"
                      max="9.0"
                      required
                      className="glass-input px-4 py-2 rounded-xl text-xl font-extrabold text-indigo-400 w-full"
                      value={bandScore}
                      onChange={e => setBandScore(parseFloat(e.target.value))}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Scale 0.0 - 9.0 (0.5 steps)</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Detailed Feedback & Correction Comments</label>
                  <textarea 
                    required
                    rows={5}
                    className="glass-input px-4 py-3 rounded-xl w-full text-sm resize-none"
                    placeholder="Provide constructive feedback on Task Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range..."
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  type="submit"
                  disabled={submittingFeedback}
                  className="gradient-btn px-6 py-2.5 rounded-xl font-medium text-sm flex items-center shadow-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submittingFeedback ? 'Saving...' : 'Publish Evaluation'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-8 glass-card p-12 text-center text-slate-400 rounded-2xl flex flex-col items-center justify-center space-y-3">
            <Users className="w-12 h-12 text-slate-600 mb-2" />
            <h3 className="text-lg font-semibold text-slate-200">Select a submission from the list</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Choose a student's submission from the sidebar to inspect their response and submit evaluation feedback.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
