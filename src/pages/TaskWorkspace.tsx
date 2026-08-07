import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Clock, Send, AlertTriangle, 
  CheckCircle, FileText, Sparkles, Image as ImageIcon, ShieldAlert, Lock
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function TaskWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [toastNotification, setToastNotification] = useState<string>('');
  
  // Silent auto-save ref
  const lastSavedContentRef = useRef<string>('');

  // Anti-cheat metrics
  const [pasteAttempts, setPasteAttempts] = useState(0);
  const [suspiciousBurst, setSuspiciousBurst] = useState(false);
  const lastKeyTimeRef = useRef<number>(Date.now());
  const charBurstCountRef = useRef<number>(0);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    async function loadWorkspace() {
      try {
        setLoading(true);
        const taskData = await api.get(`/api/tasks/${id}`);
        setTask(taskData);
        
        if (taskData.timerMinutes) {
          setTimeLeft(taskData.timerMinutes * 60);
        }

        try {
          const subData = await api.get(`/api/submissions/${id}/me`);
          setSubmission(subData);
          const initialText = subData.content || '';
          setContent(initialText);
          lastSavedContentRef.current = initialText;
          setPasteAttempts(subData.pasteAttemptCount || 0);
          setSuspiciousBurst(subData.suspiciousBurstFlag || false);
        } catch {
          // No submission yet
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load task');
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || submission?.status === 'submitted' || submission?.status === 'graded') return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submission]);

  // Ref to immediately block auto-saves on submit (avoids React state batching delay)
  const isSubmittedRef = useRef(false);

  // Keep ref in sync with submission state
  useEffect(() => {
    if (submission?.status === 'submitted' || submission?.status === 'graded') {
      isSubmittedRef.current = true;
    }
  }, [submission]);

  // Background Auto-Save Every 2.5 Seconds
  useEffect(() => {
    if (!id) return;
    if (isSubmittedRef.current) return;
    if (submission?.status === 'submitted' || submission?.status === 'graded') return;
    if (content === lastSavedContentRef.current) return;

    const autoSaveTimer = setTimeout(async () => {
      // Double-check ref right before sending (in case submit happened during timeout)
      if (isSubmittedRef.current) return;

      try {
        const wc = content.trim() ? content.trim().split(/\s+/).length : 0;
        const res = await api.post(`/api/submissions/${id}`, {
          content,
          wordCount: wc,
          pasteAttemptCount: pasteAttempts,
          suspiciousBurstFlag: suspiciousBurst,
          status: 'draft'
        });
        // Only update submission state if we haven't submitted in the meantime
        if (!isSubmittedRef.current) {
          setSubmission(res);
        }
        lastSavedContentRef.current = content;
      } catch (err) {
        console.error('Silent auto-save error:', err);
      }
    }, 2500);

    return () => clearTimeout(autoSaveTimer);
  }, [content, id, pasteAttempts, suspiciousBurst, submission]);

  // STRICT ANTI-PASTE, ANTI-CUT, ANTI-COPY HANDLERS
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteAttempts(prev => prev + 1);
    setSuspiciousBurst(true);
  };

  const handleCut = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  const handleCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Block Ctrl+V / Cmd+V (Paste), Ctrl+X / Cmd+X (Cut), Ctrl+C / Cmd+C (Copy)
    if ((e.ctrlKey || e.metaKey) && ['v', 'V', 'x', 'X', 'c', 'C'].includes(e.key)) {
      e.preventDefault();
      if (['v', 'V'].includes(e.key)) {
        setPasteAttempts(prev => prev + 1);
        setSuspiciousBurst(true);
      }
      return;
    }

    const now = Date.now();
    if (now - lastKeyTimeRef.current < 25) {
      charBurstCountRef.current += 1;
      if (charBurstCountRef.current > 15) {
        setSuspiciousBurst(true);
      }
    } else {
      charBurstCountRef.current = 0;
    }
    lastKeyTimeRef.current = now;
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const handleConfirmSubmit = async () => {
    if (!id) return;
    setShowConfirmSubmit(false);
    // Immediately block all future auto-saves
    isSubmittedRef.current = true;
    try {
      setSubmitting(true);
      const calculatedWordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      const res = await api.post(`/api/submissions/${id}`, {
        content,
        wordCount: calculatedWordCount,
        pasteAttemptCount: pasteAttempts,
        suspiciousBurstFlag: suspiciousBurst,
        status: 'submitted'
      });
      setSubmission({ ...res, status: 'submitted' });
      lastSavedContentRef.current = content;
      setToastNotification('🎉 Essay successfully submitted! Your teacher has received your response and will evaluate it soon.');
      setTimeout(() => setToastNotification(''), 6000);
    } catch (err: any) {
      // If submission failed, allow auto-saves again
      isSubmittedRef.current = false;
      setError(err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-400 font-semibold">{error}</div>
        <button onClick={() => navigate('/')} className="gradient-btn px-4 py-2 rounded-xl text-sm">
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Check Start & Due Dates
  const now = new Date();
  const startDate = task.startDate ? new Date(task.startDate) : null;
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  const isNotStarted = startDate && now < startDate;
  const isPastDue = dueDate && now > dueDate;
  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'graded';
  const isReadOnly = isSubmitted || isNotStarted || isPastDue;

  return (
    <div className="space-y-6 animate-fade-up max-w-6xl mx-auto pb-12 px-2 sm:px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="flex flex-wrap items-center gap-3">
          {timeLeft !== null && !isSubmitted && (
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-sm font-mono font-bold ${
              timeLeft < 300 
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' 
                : 'glass-card text-indigo-300 border-indigo-500/30'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeLeft)}</span>
            </div>
          )}
          <div className="glass-card px-3 py-1.5 rounded-xl text-sm font-medium text-slate-300">
            <span className="text-slate-400 mr-2">Words:</span>
            <span className="text-indigo-400 font-semibold">{wordCount}</span>
          </div>

          {isSubmitted ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-sm font-semibold flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              {submission.status === 'graded' ? 'Graded' : 'Submitted'}
            </div>
          ) : isNotStarted ? (
            <div className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-semibold flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              Opens {new Date(task?.startDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          ) : isPastDue ? (
            <div className="px-4 py-2 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-sm font-semibold flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              Closed
            </div>
          ) : (
            <button 
              onClick={() => {
                if (!content.trim()) {
                  setError('Please write your essay response before submitting.');
                  return;
                }
                setError('');
                setShowConfirmSubmit(true);
              }}
              disabled={submitting || !content.trim()}
              className="gradient-btn px-5 py-2 rounded-xl text-sm font-medium flex items-center shadow-lg disabled:opacity-50"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Essay'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 text-red-300 text-sm rounded-xl flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Prompt & Visual Image */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-4 sm:p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {task.ieltsType === 'task1' ? 'Task 1 (Report)' : 'Task 2 (Essay)'}
              </span>
              {task.assignmentMode === 'partly' && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Focus: {task.focusLabel || 'Partly'}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold">{task.title}</h1>

            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed p-4 rounded-xl bg-slate-900/60 border border-slate-800 whitespace-pre-wrap">
              {task.promptText}
            </div>

            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p>• Minimum recommended words: {task.ieltsType === 'task1' ? '150 words' : '250 words'}</p>
              <p>• Copying & pasting text is strictly disabled.</p>
              <p>• Your progress auto-saves automatically every 2 seconds.</p>
            </div>
          </div>

          {/* Toast Notification Banner */}
          {toastNotification && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4 rounded-2xl border-emerald-500/40 bg-emerald-500/10 text-xs sm:text-sm text-emerald-200 flex items-center shadow-xl font-medium"
            >
              <CheckCircle className="w-5 h-5 mr-3 text-emerald-400 shrink-0" />
              <span>{toastNotification}</span>
            </motion.div>
          )}

          {/* Submission Submitted & Pending Teacher Feedback Status */}
          {submission?.status === 'submitted' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 rounded-2xl border-amber-500/30 bg-amber-500/10 text-xs sm:text-sm text-amber-200 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-semibold block text-amber-300">Submission Delivered</span>
                  <span className="text-xs text-amber-200/80">Your essay has been sent to your teacher. Evaluation will appear here once graded.</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Feedback Section if Graded */}
          {submission?.status === 'graded' && submission.feedback && submission.feedback.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 rounded-2xl space-y-4 border-emerald-500/50 bg-emerald-950/20 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-lg font-bold flex items-center text-emerald-300">
                    <Sparkles className="w-5 h-5 mr-2 text-emerald-400" />
                    Teacher Evaluation Feedback
                  </h3>
                </div>
                <div className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-lg shadow-lg">
                  Band {submission.feedback[0].bandScore}
                </div>
              </div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                {submission.feedback[0].comments}
              </div>
            </motion.div>
          )}

          {/* Anti-cheat Alert if paste was attempted */}
          {pasteAttempts > 0 && (
            <div className="glass-card p-4 rounded-2xl border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 space-y-1">
              <div className="flex items-center font-semibold">
                <ShieldAlert className="w-4 h-4 mr-2 text-amber-400" />
                Anti-Paste Active: Copying/Pasting is blocked ({pasteAttempts} attempts blocked)
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Text Editor */}
        <div className="lg:col-span-7 flex flex-col min-h-[450px] sm:min-h-[550px]">
          <div className="glass-card rounded-2xl flex-1 flex flex-col p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Response Workspace</span>
              </div>
              <span>{isReadOnly ? 'Read-only' : 'Live Auto-Save Enabled'}</span>
            </div>

            <textarea 
              value={content}
              onChange={e => !isReadOnly && setContent(e.target.value)}
              onPaste={handlePaste}
              onCut={handleCut}
              onCopy={handleCopy}
              onContextMenu={e => e.preventDefault()}
              onKeyDown={handleKeyDown}
              disabled={isReadOnly}
              placeholder={
                isNotStarted 
                  ? `Assignment opens on ${startDate?.toLocaleString()}` 
                  : isPastDue 
                  ? 'The submission deadline for this assignment has passed.' 
                  : isSubmitted 
                  ? 'Your submission has been finalized.' 
                  : 'Type your IELTS response here... (Copying/pasting is disabled)'
              }
              className="w-full flex-1 min-h-[350px] sm:min-h-[450px] bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-mono text-sm leading-relaxed p-2"
            />
          </div>
        </div>
      </div>

      {/* In-App Confirmation Modal */}
      <ConfirmModal 
        isOpen={showConfirmSubmit}
        title="Submit Essay"
        message="Are you sure you want to submit your final response to your teacher? Once submitted, you cannot edit your essay further."
        confirmText="Submit Essay"
        cancelText="Keep Editing"
        variant="primary"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirmSubmit(false)}
      />
    </div>
  );
}
