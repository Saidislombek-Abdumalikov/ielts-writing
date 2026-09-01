import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { getTaskById, getTaskSubmissions, getTaskSubmissionsForTeacher, getFeedbackForSubmission, submitFeedback, updateSubmissionByTeacher, grantExtraTimeForStudent } from '../lib/db';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Users, FileText, CheckCircle, Clock, 
  Sparkles, Send, ShieldAlert, Award, AlertCircle, RefreshCw, UserX, Unlock, Edit3, Save, X, History, ZoomIn
} from 'lucide-react';
import ImageLightboxModal from '../components/ImageLightboxModal';

function getTimeSpent(sub: any) {
  if (!sub) return 'N/A';
  const start = sub.createdAt ? new Date(sub.createdAt).getTime() : 0;
  const end = sub.submittedAt ? new Date(sub.submittedAt).getTime() : sub.updatedAt ? new Date(sub.updatedAt).getTime() : 0;
  if (!start || !end || end <= start) return '< 1m';

  const diffSecs = Math.max(1, Math.floor((end - start) / 1000));
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;

  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export default function EvaluationWorkspace() {
  const { id: taskId } = useParams<{ id: string }>();
  const { dbUser } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState<any>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [missingStudents, setMissingStudents] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [submittedCount, setSubmittedCount] = useState<number>(0);

  const [selectedSub, setSelectedSub] = useState<any>(null);
  const selectedSubIdRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<'submissions' | 'missing'>('submissions');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Grading form state
  const [bandScore, setBandScore] = useState<number>(6.5);
  const [comments, setComments] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [error, setError] = useState('');

  // Extra time modal state
  const [showExtraTimeModal, setShowExtraTimeModal] = useState(false);
  const [extraTimeInput, setExtraTimeInput] = useState<number>(15);
  const [grantingTime, setGrantingTime] = useState(false);

  // Teacher direct editing & unlock state & version history state
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [teacherContent, setTeacherContent] = useState('');
  const [savingContent, setSavingContent] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | 'current'>('current');
  const [showLightbox, setShowLightbox] = useState(false);

  const fetchSubmissionsData = async (isInitial = false) => {
    if (!taskId) return;
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const taskData = await getTaskById(taskId);
      setTask(taskData);

      const data = dbUser?.role === 'teacher' && dbUser?.id
        ? await getTaskSubmissionsForTeacher(taskId, dbUser.id)
        : await getTaskSubmissions(taskId);

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

  const loadExistingFeedback = async (subId: string) => {
    try {
      const fb = await getFeedbackForSubmission(subId);
      if (fb) {
        setBandScore(parseFloat(fb.bandScore) || 6.5);
        setComments(fb.comments || '');
      } else {
        setBandScore(6.5);
        setComments('');
      }
    } catch {
      setBandScore(6.5);
      setComments('');
    }
  };

  const handleSelectSubmission = (subItem: any) => {
    setSelectedSub(subItem);
    selectedSubIdRef.current = subItem.submission.id;
    setFeedbackSuccess('');
    setActionSuccess('');
    setError('');
    setIsEditingContent(false);
    setSelectedVersionIndex('current');
    setTeacherContent(subItem.submission.content || '');
    loadExistingFeedback(subItem.submission.id);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !dbUser) return;

    try {
      setSubmittingFeedback(true);
      setError('');
      await submitFeedback(selectedSub.submission.id, dbUser.id, bandScore.toString(), comments);
      
      setFeedbackSuccess('Feedback successfully published!');
      setTimeout(() => setFeedbackSuccess(''), 3000);

      fetchSubmissionsData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleUnlockForStudent = async () => {
    if (!selectedSub) return;
    try {
      setError('');
      await updateSubmissionByTeacher(selectedSub.submission.id, { status: 'draft' });
      setActionSuccess(`🔓 Unlocked for ${selectedSub.student.name}! The student can now edit and resubmit their response.`);
      setTimeout(() => setActionSuccess(''), 5000);
      fetchSubmissionsData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to unlock submission');
    }
  };

  const handleSaveTeacherContent = async () => {
    if (!selectedSub) return;
    try {
      setSavingContent(true);
      setError('');
      await updateSubmissionByTeacher(selectedSub.submission.id, { content: teacherContent });
      setIsEditingContent(false);
      setActionSuccess('✏️ Essay content updated successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
      fetchSubmissionsData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update essay content');
    } finally {
      setSavingContent(false);
    }
  };

  const handleGrantExtraTime = async () => {
    if (!selectedSub || !extraTimeInput || extraTimeInput <= 0) return;
    try {
      setGrantingTime(true);
      await grantExtraTimeForStudent(selectedSub.submission.id, extraTimeInput);
      setActionSuccess(`⏱️ Granted ${extraTimeInput} extra minutes to ${selectedSub.student.name}! Student can now log in and resume writing.`);
      setTimeout(() => setActionSuccess(''), 6000);
      setShowExtraTimeModal(false);
      await fetchSubmissionsData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to grant extra time');
    } finally {
      setGrantingTime(false);
    }
  };

  const downloadAsDoc = () => {
    if (!selectedSub) return;

    const studentName = selectedSub.student?.name || 'Student';
    const taskTitle = task?.title || 'IELTS_Writing_Task';
    const ieltsType = task?.ieltsType === 'mock' ? 'Full Mock Exam (Task 1 + Task 2)' : task?.ieltsType === 'task1' ? 'Task 1 Report' : 'Task 2 Essay';
    const sub = selectedSub.submission;

    const titleHeader = `IELTS Writing Evaluation — ${studentName}`;
    const dateStr = sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : new Date().toLocaleString();

    let bodyContent = `
      <html xmlns:o='urn:schemas-microsoft-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${titleHeader}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.6; }
          h1 { color: #4338ca; font-size: 20pt; margin-bottom: 5px; }
          h2 { color: #1e1b4b; font-size: 15pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; }
          .meta-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          .meta-item { font-size: 11pt; margin-bottom: 4px; }
          .badge { font-weight: bold; color: #047857; font-size: 13pt; }
          .essay-text { background-color: #ffffff; border: 1px solid #e2e8f0; padding: 16px; font-size: 11pt; white-space: pre-wrap; font-family: Georgia, serif; line-height: 1.7; }
          .feedback-box { background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <h1>${titleHeader}</h1>
        <div className="meta-box">
          <div className="meta-item"><strong>Student Name:</strong> ${studentName} (${selectedSub.student?.username || ''})</div>
          <div className="meta-item"><strong>Assignment Title:</strong> ${taskTitle}</div>
          <div className="meta-item"><strong>Exam Type:</strong> ${ieltsType}</div>
          <div className="meta-item"><strong>Submission Date:</strong> ${dateStr}</div>
          <div className="meta-item"><strong>Total Word Count:</strong> ${sub.wordCount || 0} words</div>
          ${sub.feedback?.bandScore ? `<div className="meta-item"><strong>Assessed Band Score:</strong> <span className="badge">Band ${sub.feedback.bandScore}</span></div>` : ''}
        </div>
    `;

    if (task?.ieltsType === 'mock') {
      bodyContent += `
        <h2>TASK 1 REPORT (${sub.task1WordCount || 0} words)</h2>
        <p><strong>Task 1 Prompt:</strong> ${task.task1Prompt || task.promptText || ''}</p>
        <div className="essay-text">${(sub.task1Content || 'No Task 1 response submitted.').replace(/\n/g, '<br/>')}</div>

        <h2>TASK 2 ESSAY (${sub.task2WordCount || 0} words)</h2>
        <p><strong>Task 2 Prompt:</strong> ${task.task2Prompt || ''}</p>
        <div className="essay-text">${(sub.task2Content || 'No Task 2 response submitted.').replace(/\n/g, '<br/>')}</div>
      `;
    } else {
      bodyContent += `
        <h2>STUDENT ESSAY RESPONSE</h2>
        <p><strong>Prompt:</strong> ${task?.promptText || ''}</p>
        <div className="essay-text">${(sub.content || '').replace(/\n/g, '<br/>')}</div>
      `;
    }

    if (sub.feedback?.comments) {
      bodyContent += `
        <h2>TEACHER EVALUATION & FEEDBACK</h2>
        <div className="feedback-box">
          <strong>Teacher Comments:</strong>
          <p>${sub.feedback.comments.replace(/\n/g, '<br/>')}</p>
        </div>
      `;
    }

    bodyContent += `</body></html>`;

    const blob = new Blob(['\ufeff' + bodyContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${studentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${taskTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const notSubmittedCount = totalStudents - submittedCount;
  const gradedSubs = submissionsList.filter(s => s.submission.status === 'graded');
  const validScores = gradedSubs.map(s => parseFloat(s.submission.feedback?.bandScore)).filter(s => !isNaN(s) && s > 0);
  const avgTestBandScore = validScores.length > 0 
    ? (validScores.reduce((acc, s) => acc + s, 0) / validScores.length).toFixed(1) 
    : null;

  return (
    <div className="space-y-6 animate-fade-up w-full max-w-[95%] lg:max-w-[90%] mx-auto pt-8 sm:pt-12 pb-12 px-2 sm:px-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-indigo-500/20">
          <div>
            <p className="text-xs text-slate-400 font-medium">Enrolled Students</p>
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

        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-purple-500/20">
          <div>
            <p className="text-xs text-slate-400 font-medium">Graded Submissions</p>
            <p className="text-2xl font-bold text-purple-300">{gradedSubs.length}</p>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-amber-500/20">
          <div>
            <p className="text-xs text-slate-400 font-medium">{avgTestBandScore ? 'Average Band Score' : 'Not Submitted Yet'}</p>
            <p className="text-2xl font-bold text-amber-400">
              {avgTestBandScore ? `Band ${avgTestBandScore}` : notSubmittedCount > 0 ? notSubmittedCount : 0}
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
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
            <div className="space-y-2">
              {submissionsList.map(item => {
                const sub = item.submission;
                const student = item.student;
                const isSelected = selectedSub?.submission.id === sub.id;

                return (
                  <motion.div 
                    key={sub.id}
                    whileHover={{ scale: 1.005 }}
                    onClick={() => handleSelectSubmission(item)}
                    className={`glass-card p-2.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-md' 
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center space-x-1.5 truncate mr-2">
                        <h4 className="font-semibold text-xs text-slate-200 truncate">{student.name}</h4>
                        <span className="text-[10px] text-slate-400 truncate">@{student.username}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        sub.status === 'graded' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : sub.status === 'submitted'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {sub.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/50">
                      <span>{sub.wordCount || 0} words</span>
                      <span className="text-indigo-400 font-semibold">⏱️ {getTimeSpent(sub)}</span>
                      <span className="text-slate-300">
                        {sub.submittedAt 
                          ? new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : 'Drafting'}
                      </span>
                    </div>

                    {(sub.pasteAttemptCount > 0 || sub.suspiciousBurstFlag) && (
                      <div className="mt-1 text-[10px] text-amber-400 flex items-center">
                        <ShieldAlert className="w-3 h-3 mr-1 shrink-0" />
                        Integrity Flags
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {submissionsList.length === 0 && (
                <div className="glass-card p-6 text-center text-slate-400 rounded-xl text-xs">
                  No student has submitted this assignment yet.
                </div>
              )}
            </div>
          ) : (
            /* Missing Students List */
            <div className="space-y-2">
              {missingStudents.map((student: any) => (
                <div key={student.id} className="glass-card p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="truncate mr-2">
                      <h4 className="font-semibold text-slate-200 truncate">{student.name}</h4>
                      <p className="text-[10px] text-slate-400 truncate">@{student.username}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold shrink-0">
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
          <div className="lg:col-span-8 space-y-4">
            {/* Action success alert */}
            {actionSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center shadow-md">
                <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Student Submission View Header & Actions */}
            <div className="glass-card p-4 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg font-bold">{selectedSub.student.name}</h2>
                  <p className="text-xs text-slate-400">@{selectedSub.student.username}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="glass-card px-2.5 py-1 rounded-lg flex items-center font-medium text-slate-200">
                    <Clock className="w-3.5 h-3.5 mr-1 text-indigo-400 shrink-0" />
                    Time Spent: <strong className="text-indigo-400 ml-1 font-bold">{getTimeSpent(selectedSub.submission)}</strong>
                  </span>
                  <span className="glass-card px-2.5 py-1 rounded-lg text-slate-300">Words: <strong className="text-indigo-400">{selectedSub.submission.wordCount}</strong></span>
                  <span className="glass-card px-2.5 py-1 rounded-lg text-slate-300">Status: <strong className="text-indigo-400 capitalize">{selectedSub.submission.status}</strong></span>
                </div>
              </div>

              {/* Task 1 Diagram Compact Preview for Teacher */}
              {(task?.imageUrl || task?.task1ImageUrl) && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                  <div 
                    onClick={() => setShowLightbox(true)}
                    className="relative group cursor-pointer h-20 w-32 shrink-0 bg-slate-950 rounded-lg overflow-hidden border border-slate-700 flex items-center justify-center p-1"
                  >
                    <img 
                      src={task.task1ImageUrl || task.imageUrl} 
                      alt="Task 1 Diagram" 
                      className="w-full h-full object-contain rounded"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ZoomIn className="w-4 h-4 text-indigo-300" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <span className="text-xs font-bold text-indigo-300 block">Task 1 Visual Diagram</span>
                    <span className="text-[11px] text-slate-400">Compact teacher reference view. Click preview to open full-screen lightbox.</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLightbox(true)}
                    className="px-3 py-1.5 rounded-xl glass-card text-xs text-indigo-300 hover:text-white font-semibold flex items-center border border-indigo-500/30 shrink-0"
                  >
                    <ZoomIn className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Open Full Image
                  </button>
                </div>
              )}

              {/* Action Buttons for Teacher: Grant Extra Time & Download (.doc) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center space-x-2">
                  {(selectedSub.submission.status === 'submitted' || selectedSub.submission.status === 'graded') && (
                    <button
                      type="button"
                      onClick={() => setShowExtraTimeModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold flex items-center transition-colors shadow-sm"
                      title="Grant student extra minutes to finish and resubmit their exam"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                      ⏱️ Grant Extra Time & Resume
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={downloadAsDoc}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-semibold flex items-center transition-colors shadow-sm"
                    title="Download complete essay & teacher evaluation report as Microsoft Word (.doc)"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Download (.doc)
                  </button>
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

              {/* Essay Text View OR Teacher Edit View */}
              {isEditingContent ? (
                <div className="space-y-2">
                  <p className="text-xs text-indigo-300 font-medium">✏️ Editing {selectedSub.student.name}'s essay content directly as teacher:</p>
                  <textarea 
                    rows={12}
                    className="w-full glass-input p-4 rounded-xl text-slate-100 text-sm font-mono leading-relaxed resize-none focus:outline-none"
                    value={teacherContent}
                    onChange={e => setTeacherContent(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedVersionIndex !== 'current' && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center">
                      <History className="w-4 h-4 mr-2 text-amber-400 shrink-0" />
                      Viewing Historical Version {selectedSub.submission.versions[selectedVersionIndex]?.versionNumber || (selectedVersionIndex + 1)} (Snapshot taken before re-opening).
                    </div>
                  )}
                  <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed p-4 rounded-xl bg-slate-900/80 border border-slate-800 whitespace-pre-wrap font-mono min-h-[220px]">
                    {selectedVersionIndex === 'current' 
                      ? (selectedSub.submission.content || <span className="text-slate-500 italic">No essay response written.</span>)
                      : (selectedSub.submission.versions[selectedVersionIndex]?.content || <span className="text-slate-500 italic">No essay response written in this version.</span>)
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Evaluation Form */}
            <form onSubmit={handleSubmitFeedback} className="glass-card p-4 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <h3 className="text-base font-bold flex items-center">
                  <Award className="w-4 h-4 mr-2 text-indigo-400" />
                  Teacher Evaluation & Scoring
                </h3>
                {selectedSub.submission.status === 'graded' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 w-fit">
                    Editing Previously Published Feedback
                  </span>
                )}
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
                  {submittingFeedback ? 'Saving...' : selectedSub.submission.status === 'graded' ? 'Update Feedback & Grade' : 'Publish Evaluation'}
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

      {/* High Resolution Task 1 Diagram Lightbox Modal */}
      <ImageLightboxModal
        isOpen={showLightbox}
        imageUrl={task?.task1ImageUrl || task?.imageUrl || ''}
        title={`${task?.title || 'Task 1'} Diagram`}
        onClose={() => setShowLightbox(false)}
      />

      {/* Grant Extra Time Modal */}
      {showExtraTimeModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl space-y-4 border border-amber-500/40 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold flex items-center text-amber-300">
                  <Clock className="w-5 h-5 mr-2 text-amber-400" />
                  Grant Extra Writing Time
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Allow <strong>{selectedSub.student.name}</strong> to log in and continue writing for a limited time.
                </p>
              </div>
              <button 
                onClick={() => setShowExtraTimeModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Select or Enter Extra Time (Minutes):
              </label>
              
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
                {[5, 10, 15, 20, 30].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExtraTimeInput(mins)}
                    className={`py-2 rounded-xl transition-all border ${
                      extraTimeInput === mins 
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md' 
                        : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-amber-500/40'
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <span className="text-xs text-slate-400 block mb-1">Custom Minutes:</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  className="w-full glass-input px-4 py-2 rounded-xl text-sm"
                  value={extraTimeInput}
                  onChange={e => setExtraTimeInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExtraTimeModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGrantExtraTime}
                disabled={grantingTime}
                className="gradient-btn px-5 py-2 rounded-xl text-xs font-bold flex items-center shadow-lg disabled:opacity-50"
              >
                {grantingTime ? 'Granting Time...' : `Confirm +${extraTimeInput}m & Unlock`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
