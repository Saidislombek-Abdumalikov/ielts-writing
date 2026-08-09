import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { getTaskById, getStudentSubmissionWithFeedback, upsertSubmission, syncPendingSubmissions } from '../lib/db';
import { 
  saveLocalDraft, getLocalDraft, clearLocalDraft,
  saveActiveExamState, getActiveExamState,
  savePendingSubmission, getPendingSubmissions, PendingSubmission
} from '../lib/draftManager';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Clock, Send, AlertTriangle, 
  CheckCircle, FileText, Sparkles, ShieldAlert, Lock, Wifi, WifiOff, RefreshCw, BookOpen, Edit3, ZoomIn
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import ImageLightboxModal from '../components/ImageLightboxModal';

type SaveStatus = 'saved' | 'saving' | 'offline' | 'pending_sync' | 'error';
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
  
  // Mock Exam Tabs & Dual Content State
  const [activeTab, setActiveTab] = useState<MockTab>('task1');
  const [task1Content, setTask1Content] = useState('');
  const [task2Content, setTask2Content] = useState('');

  // Performance, Save Status & Offline Pending Sync
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isPendingSync, setIsPendingSync] = useState<boolean>(false);
  
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
  const startedAtMsRef = useRef<number | null>(null);

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

  // Core Save Function (IndexedDB + Active Exam State + Firestore Sync)
  const performSave = useCallback(async (forcedContent?: string) => {
    const currentActiveText = forcedContent !== undefined ? forcedContent : contentRef.current;
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;

    const isMock = task?.ieltsType === 'mock';
    const t1Text = isMock ? (activeTabRef.current === 'task1' ? currentActiveText : task1ContentRef.current) : currentActiveText;
    const t2Text = isMock ? (activeTabRef.current === 'task2' ? currentActiveText : task2ContentRef.current) : '';

    const combinedText = isMock ? `--- TASK 1 ---\n${t1Text}\n\n--- TASK 2 ---\n${t2Text}` : currentActiveText;

    // Persist active exam state locally for refresh & offline recovery
    saveActiveExamState({
      taskId: id,
      studentId: dbUser.id,
      activeTab: activeTabRef.current,
      task1Content: t1Text,
      task2Content: t2Text,
      content: combinedText,
      startedAtMs: startedAtMsRef.current || Date.now(),
      expiresAtMs: expiresAtMsRef.current || (Date.now() + 3600000),
      pasteAttemptCount: pasteAttempts,
      suspiciousBurstFlag: suspiciousBurst,
    }).catch(console.error);

    // Save local draft
    saveLocalDraft(id, dbUser.id, combinedText, false).catch(console.error);

    if (combinedText === lastSavedContentRef.current) {
      setSaveStatus(navigator.onLine ? 'saved' : 'offline');
      return;
    }

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
      
      saveLocalDraft(id, dbUser.id, combinedText, true).catch(console.error);
    } catch (err) {
      console.warn('Auto-save network warning:', err);
      setSaveStatus('offline');
    } finally {
      isSavingRef.current = false;
    }
  }, [id, dbUser, task, pasteAttempts, suspiciousBurst]);

  // Background Sync Engine (When connection returns)
  const triggerPendingSync = useCallback(async () => {
    if (!dbUser) return;
    try {
      const syncedCount = await syncPendingSubmissions(dbUser.id);
      if (syncedCount > 0) {
        setIsPendingSync(false);
        setToastNotification('✓ Submitted & synchronized with teacher!');
        setTimeout(() => setToastNotification(''), 6000);
        if (id) {
          const freshSub = await getStudentSubmissionWithFeedback(id, dbUser.id);
          if (freshSub) setSubmission(freshSub);
        }
      }
    } catch (e) {
      console.warn('Sync pending error:', e);
    }
  }, [dbUser, id]);

  // Network Status Monitor & Automatic Sync on Connection Restoration
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      performSave();
      triggerPendingSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSaveStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check for pending syncs
    if (navigator.onLine) {
      triggerPendingSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSave, triggerPendingSync]);

  // Workspace Loading & State Recovery
  useEffect(() => {
    if (!id || !dbUser) return;
    async function loadWorkspace() {
      try {
        setLoading(true);
        let taskData: any = null;

        // Try server task first, or use cached
        try {
          taskData = await getTaskById(id!);
        } catch {
          // Network fail fallback for task
        }

        if (!taskData) {
          // Check local pending / draft to see if task info exists
          const localDraftRecord = await getLocalDraft(id!, dbUser!.id);
          if (!localDraftRecord) {
            setError('Task not found or offline cache unavailable');
            return;
          }
          taskData = { id: id!, title: 'IELTS Writing Assignment', ieltsType: 'task2', promptText: 'Writing prompt saved locally' };
        }
        setTask(taskData);

        // Check Pending Offline Submission Snapshot
        const pendingList = await getPendingSubmissions(dbUser!.id);
        const pendingForThisTask = pendingList.find(p => p.taskId === id! && !p.synced);
        if (pendingForThisTask) {
          setIsPendingSync(true);
          isSubmittedRef.current = true;
          setSubmission({
            id: pendingForThisTask.operationId,
            status: 'submitted',
            content: pendingForThisTask.content,
            task1Content: pendingForThisTask.task1Content,
            task2Content: pendingForThisTask.task2Content,
            wordCount: pendingForThisTask.wordCount,
            submittedAt: new Date(pendingForThisTask.submittedAtLocal),
          });
        }

        let subData: any = null;
        if (!pendingForThisTask) {
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
        }

        // Restore Active Exam State locally (Requirements 9, 11, 12, 14)
        const activeExamState = await getActiveExamState(id!, dbUser!.id);
        const localDraftRecord = await getLocalDraft(id!, dbUser!.id);
        
        const localText = activeExamState?.content || localDraftRecord?.content || '';
        const serverText = subData?.content || '';

        let initialText = serverText;
        if (localText && localText !== serverText && !isSubmittedRef.current) {
          initialText = localText;
        }

        const isMock = taskData.ieltsType === 'mock';
        const restoredTab = activeExamState?.activeTab || 'task1';
        setActiveTab(restoredTab);

        if (isMock) {
          const t1 = activeExamState?.task1Content || subData?.task1Content || (initialText.includes('--- TASK 1 ---') ? initialText.split('--- TASK 2 ---')[0].replace('--- TASK 1 ---', '').trim() : initialText);
          const t2 = activeExamState?.task2Content || subData?.task2Content || (initialText.includes('--- TASK 2 ---') ? initialText.split('--- TASK 2 ---')[1].trim() : '');
          setTask1Content(t1);
          setTask2Content(t2);
          task1ContentRef.current = t1;
          task2ContentRef.current = t2;
          const currentText = restoredTab === 'task1' ? t1 : t2;
          setContent(currentText);
          contentRef.current = currentText;
        } else {
          setContent(initialText);
          contentRef.current = initialText;
        }

        lastSavedContentRef.current = serverText;
        setPasteAttempts(activeExamState?.pasteAttemptCount || subData?.pasteAttemptCount || 0);
        setSuspiciousBurst(activeExamState?.suspiciousBurstFlag || subData?.suspiciousBurstFlag || false);

        // Server-Controlled Timer Calculations & Recovery
        if (taskData.timerMinutes && !isSubmittedRef.current) {
          const nowMs = Date.now();
          const totalSecs = taskData.timerMinutes * 60;
          const timerStorageKey = `task_timer_start_${id!}_${dbUser!.id}`;
          
          let startedMs = activeExamState?.startedAtMs || (subData?.startedAt ? new Date(subData.startedAt).getTime() : null);
          let expiresMs = activeExamState?.expiresAtMs || (subData?.expiresAt ? new Date(subData.expiresAt).getTime() : null);

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

          startedAtMsRef.current = startedMs;
          expiresAtMsRef.current = expiresMs;

          const remainingSecs = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
          setTimeLeft(remainingSecs);

          if ((!subData?.startedAt || !subData?.expiresAt) && subData?.status !== 'submitted' && subData?.status !== 'graded' && navigator.onLine) {
            upsertSubmission(id!, dbUser!.id, {
              startedAt: new Date(startedMs),
              expiresAt: new Date(expiresMs),
              status: 'draft'
            }).catch(console.error);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load task workspace');
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [id, dbUser]);

  // Countdown Timer
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

  // 1000ms Debounced Autosave
  useEffect(() => {
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;
    if (submission?.status === 'submitted' || submission?.status === 'graded') return;

    setSaveStatus(navigator.onLine ? 'saving' : 'offline');
    
    const debounceTimer = setTimeout(() => {
      performSave();
    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [content, id, dbUser, submission, performSave]);

  // 5-Second Periodic Backup
  useEffect(() => {
    if (!id || !dbUser) return;
    if (isSubmittedRef.current) return;
    if (submission?.status === 'submitted' || submission?.status === 'graded') return;

    const backupInterval = setInterval(() => {
      performSave();
    }, 5000);

    return () => clearInterval(backupInterval);
  }, [id, dbUser, submission, performSave]);

  // Event Triggers (Visibility Change, Page Unload)
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
  }, [id, dbUser, performSave]);

  // Tab Switch Handler (Task 1 ↔ Task 2)
  const handleTabSwitch = (targetTab: MockTab) => {
    if (targetTab === activeTab) return;

    if (activeTab === 'task1') {
      setTask1Content(content);
      task1ContentRef.current = content;
    } else {
      setTask2Content(content);
      task2ContentRef.current = content;
    }

    const nextText = targetTab === 'task1' ? task1Content : task2Content;
    setActiveTab(targetTab);
    setContent(nextText);
    contentRef.current = nextText;

    performSave(nextText);
  };

  // Anti-Cheat Event Blockers
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteAttempts(prev => prev + 1);
  };

  const handleCut = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  const handleCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  const handleDragDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const now = Date.now();
    const timeDiff = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;

    if (timeDiff < 15) {
      charBurstCountRef.current += 1;
      if (charBurstCountRef.current > 8) {
        setSuspiciousBurst(true);
      }
    } else {
      charBurstCountRef.current = 0;
    }

    if ((e.ctrlKey || e.metaKey) && ['v', 'V', 'c', 'C', 'x', 'X', 'a', 'A'].includes(e.key)) {
      if (['v', 'V'].includes(e.key)) {
        setPasteAttempts(prev => prev + 1);
      }
      e.preventDefault();
    }
  };

  // Submit Handler with Offline Pending Submission Engine (Requirements 4, 5, 6, 7, 8)
  const handleConfirmSubmit = async () => {
    if (!id || !dbUser) return;
    try {
      setSubmitting(true);
      setShowConfirmSubmit(false);
      isSubmittedRef.current = true;

      const isMock = task?.ieltsType === 'mock';
      const t1Text = isMock ? (activeTab === 'task1' ? content : task1Content) : content;
      const t2Text = isMock ? (activeTab === 'task2' ? content : task2Content) : '';
      
      const t1Wc = t1Text.trim() ? t1Text.trim().split(/\s+/).length : 0;
      const t2Wc = t2Text.trim() ? t2Text.trim().split(/\s+/).length : 0;
      const totalWc = isMock ? (t1Wc + t2Wc) : (content.trim() ? content.trim().split(/\s+/).length : 0);

      const combinedText = isMock ? `--- TASK 1 ---\n${t1Text}\n\n--- TASK 2 ---\n${t2Text}` : content;

      // Check if Offline when submitting
      if (!navigator.onLine) {
        const operationId = `sub_pending_${id}_${dbUser.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const pendingSub: PendingSubmission = {
          operationId,
          taskId: id,
          studentId: dbUser.id,
          content: combinedText,
          task1Content: t1Text,
          task2Content: t2Text,
          task1WordCount: t1Wc,
          task2WordCount: t2Wc,
          wordCount: totalWc,
          pasteAttemptCount: pasteAttempts,
          suspiciousBurstFlag: suspiciousBurst,
          status: 'submitted',
          submittedAtLocal: Date.now(),
          startedAtMs: startedAtMsRef.current || Date.now(),
          expiresAtMs: expiresAtMsRef.current || (Date.now() + 3600000),
          activeTab,
          isMock,
          synced: false,
        };

        await savePendingSubmission(pendingSub);
        setIsPendingSync(true);
        setSubmission({
          id: operationId,
          status: 'submitted',
          content: combinedText,
          wordCount: totalWc,
          submittedAt: new Date(),
          isPendingSync: true,
        });

        setToastNotification('🎉 Test completed! Your answers are safely saved on this device and will be submitted automatically when the internet connection returns.');
        setTimeout(() => setToastNotification(''), 9000);
        setSubmitting(false);
        return;
      }

      // Online Direct Submit
      const res = await upsertSubmission(id, dbUser.id, {
        content: combinedText,
        task1Content: t1Text,
        task2Content: t2Text,
        task1WordCount: t1Wc,
        task2WordCount: t2Wc,
        wordCount: totalWc,
        pasteAttemptCount: pasteAttempts,
        suspiciousBurstFlag: suspiciousBurst,
        status: 'submitted'
      });
      
      setSubmission({ ...res, status: 'submitted' });
      lastSavedContentRef.current = combinedText;
      setSaveStatus('saved');
      
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

  const now = new Date();
  const startDate = task.startDate ? new Date(task.startDate) : null;
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  const isNotStarted = startDate && now < startDate;
  const isPastDue = dueDate && now > dueDate;
  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'graded';

  const isMock = task.ieltsType === 'mock';
  const currentWc = content.trim() ? content.trim().split(/\s+/).length : 0;
  const t1Wc = task1Content.trim() ? task1Content.trim().split(/\s+/).length : (activeTab === 'task1' ? currentWc : 0);
  const t2Wc = task2Content.trim() ? task2Content.trim().split(/\s+/).length : (activeTab === 'task2' ? currentWc : 0);
  const totalMockWc = t1Wc + t2Wc;

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl mx-auto pb-12">
      {/* Toast Notification Banner */}
      {toastNotification && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-indigo-600/90 border border-indigo-400/50 text-white text-sm font-semibold flex items-center justify-between shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <span>{toastNotification}</span>
          </div>
          <button onClick={() => setToastNotification('')} className="text-white/80 hover:text-white">
            ✕
          </button>
        </motion.div>
      )}

      {/* Top Header Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl">
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

          {/* Student UX Save Status Badge (Requirement 16) */}
          {!isSubmitted && (
            <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center border transition-all ${
              saveStatus === 'saved'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : saveStatus === 'saving'
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 animate-pulse'
                : saveStatus === 'offline'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {saveStatus === 'saved' && <><CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> ✓ Saved</>}
              {saveStatus === 'saving' && <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-indigo-400" /> Saving...</>}
              {saveStatus === 'offline' && <><WifiOff className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Offline — saved locally</>}
            </div>
          )}

          {isSubmitted ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-sm font-semibold flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              {isPendingSync ? 'Test completed — waiting for connection' : submission.status === 'graded' ? 'Graded' : 'Submitted'}
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

            {/* Task 1 Consistent Responsive Image Frame (Requirement 1) */}
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
                  className="relative w-full aspect-[4/3] sm:aspect-[16/10] min-h-[300px] sm:min-h-[380px] max-h-[480px] bg-slate-950 border border-slate-700/80 rounded-2xl group cursor-pointer p-1 flex items-center justify-center hover:border-indigo-500/70 transition-all shadow-xl overflow-hidden"
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
        </div>

        {/* Right Side: Writing Workspace Editor */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card p-4 sm:p-6 rounded-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold">
                  {isMock 
                    ? (activeTab === 'task1' ? 'Task 1 Response Area' : 'Task 2 Response Area')
                    : 'Essay Answer Area'
                  }
                </span>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                {currentWc} words
              </div>
            </div>

            <textarea
              disabled={isSubmitted || Boolean(isNotStarted) || Boolean(isPastDue)}
              value={content}
              onChange={e => setContent(e.target.value)}
              onPaste={handlePaste}
              onCut={handleCut}
              onCopy={handleCopy}
              onDrop={handleDragDrop}
              onKeyDown={handleKeyDown}
              placeholder={
                isSubmitted 
                  ? "Your essay has been submitted and locked." 
                  : isMock 
                  ? (activeTab === 'task1' ? "Write your Task 1 report response here..." : "Write your Task 2 essay response here...")
                  : "Write your complete essay response here..."
              }
              className="w-full min-h-[420px] glass-input p-4 rounded-xl text-sm font-sans leading-relaxed resize-y focus:outline-none disabled:opacity-80"
            />
          </div>
        </div>
      </div>

      {/* Confirmation Submit Modal */}
      <ConfirmModal
        isOpen={showConfirmSubmit}
        title="Confirm Exam Submission"
        message={
          isMock
            ? `Are you ready to submit your Full IELTS Mock Exam? (Task 1: ${t1Wc} words, Task 2: ${t2Wc} words, Total: ${totalMockWc} words). Once submitted, your answers will be sent for teacher evaluation.`
            : `Are you ready to submit your essay? (${currentWc} words). Once submitted, your answers will be sent for teacher evaluation.`
        }
        confirmText={submitting ? "Submitting..." : "Yes, Submit Exam"}
        cancelText="Keep Writing"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirmSubmit(false)}
      />

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={showLightbox}
        imageUrl={(isMock && activeTab === 'task1' ? (task?.task1ImageUrl || task?.imageUrl) : task?.imageUrl) || ''}
        title={`${task?.title || 'Task 1'} Diagram`}
        onClose={() => setShowLightbox(false)}
      />
    </div>
  );
}
