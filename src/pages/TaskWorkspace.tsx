import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { getTaskById, getStudentSubmissionWithFeedback, upsertSubmission } from '../lib/db';
import { saveLocalDraft, getLocalDraft, clearLocalDraft } from '../lib/draftManager';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Clock, Send, AlertTriangle, 
  CheckCircle, FileText, Sparkles, ShieldAlert, Lock, Wifi, WifiOff, RefreshCw, BookOpen, Edit3, ZoomIn
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import ImageLightboxModal from '../components/ImageLightboxModal';

type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';
type MockTab = 'task1' | 'task2';

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
  const [showLightbox, setShowLightbox] = useState(false);
  
  // Phase 3: Mock Exam Tabs & Dual Content State
  const [activeTab, setActiveTab] = useState<MockTab>('task1');
  const [task1Content, setTask1Content] = useState('');
  const [task2Content, setTask2Content] = useState('');

  // Phase 1 & 2 Architecture: Performance, Save Status & Draft Recovery
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // Silent auto-save refs
  const lastSavedContentRef = useRef<string>('');
  const contentRef = useRef<string>('');
  const task1ContentRef = useRef<string>('');
  const task2ContentRef = useRef<string>('');
  const activeTabRef = useRef<MockTab>('task1');

  const isSubmittedRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);

  // Expiration timestamp ref (Server-Controlled Timer)
  const expiresAtMsRef = useRef<number | null>(null);

  // Keep refs in sync for event listeners
  useEffect(() => {
    contentRef.current = content;
    if (activeTab === 'task1') task1ContentRef.current = content;
    else task2ContentRef.current = content;
    activeTabRef.current = activeTab;
  }, [content, activeTab]);

  // Anti-cheat metrics
  const [pasteAttempts, setPasteAttempts] = useState(0);
  const [suspiciousBurst, setSuspiciousBurst] = useState(false);
  const lastKeyTimeRef = useRef<number>(Date.now());
  const charBurstCountRef = useRef<number>(0);

  // Shared Exam Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Core Save Function (IndexedDB + Firestore Sync)
  const performSave = useCallback(async (forcedContent?: string) => {
    const currentActiveText = forcedContent !== undefined ? forcedContent : contentRef.current;
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;

    const isMock = task?.ieltsType === 'mock';
    const t1Text = isMock ? (activeTabRef.current === 'task1' ? currentActiveText : task1ContentRef.current) : currentActiveText;
    const t2Text = isMock ? (activeTabRef.current === 'task2' ? currentActiveText : task2ContentRef.current) : '';

    const combinedText = isMock ? `--- TASK 1 ---\n${t1Text}\n\n--- TASK 2 ---\n${t2Text}` : currentActiveText;

    if (combinedText === lastSavedContentRef.current) {
      setSaveStatus('saved');
      return;
    }

    // Always persist to IndexedDB/LocalStorage first
    saveLocalDraft(id, dbUser.id, combinedText, false).catch(console.error);

    if (!navigator.onLine) {
      setSaveStatus('offline');
      return;
    }

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      
      const t1Wc = t1Text.trim() ? t1Text.trim().split(/\s+/).length : 0;
      const t2Wc = t2Text.trim() ? t2Text.trim().split(/\s+/).length : 0;
      const totalWc = isMock ? (t1Wc + t2Wc) : (currentActiveText.trim() ? currentActiveText.trim().split(/\s+/).length : 0);

      const res = await upsertSubmission(id, dbUser.id, {
        content: combinedText,
        task1Content: t1Text,
        task2Content: t2Text,
        task1WordCount: t1Wc,
        task2WordCount: t2Wc,
        wordCount: totalWc,
        pasteAttemptCount: pasteAttempts,
        suspiciousBurstFlag: suspiciousBurst,
        status: 'draft'
      });

      if (!isSubmittedRef.current) {
        setSubmission(res);
      }
      lastSavedContentRef.current = combinedText;
      setSaveStatus('saved');
      
      // Mark local draft as synced with server
      saveLocalDraft(id, dbUser.id, combinedText, true).catch(console.error);
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [id, dbUser, task, pasteAttempts, suspiciousBurst]);

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

  // Initial Workspace Loading & Server-Controlled Timer & Draft Recovery
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
              if (subData.status === 'submitted' || subData.status === 'graded') {
                isSubmittedRef.current = true;
              } else {
                isSubmittedRef.current = false;
              }
            } else {
              isSubmittedRef.current = false;
            }
          } catch {
            isSubmittedRef.current = false;
          }

          // Fetch local draft from IndexedDB/LocalStorage for zero-data-loss protection
          const localDraftRecord = await getLocalDraft(id!, dbUser!.id);
          const localText = localDraftRecord?.content || '';
          const serverText = subData?.content || '';

          let initialText = serverText;
          if (localText && localText !== serverText && !isSubmittedRef.current) {
            const localTime = localDraftRecord?.updatedAt || 0;
            const serverTime = subData?.updatedAt ? new Date(subData.updatedAt).getTime() : 0;

            if (localTime > serverTime || localText.length > serverText.length) {
              initialText = localText;
              setToastNotification('⚡ Unsaved local draft recovered from browser memory!');
              setTimeout(() => setToastNotification(''), 5000);
            }
          }

          const isMock = taskData.ieltsType === 'mock';
          if (isMock) {
            const t1 = subData?.task1Content || (initialText.includes('--- TASK 1 ---') ? initialText.split('--- TASK 2 ---')[0].replace('--- TASK 1 ---', '').trim() : initialText);
            const t2 = subData?.task2Content || (initialText.includes('--- TASK 2 ---') ? initialText.split('--- TASK 2 ---')[1].trim() : '');
            setTask1Content(t1);
            setTask2Content(t2);
            task1ContentRef.current = t1;
            task2ContentRef.current = t2;
            setContent(t1);
            contentRef.current = t1;
          } else {
            setContent(initialText);
            contentRef.current = initialText;
          }

          lastSavedContentRef.current = serverText;
          setPasteAttempts(subData?.pasteAttemptCount || 0);
          setSuspiciousBurst(subData?.suspiciousBurstFlag || false);

          // Phase 3: Server-Controlled Timer Calculations & Re-Open Reset
          if (taskData.timerMinutes && !isSubmittedRef.current) {
            const nowMs = Date.now();
            const totalSecs = taskData.timerMinutes * 60;
            const timerStorageKey = `task_timer_start_${id!}_${dbUser!.id}`;
            
            let startedMs = subData?.startedAt ? new Date(subData.startedAt).getTime() : null;
            let expiresMs = subData?.expiresAt ? new Date(subData.expiresAt).getTime() : null;

            // If draft was unlocked by teacher, clear old timer key and reset timestamp
            if (subData?.status === 'draft' && (!subData.startedAt || !subData.expiresAt)) {
              localStorage.removeItem(timerStorageKey);
              startedMs = nowMs;
              expiresMs = startedMs + (totalSecs * 1000);
              localStorage.setItem(timerStorageKey, startedMs.toString());
            } else if (!startedMs) {
              const storedStart = localStorage.getItem(timerStorageKey);
              startedMs = storedStart ? parseInt(storedStart, 10) : nowMs;
              localStorage.setItem(timerStorageKey, startedMs.toString());
            }

            if (!expiresMs) {
              expiresMs = startedMs + (totalSecs * 1000);
            }

            expiresAtMsRef.current = expiresMs;

            // Calculate exact remaining seconds from server/stored expiration timestamp
            const remainingSecs = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
            setTimeLeft(remainingSecs);

            // Initialize submission startedAt/expiresAt if missing
            if ((!subData?.startedAt || !subData?.expiresAt) && subData?.status !== 'submitted' && subData?.status !== 'graded') {
              upsertSubmission(id!, dbUser!.id, {
                startedAt: new Date(startedMs),
                expiresAt: new Date(expiresMs),
                status: 'draft'
              }).catch(console.error);
            }
          }
      } catch (err: any) {
        setError(err.message || 'Failed to load task');
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [id, dbUser]);

  // Phase 3: Shared Countdown Timer with Server Expiration Calculation
  useEffect(() => {
    if (timeLeft === null || submission?.status === 'submitted' || submission?.status === 'graded') return;
    
    const interval = setInterval(() => {
      if (expiresAtMsRef.current) {
        const remaining = Math.max(0, Math.floor((expiresAtMsRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          if (!isSubmittedRef.current) {
            handleConfirmSubmit();
          }
        }
      } else {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            if (!isSubmittedRef.current) {
              handleConfirmSubmit();
            }
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, submission]);

  // Sync isSubmittedRef state
  useEffect(() => {
    if (submission?.status === 'submitted' || submission?.status === 'graded') {
      isSubmittedRef.current = true;
    }
  }, [submission]);

  // Phase 1 & 2: 1000ms Debounced Autosave
  useEffect(() => {
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;
    if (submission?.status === 'submitted' || submission?.status === 'graded') return;

    setSaveStatus('saving');
    
    const debounceTimer = setTimeout(() => {
      performSave();
    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [content, id, dbUser, submission, performSave]);

  // Phase 1 & 2: 5-Second Background Periodic Backup Save
  useEffect(() => {
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;
    if (submission?.status === 'submitted' || submission?.status === 'graded') return;

    const backupInterval = setInterval(() => {
      performSave();
    }, 5000);

    return () => clearInterval(backupInterval);
  }, [id, dbUser, submission, performSave]);

  // Phase 1 & 2: Event Triggers (Blur, Visibility Change, Page Unload)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        performSave();
      }
    };
    const handleBeforeUnload = () => {
      if (contentRef.current && !isSubmittedRef.current && id && dbUser) {
        saveLocalDraft(id, dbUser.id, contentRef.current, false).catch(console.error);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [performSave, id, dbUser]);

  // Handle Tab Switch between Task 1 ↔ Task 2 in Mock Exam
  const handleTabSwitch = (targetTab: MockTab) => {
    if (targetTab === activeTab) return;
    performSave();

    if (activeTab === 'task1') {
      setTask1Content(content);
      task1ContentRef.current = content;
    } else {
      setTask2Content(content);
      task2ContentRef.current = content;
    }

    const nextText = targetTab === 'task1' ? task1ContentRef.current : task2ContentRef.current;
    setActiveTab(targetTab);
    activeTabRef.current = targetTab;
    setContent(nextText);
    contentRef.current = nextText;
  };

  // Fast Instant Local Input Change Handler (0ms Latency + IndexedDB Write)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setContent(newVal);
    contentRef.current = newVal;

    if (task?.ieltsType === 'mock') {
      if (activeTab === 'task1') {
        setTask1Content(newVal);
        task1ContentRef.current = newVal;
      } else {
        setTask2Content(newVal);
        task2ContentRef.current = newVal;
      }
    }
    
    if (id && dbUser && !isSubmittedRef.current) {
      saveLocalDraft(id, dbUser.id, newVal, false).catch(console.error);
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

  const currentWc = content.trim() ? content.trim().split(/\s+/).length : 0;
  const t1Wc = task1Content.trim() ? task1Content.trim().split(/\s+/).length : 0;
  const t2Wc = task2Content.trim() ? task2Content.trim().split(/\s+/).length : 0;
  const totalMockWc = t1Wc + t2Wc;

  const handleConfirmSubmit = async () => {
    if (!id || !dbUser) return;
    setShowConfirmSubmit(false);
    isSubmittedRef.current = true;
    try {
      setSubmitting(true);
      const isMock = task?.ieltsType === 'mock';
      const t1Text = isMock ? (activeTab === 'task1' ? content : task1Content) : content;
      const t2Text = isMock ? (activeTab === 'task2' ? content : task2Content) : '';
      const combinedText = isMock ? `--- TASK 1 ---\n${t1Text}\n\n--- TASK 2 ---\n${t2Text}` : content;
      const totalWc = isMock ? (t1Text.trim().split(/\s+/).length + t2Text.trim().split(/\s+/).length) : currentWc;

      const res = await upsertSubmission(id, dbUser.id, {
        content: combinedText,
        task1Content: t1Text,
        task2Content: t2Text,
        task1WordCount: t1Text.trim().split(/\s+/).length,
        task2WordCount: t2Text.trim().split(/\s+/).length,
        wordCount: totalWc,
        pasteAttemptCount: pasteAttempts,
        suspiciousBurstFlag: suspiciousBurst,
        status: 'submitted'
      });
      setSubmission({ ...res, status: 'submitted' });
      lastSavedContentRef.current = combinedText;
      setSaveStatus('saved');
      
      // Clear local draft upon final submission
      await clearLocalDraft(id, dbUser.id);
      
      setToastNotification('🎉 Exam successfully submitted! Your teacher has received your response.');
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
  const isMock = task.ieltsType === 'mock';

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
          {/* Shared Exam Timer */}
          {timeLeft !== null && !isSubmitted && (
            <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-sm font-mono font-bold shadow-md ${
              timeLeft < 300 
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' 
                : 'glass-card text-indigo-300 border-indigo-500/30'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeLeft)}</span>
            </div>
          )}
          
          <div className="glass-card px-3 py-1.5 rounded-xl text-sm font-medium text-slate-300">
            <span className="text-slate-400 mr-2">{isMock ? 'Total Words:' : 'Words:'}</span>
            <span className="text-indigo-400 font-semibold">{isMock ? totalMockWc : currentWc}</span>
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
                if (isMock) {
                  if (!task1Content.trim() && !task2Content.trim() && !content.trim()) {
                    setError('Please write an essay response before submitting.');
                    return;
                  }
                } else if (!content.trim()) {
                  setError('Please write your essay response before submitting.');
                  return;
                }
                setError('');
                setShowConfirmSubmit(true);
              }}
              disabled={submitting}
              className="gradient-btn px-5 py-2 rounded-xl text-sm font-medium flex items-center shadow-lg disabled:opacity-50"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          )}
        </div>
      </div>

      {/* Mock Exam Tab Navigation Header */}
      {isMock && (
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 text-xs sm:text-sm font-semibold max-w-md mx-auto shadow-lg">
          <button 
            onClick={() => handleTabSwitch('task1')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'task1' 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Task 1 Report ({t1Wc} words)</span>
          </button>
          <button 
            onClick={() => handleTabSwitch('task2')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'task2' 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Task 2 Essay ({t2Wc} words)</span>
          </button>
        </div>
      )}

      {/* Integrity / Anti-Cheat Warning Badge for Student */}
      {(pasteAttempts > 0 || suspiciousBurst) && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Integrity Notice:</strong> Copying and Pasting is disabled during IELTS writing exams.
            </span>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            {pasteAttempts > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                Paste Attempts: {pasteAttempts}
              </span>
            )}
            {suspiciousBurst && (
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-semibold">
                ⚠️ Text Burst Flagged
              </span>
            )}
          </div>
        </div>
      )}

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
                {isMock 
                  ? (activeTab === 'task1' ? 'Task 1 (Report - 150w min)' : 'Task 2 (Essay - 250w min)')
                  : (task.ieltsType === 'task1' ? 'Task 1 (Report)' : 'Task 2 (Essay)')
                }
              </span>
              {task.assignmentMode === 'partly' && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Focus: {task.focusLabel || 'Partly'}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold">{task.title}</h1>

            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed p-4 rounded-xl bg-slate-900/60 border border-slate-800 whitespace-pre-wrap select-none">
              {isMock 
                ? (activeTab === 'task1' ? (task.task1Prompt || task.promptText) : (task.task2Prompt || task.promptText))
                : task.promptText
              }
            </div>

            {/* Task 1 Prompt Visual Image Diagram */}
            {((isMock && activeTab === 'task1' && (task.task1ImageUrl || task.imageUrl)) || (!isMock && task.ieltsType === 'task1' && task.imageUrl)) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center">
                    <ZoomIn className="w-4 h-4 mr-1 text-indigo-400" /> Task 1 Diagram / Map / Chart
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Click image to expand full-screen</span>
                </div>
                <div 
                  onClick={() => setShowLightbox(true)}
                  className="relative w-full min-h-[300px] sm:min-h-[380px] max-h-[480px] bg-slate-950 border border-slate-700/80 rounded-2xl group cursor-pointer p-1 flex items-center justify-center hover:border-indigo-500/70 transition-all shadow-xl overflow-hidden"
                >
                  <img 
                    src={(isMock && activeTab === 'task1' ? (task.task1ImageUrl || task.imageUrl) : task.imageUrl)} 
                    alt="Task 1 Prompt Visual Graph" 
                    className="w-full h-full object-contain rounded-xl select-none transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-semibold text-xs rounded-2xl backdrop-blur-[2px]">
                    <ZoomIn className="w-5 h-5 mr-2 text-indigo-300" /> Click for Full Screen Lightbox Zoom
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p>• Recommended length: {activeTab === 'task1' ? '150 words' : '250 words'}</p>
              <p>• Shared Exam Timer: Switching tabs does not reset time.</p>
              <p>• Copying & pasting text is strictly disabled.</p>
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
        </div>

        {/* Right Side: Text Editor */}
        <div className="lg:col-span-7 flex flex-col min-h-[450px] sm:min-h-[550px]">
          <div className="glass-card rounded-2xl flex-1 flex flex-col p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>{isMock ? (activeTab === 'task1' ? 'Task 1 Response Editor' : 'Task 2 Response Editor') : 'Response Workspace'}</span>
              </div>

              {/* Live Save Status Badge */}
              <div className="flex items-center space-x-2 font-medium">
                {isReadOnly ? (
                  <span className="text-slate-400">Read-only</span>
                ) : saveStatus === 'saving' ? (
                  <span className="text-amber-400 flex items-center">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Saving...
                  </span>
                ) : saveStatus === 'offline' || !isOnline ? (
                  <span className="text-amber-300 flex items-center" title="Offline mode: Changes saved in IndexedDB & browser memory">
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
                  : `Type your ${isMock ? (activeTab === 'task1' ? 'Task 1 Report' : 'Task 2 Essay') : 'IELTS'} response here...`
              }
              className="w-full flex-1 min-h-[350px] sm:min-h-[450px] bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-mono text-sm leading-relaxed p-2"
            />
          </div>
        </div>
      </div>

      {/* In-App Confirmation Modal */}
      <ConfirmModal 
        isOpen={showConfirmSubmit}
        title="Submit Exam"
        message="Are you sure you want to submit your final mock exam response to your teacher? Once submitted, you cannot edit your responses further."
        confirmText="Submit Exam"
        cancelText="Keep Editing"
        variant="primary"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirmSubmit(false)}
      />

      {/* High Resolution Diagram Lightbox Modal */}
      <ImageLightboxModal
        isOpen={showLightbox}
        imageUrl={(isMock && activeTab === 'task1' ? (task.task1ImageUrl || task.imageUrl) : task.imageUrl) || ''}
        title={task.title ? `${task.title} — Task 1 Diagram` : 'Task 1 Prompt Visual Graph / Diagram'}
        onClose={() => setShowLightbox(false)}
      />
    </div>
  );
}
