import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { getTaskById, getStudentSubmissionWithFeedback, upsertSubmission } from '../lib/db';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Clock, Send, AlertTriangle, 
  CheckCircle, FileText, Sparkles, ShieldAlert, Lock, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';

export default function TaskWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [toastNotification, setToastNotification] = useState<string>('');
  
  // Phase 1 Architecture: Performance & Save Status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Silent auto-save refs
  const lastSavedContentRef = useRef<string>('');
  const contentRef = useRef<string>('');
  const isSubmittedRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);

  // Keep contentRef in sync for event listeners
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Anti-cheat metrics
  const [pasteAttempts, setPasteAttempts] = useState(0);
  const [suspiciousBurst, setSuspiciousBurst] = useState(false);
  const lastKeyTimeRef = useRef<number>(Date.now());
  const charBurstCountRef = useRef<number>(0);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const localDraftKey = `local_draft_${id}_${dbUser?.id}`;

  // Core Save Function
  const performSave = useCallback(async (forcedContent?: string) => {
    const textToSave = forcedContent !== undefined ? forcedContent : contentRef.current;
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;
    if (textToSave === lastSavedContentRef.current) {
      setSaveStatus('saved');
      return;
    }

    if (!navigator.onLine) {
      setSaveStatus('offline');
      // Save locally to localStorage
      try {
        localStorage.setItem(localDraftKey, textToSave);
      } catch (e) {
        console.error('Local storage write error:', e);
      }
      return;
    }

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      const wc = textToSave.trim() ? textToSave.trim().split(/\s+/).length : 0;
      const res = await upsertSubmission(id, dbUser.id, {
        content: textToSave,
        wordCount: wc,
        pasteAttemptCount: pasteAttempts,
        suspiciousBurstFlag: suspiciousBurst,
        status: 'draft'
      });

      if (!isSubmittedRef.current) {
        setSubmission(res);
      }
      lastSavedContentRef.current = textToSave;
      setSaveStatus('saved');
      // Clear synced local draft
      localStorage.removeItem(localDraftKey);
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [id, dbUser, pasteAttempts, suspiciousBurst, localDraftKey]);

  // Network Status Monitor
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      performSave();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSaveStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSave]);

  // Initial Workspace Loading & Local Draft Recovery
  useEffect(() => {
    if (!id || !dbUser) return;
    async function loadWorkspace() {
      try {
        setLoading(true);
        const taskData = await getTaskById(id!);
        if (!taskData) { setError('Task not found'); return; }
        setTask(taskData);

        let subData: any = null;
        try {
          subData = await getStudentSubmissionWithFeedback(id!, dbUser!.id);
          if (subData) {
            setSubmission(subData);
            const serverText = subData.content || '';
            
            // Check if local un-synced draft exists and is newer
            const localDraft = localStorage.getItem(localDraftKey);
            const initialText = (localDraft && localDraft.length > serverText.length) ? localDraft : serverText;
            
            setContent(initialText);
            contentRef.current = initialText;
            lastSavedContentRef.current = serverText;
            setPasteAttempts(subData.pasteAttemptCount || 0);
            setSuspiciousBurst(subData.suspiciousBurstFlag || false);

            if (subData.status === 'submitted' || subData.status === 'graded') {
              isSubmittedRef.current = true;
            }
          }
        } catch {
          // Check local draft fallback if no server submission yet
          const localDraft = localStorage.getItem(localDraftKey);
          if (localDraft) {
            setContent(localDraft);
            contentRef.current = localDraft;
          }
        }

        if (taskData.timerMinutes) {
          const storageKey = `task_timer_start_${id!}_${dbUser!.id}`;
          const nowMs = Date.now();
          let startTimeMs = localStorage.getItem(storageKey);

          if (!startTimeMs) {
            const subCreatedMs = subData?.createdAt ? new Date(subData.createdAt).getTime() : null;
            startTimeMs = (subCreatedMs || nowMs).toString();
            localStorage.setItem(storageKey, startTimeMs);
          }

          const elapsedSecs = Math.floor((nowMs - parseInt(startTimeMs, 10)) / 1000);
          const totalSecs = taskData.timerMinutes * 60;
          const remainingSecs = Math.max(0, totalSecs - elapsedSecs);
          setTimeLeft(remainingSecs);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load task');
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [id, dbUser, localDraftKey]);

  // Countdown timer with auto-submit when timer reaches 0
  useEffect(() => {
    if (timeLeft === null || submission?.status === 'submitted' || submission?.status === 'graded') return;
    
    if (timeLeft <= 0) {
      if (!isSubmittedRef.current && content.trim()) {
        handleConfirmSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submission]);

  // Sync isSubmittedRef state
  useEffect(() => {
    if (submission?.status === 'submitted' || submission?.status === 'graded') {
      isSubmittedRef.current = true;
    }
  }, [submission]);

  // Phase 1: 1000ms Debounced Autosave
  useEffect(() => {
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;
    if (submission?.status === 'submitted' || submission?.status === 'graded') return;
    if (content === lastSavedContentRef.current) return;

    setSaveStatus('saving');
    
    const debounceTimer = setTimeout(() => {
      performSave();
    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [content, id, dbUser, submission, performSave]);

  // Phase 1: 5-Second Background Periodic Backup Save
  useEffect(() => {
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;
    if (submission?.status === 'submitted' || submission?.status === 'graded') return;

    const backupInterval = setInterval(() => {
      if (contentRef.current !== lastSavedContentRef.current) {
        performSave();
      }
    }, 5000);

    return () => clearInterval(backupInterval);
  }, [id, dbUser, submission, performSave]);

  // Phase 1: Event Triggers (Blur, Visibility Change, Page Unload)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        performSave();
      }
    };
    const handleBeforeUnload = () => {
      // Synchronous LocalStorage Backup before unload
      if (contentRef.current && !isSubmittedRef.current) {
        try {
          localStorage.setItem(localDraftKey, contentRef.current);
        } catch (e) {
          console.error(e);
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [performSave, localDraftKey]);

  // Fast Instant Local Input Change Handler (0ms Latency)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setContent(newVal);
    contentRef.current = newVal;
    
    // Save to local cache synchronously for instant protection
    try {
      localStorage.setItem(localDraftKey, newVal);
    } catch (err) {
      console.error('Local storage write error:', err);
    }
  };

  // STRICT ANTI-PASTE, ANTI-CUT, ANTI-COPY HANDLERS
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteAttempts(prev => prev + 1);
    setSuspiciousBurst(true);
  };

  const handleCut = (e: React.ClipboardEvent | React.SyntheticEvent) => {
    e.preventDefault();
  };

  const handleCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  const handleDragDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && ['c', 'C'].includes(e.key)) {
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && ['v', 'V'].includes(e.key)) {
      e.preventDefault();
      setPasteAttempts(prev => prev + 1);
      setSuspiciousBurst(true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && ['x', 'X'].includes(e.key)) {
      e.preventDefault();
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
    if (!id || !dbUser) return;
    setShowConfirmSubmit(false);
    isSubmittedRef.current = true;
    try {
      setSubmitting(true);
      const calculatedWordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      const res = await upsertSubmission(id, dbUser.id, {
        content,
        wordCount: calculatedWordCount,
        pasteAttemptCount: pasteAttempts,
        suspiciousBurstFlag: suspiciousBurst,
        status: 'submitted'
      });
      setSubmission({ ...res, status: 'submitted' });
      lastSavedContentRef.current = content;
      setSaveStatus('saved');
      localStorage.removeItem(localDraftKey);
      setToastNotification('🎉 Essay successfully submitted! Your teacher has received your response and will evaluate it soon.');
      setTimeout(() => setToastNotification(''), 6000);
    } catch (err: any) {
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
    <div className="space-y-6 animate-fade-up w-full max-w-[95%] lg:max-w-[90%] mx-auto pt-8 sm:pt-12 pb-12 px-2 sm:px-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => {
            performSave();
            navigate('/');
          }} 
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

            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed p-4 rounded-xl bg-slate-900/60 border border-slate-800 whitespace-pre-wrap select-none">
              {task.promptText}
            </div>

            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p>• Minimum recommended words: {task.ieltsType === 'task1' ? '150 words' : '250 words'}</p>
              <p>• Copying & pasting text is strictly disabled.</p>
              <p>• Fast Instant Save: Edits save locally immediately and sync automatically.</p>
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

              {/* Phase 1 Live Save Status Badge */}
              <div className="flex items-center space-x-2 font-medium">
                {isReadOnly ? (
                  <span className="text-slate-400">Read-only</span>
                ) : saveStatus === 'saving' ? (
                  <span className="text-amber-400 flex items-center">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Saving...
                  </span>
                ) : saveStatus === 'offline' || !isOnline ? (
                  <span className="text-amber-300 flex items-center" title="Offline mode: Changes saved in local browser memory">
                    <WifiOff className="w-3 h-3 mr-1 text-amber-400" /> Offline (Saved locally)
                  </span>
                ) : saveStatus === 'error' ? (
                  <button 
                    onClick={() => performSave()}
                    className="text-red-400 hover:text-red-300 flex items-center underline"
                    title="Click to retry saving"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" /> Save failed (Retry)
                  </button>
                ) : (
                  <span className="text-emerald-400 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" /> Saved
                  </span>
                )}
              </div>
            </div>

            <textarea 
              value={content}
              onChange={handleInputChange}
              onBlur={() => performSave()}
              onPaste={handlePaste}
              onCut={handleCut}
              onCopy={handleCopy}
              onDrop={handleDragDrop}
              onDragStart={handleDragDrop}
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
