/**
 * Firestore Database Service
 * Replaces all Express backend API calls with direct Firestore operations.
 * Runs entirely in the browser — no serverless functions needed.
 */
import { firestore } from './firebase';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, setDoc
} from 'firebase/firestore';
import { getPendingSubmissions, markPendingSubmissionSynced } from './draftManager';

// ============== TYPES ==============

export interface DbUser {
  id: string;           // Firestore doc ID
  name: string;
  username: string;
  email: string | null;
  passwordHash: string; // simple hash for username/password auth
  role: 'student' | 'teacher' | 'admin';
  createdAt: Date;
}

export interface DbTask {
  id: string;
  teacherId: string;
  title: string;
  ieltsType: string;         // 'task1' | 'task2' | 'mock'
  assignmentMode: string;
  focusLabel: string | null;
  promptText: string;
  task1Prompt?: string | null;
  task1ImageUrl?: string | null;
  task2Prompt?: string | null;
  imageUrl: string | null;
  timerMinutes: number | null;
  minTimerMinutes: number | null;
  startDate: Date | null;
  dueDate: Date;
  createdAt: Date;
}

export interface SubmissionVersion {
  versionNumber: number;
  content: string;
  task1Content?: string | null;
  task2Content?: string | null;
  wordCount: number;
  submittedAt?: Date | string | null;
  unlockedAt?: Date | string | null;
}

export interface DbSubmission {
  id: string;
  taskId: string;
  studentId: string;
  status: string;
  content: string;
  task1Content?: string | null;
  task2Content?: string | null;
  task1WordCount?: number;
  task2WordCount?: number;
  wordCount: number;
  pasteAttemptCount: number;
  suspiciousBurstFlag: boolean;
  currentVersion?: number;
  versions?: SubmissionVersion[];
  startedAt?: Date | null;
  expiresAt?: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbFeedback {
  id: string;
  submissionId: string;
  teacherId: string;
  bandScore: string;
  comments: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============== HELPERS ==============

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return null;
}

function toDateRequired(v: any): Date {
  return toDate(v) || new Date();
}

// Simple password hashing (client-side, good enough for a classroom app)
export async function hashPassword(password: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + '_ielts_salt_2024');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('crypto.subtle unavailable, using fallback hash:', e);
  }
  // Fallback string transformation if crypto.subtle is unavailable
  let hash = 0;
  const str = password + '_ielts_salt_2024';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// ============== USERS ==============

const usersCol = () => collection(firestore, 'users');

export async function getUserByUsername(username: string): Promise<DbUser | null> {
  const q = query(usersCol(), where('username', '==', username.trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data(), createdAt: toDateRequired(d.data().createdAt) } as DbUser;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const d = await getDoc(doc(firestore, 'users', id));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data(), createdAt: toDateRequired(d.data().createdAt) } as DbUser;
}

export async function createUser(data: { name: string; username: string; password: string; role: string }): Promise<DbUser> {
  const passwordHash = await hashPassword(data.password);
  const now = new Date();
  const docRef = await addDoc(usersCol(), {
    name: data.name,
    username: data.username.trim().toLowerCase(),
    email: null,
    passwordHash,
    role: data.role || 'student',
    createdAt: Timestamp.fromDate(now),
  });
  return {
    id: docRef.id,
    name: data.name,
    username: data.username.trim().toLowerCase(),
    email: null,
    passwordHash,
    role: data.role as any,
    createdAt: now,
  };
}

export async function getAllUsers(): Promise<DbUser[]> {
  const snap = await getDocs(query(usersCol(), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({
    id: d.id, ...d.data(), createdAt: toDateRequired(d.data().createdAt),
  } as DbUser));
}

export async function updateUser(id: string, data: Partial<{ name: string; username: string; password: string; role: string }>): Promise<DbUser> {
  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.username) updateData.username = data.username.trim().toLowerCase();
  if (data.password) updateData.passwordHash = await hashPassword(data.password);
  if (data.role) updateData.role = data.role;
  
  await updateDoc(doc(firestore, 'users', id), updateData);
  const updated = await getUserById(id);
  return updated!;
}

export async function deleteUser(id: string): Promise<void> {
  // Delete user's submissions and feedback
  const subsSnap = await getDocs(query(collection(firestore, 'submissions'), where('studentId', '==', id)));
  for (const s of subsSnap.docs) {
    const fbSnap = await getDocs(query(collection(firestore, 'feedback'), where('submissionId', '==', s.id)));
    for (const f of fbSnap.docs) await deleteDoc(f.ref);
    await deleteDoc(s.ref);
  }
  // Delete feedback given by this user (if teacher)
  const fbByUser = await getDocs(query(collection(firestore, 'feedback'), where('teacherId', '==', id)));
  for (const f of fbByUser.docs) await deleteDoc(f.ref);
  // Delete tasks created by this user
  const tasksSnap = await getDocs(query(collection(firestore, 'tasks'), where('teacherId', '==', id)));
  for (const t of tasksSnap.docs) await deleteDoc(t.ref);
  // Delete user
  await deleteDoc(doc(firestore, 'users', id));
}

// ============== SEED & PURGE ==============

export async function purgeLegacyDefaultAccounts() {
  try {
    const snap = await getDocs(usersCol());
    for (const d of snap.docs) {
      const u = d.data();
      if (u.username === 'admin' || u.username === 'teach') {
        await deleteDoc(d.ref);
      }
    }
  } catch (err) {
    console.warn('Purge legacy accounts note:', err);
  }
}

export async function seedDefaultAccounts() {
  // Automatic account seeding disabled completely.
  await purgeLegacyDefaultAccounts();
}

// ============== TASKS ==============

const tasksCol = () => collection(firestore, 'tasks');

export async function getAllTasks(): Promise<DbTask[]> {
  const snap = await getDocs(query(tasksCol(), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    startDate: toDate(d.data().startDate),
    dueDate: toDateRequired(d.data().dueDate),
    createdAt: toDateRequired(d.data().createdAt),
  } as DbTask));
}

export async function getTaskById(id: string): Promise<DbTask | null> {
  try {
    const d = await getDoc(doc(firestore, 'tasks', id));
    if (!d.exists()) return null;
    const taskObj: DbTask = {
      id: d.id,
      ...d.data(),
      startDate: toDate(d.data().startDate),
      dueDate: toDateRequired(d.data().dueDate),
      createdAt: toDateRequired(d.data().createdAt),
    } as DbTask;

    try {
      localStorage.setItem(`task_cache_${id}`, JSON.stringify(taskObj));
    } catch {
      // Ignore quota errors
    }

    return taskObj;
  } catch (e) {
    console.warn('Network task fetch fail, checking local cache:', e);
    const cached = localStorage.getItem(`task_cache_${id}`);
    if (cached) {
      try { return JSON.parse(cached) as DbTask; } catch { /* Ignore */ }
    }
    return null;
  }
}

export async function createTask(teacherId: string, data: any): Promise<DbTask> {
  const now = new Date();
  const docRef = await addDoc(tasksCol(), {
    teacherId,
    title: data.title,
    ieltsType: data.ieltsType || 'task2',
    assignmentMode: data.assignmentMode || 'full',
    focusLabel: data.focusLabel || null,
    promptText: data.promptText,
    task1Prompt: data.task1Prompt || null,
    task1ImageUrl: data.task1ImageUrl || null,
    task2Prompt: data.task2Prompt || null,
    imageUrl: data.imageUrl || null,
    timerMinutes: data.timerMinutes ? Number(data.timerMinutes) : 40,
    minTimerMinutes: data.minTimerMinutes ? Number(data.minTimerMinutes) : null,
    startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
    dueDate: Timestamp.fromDate(new Date(data.dueDate)),
    createdAt: Timestamp.fromDate(now),
  });
  return { id: docRef.id, teacherId, ...data, createdAt: now } as DbTask;
}

export async function updateTask(id: string, data: any): Promise<DbTask> {
  const updatePayload: any = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.ieltsType !== undefined) updatePayload.ieltsType = data.ieltsType;
  if (data.assignmentMode !== undefined) updatePayload.assignmentMode = data.assignmentMode;
  if (data.focusLabel !== undefined) updatePayload.focusLabel = data.focusLabel;
  if (data.promptText !== undefined) updatePayload.promptText = data.promptText;
  if (data.task1Prompt !== undefined) updatePayload.task1Prompt = data.task1Prompt;
  if (data.task1ImageUrl !== undefined) updatePayload.task1ImageUrl = data.task1ImageUrl;
  if (data.task2Prompt !== undefined) updatePayload.task2Prompt = data.task2Prompt;
  if (data.imageUrl !== undefined) updatePayload.imageUrl = data.imageUrl;
  if (data.timerMinutes !== undefined) updatePayload.timerMinutes = Number(data.timerMinutes);
  if (data.minTimerMinutes !== undefined) updatePayload.minTimerMinutes = Number(data.minTimerMinutes);
  if (data.startDate !== undefined) updatePayload.startDate = data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null;
  if (data.dueDate !== undefined) updatePayload.dueDate = Timestamp.fromDate(new Date(data.dueDate));

  await updateDoc(doc(firestore, 'tasks', id), updatePayload);
  return (await getTaskById(id))!;
}

export async function deleteTask(id: string): Promise<void> {
  // Delete associated feedback and submissions
  const subsSnap = await getDocs(query(collection(firestore, 'submissions'), where('taskId', '==', id)));
  for (const s of subsSnap.docs) {
    const fbSnap = await getDocs(query(collection(firestore, 'feedback'), where('submissionId', '==', s.id)));
    for (const f of fbSnap.docs) await deleteDoc(f.ref);
    await deleteDoc(s.ref);
  }
  await deleteDoc(doc(firestore, 'tasks', id));
}

// ============== SUBMISSIONS ==============

const subsCol = () => collection(firestore, 'submissions');

export async function getStudentSubmission(taskId: string, studentId: string): Promise<DbSubmission | null> {
  const q = query(subsCol(), where('taskId', '==', taskId), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return {
    id: d.id, ...d.data(),
    startedAt: toDate(d.data().startedAt),
    expiresAt: toDate(d.data().expiresAt),
    submittedAt: toDate(d.data().submittedAt),
    createdAt: toDateRequired(d.data().createdAt),
    updatedAt: toDateRequired(d.data().updatedAt),
  } as DbSubmission;
}

export async function upsertSubmission(
  taskId: string,
  studentId: string,
  data: Partial<{
    content: string;
    task1Content?: string | null;
    task2Content?: string | null;
    task1WordCount?: number;
    task2WordCount?: number;
    wordCount: number;
    pasteAttemptCount: number;
    suspiciousBurstFlag: boolean;
    status: 'draft' | 'submitted' | 'graded';
    startedAt?: Date | null;
    expiresAt?: Date | null;
    submittedAtDate?: Date | null;
    operationId?: string;
  }>
): Promise<DbSubmission> {
  const existing = await getStudentSubmission(taskId, studentId);
  const now = new Date();

  // Idempotency Protection: check if this operationId was already synchronized
  if (data.operationId && existing && (existing as any).operationId === data.operationId && existing.status === 'submitted') {
    return existing;
  }

  if (existing) {
    const currentStatus = existing.status;
    const targetStatus = (currentStatus === 'submitted' || currentStatus === 'graded')
      ? currentStatus
      : (data.status || currentStatus);

    const updateData: any = {
      content: data.content !== undefined ? data.content : existing.content,
      wordCount: data.wordCount !== undefined ? data.wordCount : existing.wordCount,
      pasteAttemptCount: Math.max(existing.pasteAttemptCount, data.pasteAttemptCount || 0),
      suspiciousBurstFlag: existing.suspiciousBurstFlag || Boolean(data.suspiciousBurstFlag),
      status: targetStatus,
      updatedAt: Timestamp.fromDate(now),
    };

    if (data.operationId) updateData.operationId = data.operationId;
    if (data.task1Content !== undefined) updateData.task1Content = data.task1Content;
    if (data.task2Content !== undefined) updateData.task2Content = data.task2Content;
    if (data.task1WordCount !== undefined) updateData.task1WordCount = data.task1WordCount;
    if (data.task2WordCount !== undefined) updateData.task2WordCount = data.task2WordCount;
    if (data.startedAt) updateData.startedAt = Timestamp.fromDate(new Date(data.startedAt));
    if (data.expiresAt) updateData.expiresAt = Timestamp.fromDate(new Date(data.expiresAt));
    
    if (targetStatus === 'submitted') {
      const submitDate = data.submittedAtDate || now;
      if (!existing.submittedAt || data.submittedAtDate) {
        updateData.submittedAt = Timestamp.fromDate(submitDate);
      }
    }

    await updateDoc(doc(firestore, 'submissions', existing.id), updateData);
    return { ...existing, ...updateData, updatedAt: now, submittedAt: updateData.submittedAt ? toDateRequired(updateData.submittedAt) : existing.submittedAt };
  } else {
    const submitDate = data.submittedAtDate || now;
    const newSub: any = {
      taskId,
      studentId,
      content: data.content || '',
      wordCount: data.wordCount || 0,
      pasteAttemptCount: data.pasteAttemptCount || 0,
      suspiciousBurstFlag: Boolean(data.suspiciousBurstFlag),
      status: data.status || 'draft',
      submittedAt: data.status === 'submitted' ? Timestamp.fromDate(submitDate) : null,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    if (data.operationId) newSub.operationId = data.operationId;
    if (data.task1Content !== undefined) newSub.task1Content = data.task1Content;
    if (data.task2Content !== undefined) newSub.task2Content = data.task2Content;
    if (data.task1WordCount !== undefined) newSub.task1WordCount = data.task1WordCount;
    if (data.task2WordCount !== undefined) newSub.task2WordCount = data.task2WordCount;
    if (data.startedAt) newSub.startedAt = Timestamp.fromDate(new Date(data.startedAt));
    if (data.expiresAt) newSub.expiresAt = Timestamp.fromDate(new Date(data.expiresAt));

    const docRef = await addDoc(subsCol(), newSub);
    return {
      id: docRef.id, ...newSub,
      submittedAt: newSub.submittedAt ? submitDate : null,
      createdAt: now,
      updatedAt: now,
    } as DbSubmission;
  }
}

export async function syncPendingSubmissions(studentId: string): Promise<number> {
  const pendings = await getPendingSubmissions(studentId);
  if (!pendings || pendings.length === 0) return 0;

  let syncedCount = 0;
  for (const pending of pendings) {
    try {
      await upsertSubmission(pending.taskId, pending.studentId, {
        content: pending.content,
        task1Content: pending.task1Content,
        task2Content: pending.task2Content,
        task1WordCount: pending.task1WordCount,
        task2WordCount: pending.task2WordCount,
        wordCount: pending.wordCount,
        pasteAttemptCount: pending.pasteAttemptCount,
        suspiciousBurstFlag: pending.suspiciousBurstFlag,
        status: 'submitted',
        startedAt: pending.startedAtMs ? new Date(pending.startedAtMs) : null,
        expiresAt: pending.expiresAtMs ? new Date(pending.expiresAtMs) : null,
        submittedAtDate: pending.submittedAtLocal ? new Date(pending.submittedAtLocal) : new Date(),
        operationId: pending.operationId,
      });

      await markPendingSubmissionSynced(pending.operationId, pending.taskId, pending.studentId);
      syncedCount++;
    } catch (e) {
      console.warn('Sync pending submission retry error:', e);
    }
  }
  return syncedCount;
}

export async function updateSubmissionByTeacher(subId: string, data: Partial<{ content: string; status: string; wordCount: number }>): Promise<void> {
  const subDoc = await getDoc(doc(firestore, 'submissions', subId));
  if (!subDoc.exists()) return;
  const existing = subDoc.data();

  const updateData: any = {
    updatedAt: Timestamp.fromDate(new Date()),
  };

  if (data.content !== undefined) {
    updateData.content = data.content;
    updateData.wordCount = data.content.trim() ? data.content.trim().split(/\s+/).length : 0;
  }

  // If unlocking submission (changing status from submitted/graded to draft)
  if (data.status === 'draft' && (existing.status === 'submitted' || existing.status === 'graded')) {
    const curVer = existing.currentVersion || 1;
    const existingVersions = existing.versions || [];
    
    const versionSnapshot = {
      versionNumber: curVer,
      content: existing.content || '',
      task1Content: existing.task1Content || null,
      task2Content: existing.task2Content || null,
      wordCount: existing.wordCount || 0,
      submittedAt: existing.submittedAt ? existing.submittedAt : null,
      unlockedAt: Timestamp.fromDate(new Date()),
    };

    updateData.status = 'draft';
    updateData.startedAt = null;
    updateData.expiresAt = null;
    updateData.submittedAt = null;
    updateData.currentVersion = curVer + 1;
    updateData.versions = [...existingVersions, versionSnapshot];
  } else if (data.status !== undefined) {
    updateData.status = data.status;
  }

  await updateDoc(doc(firestore, 'submissions', subId), updateData);
}

export async function grantExtraTimeForStudent(subId: string, extraMinutes: number): Promise<void> {
  const subSnap = await getDoc(doc(firestore, 'submissions', subId));
  if (!subSnap.exists()) throw new Error('Submission not found');
  const existing = subSnap.data();

  const nowMs = Date.now();
  const expiresMs = nowMs + (extraMinutes * 60 * 1000);
  const curVer = existing.currentVersion || 1;
  const existingVersions = existing.versions || [];

  const versionSnapshot = {
    versionNumber: curVer,
    content: existing.content || '',
    task1Content: existing.task1Content || null,
    task2Content: existing.task2Content || null,
    wordCount: existing.wordCount || 0,
    submittedAt: existing.submittedAt ? existing.submittedAt : null,
    unlockedAt: Timestamp.fromDate(new Date()),
  };

  const updateData: any = {
    status: 'draft',
    submittedAt: null,
    startedAt: Timestamp.fromDate(new Date(nowMs)),
    expiresAt: Timestamp.fromDate(new Date(expiresMs)),
    extraTimeMinutes: extraMinutes,
    currentVersion: curVer + 1,
    versions: [...existingVersions, versionSnapshot],
    updatedAt: Timestamp.fromDate(new Date(nowMs)),
  };

  await updateDoc(doc(firestore, 'submissions', subId), updateData);
}

let cachedUsers: any[] | null = null;
let lastUsersFetch = 0;

export async function getTaskSubmissions(taskId: string): Promise<{ submissions: any[]; totalStudents: number; submittedCount: number; missingStudents: any[] }> {
  const now = Date.now();
  
  // Cache user list for 60 seconds to prevent heavy repetitive Firestore reads when multiple users write
  let allUsers: any[] = [];
  if (!cachedUsers || (now - lastUsersFetch > 60000)) {
    const allUsersSnap = await getDocs(usersCol());
    allUsers = allUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedUsers = allUsers;
    lastUsersFetch = now;
  } else {
    allUsers = cachedUsers;
  }

  const subsSnap = await getDocs(query(subsCol(), where('taskId', '==', taskId)));

  const allStudents = allUsers.filter((u: any) => u.role?.toLowerCase() === 'student');

  const taskSubmissions = subsSnap.docs.map(d => ({
    id: d.id, ...d.data(),
    submittedAt: toDate(d.data().submittedAt),
    createdAt: toDateRequired(d.data().createdAt),
    updatedAt: toDateRequired(d.data().updatedAt),
  }));

  // Sort by updatedAt descending
  taskSubmissions.sort((a: any, b: any) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));

  // Build user map
  const userMap = new Map<string, any>();
  for (const u of allUsers) userMap.set(u.id, u);

  // Combine
  const combined = taskSubmissions.map((sub: any) => ({
    submission: sub,
    student: userMap.get(sub.studentId) || { id: sub.studentId, name: 'Unknown', username: 'unknown', email: '' },
  }));

  // Missing students
  const submittedStudentIds = new Set(taskSubmissions.map((s: any) => s.studentId));
  const missingStudents = allStudents.filter((st: any) => !submittedStudentIds.has(st.id));

  const submittedCount = taskSubmissions.filter((s: any) => s.status === 'submitted' || s.status === 'graded').length;

  return {
    submissions: combined,
    totalStudents: allStudents.length,
    submittedCount,
    missingStudents,
  };
}

// ============== FEEDBACK ==============

const feedbackCol = () => collection(firestore, 'feedback');

export async function getFeedbackForSubmission(submissionId: string): Promise<DbFeedback | null> {
  const q = query(feedbackCol(), where('submissionId', '==', submissionId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return {
    id: d.id, ...d.data(),
    createdAt: toDateRequired(d.data().createdAt),
    updatedAt: toDateRequired(d.data().updatedAt),
  } as DbFeedback;
}

export async function submitFeedback(submissionId: string, teacherId: string, bandScore: string, comments: string): Promise<DbFeedback> {
  const now = new Date();
  
  // Mark submission as graded
  await updateDoc(doc(firestore, 'submissions', submissionId), {
    status: 'graded',
    updatedAt: Timestamp.fromDate(now),
  });

  // Check if feedback already exists, update or create
  const existing = await getFeedbackForSubmission(submissionId);
  if (existing) {
    await updateDoc(doc(firestore, 'feedback', existing.id), {
      bandScore,
      comments,
      updatedAt: Timestamp.fromDate(now),
    });
    return { ...existing, bandScore, comments, updatedAt: now };
  }

  const docRef = await addDoc(feedbackCol(), {
    submissionId,
    teacherId,
    bandScore,
    comments,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  return {
    id: docRef.id, submissionId, teacherId, bandScore, comments,
    createdAt: now, updatedAt: now,
  };
}

// ============== TASKS WITH STUDENT SUBMISSIONS ==============

export async function getTasksForStudent(studentId: string): Promise<any[]> {
  // Fetch tasks and student submissions concurrently in parallel
  const [tasks, subsSnap] = await Promise.all([
    getAllTasks(),
    getDocs(query(subsCol(), where('studentId', '==', studentId)))
  ]);

  const studentSubs = subsSnap.docs.map(d => ({
    id: d.id, ...d.data(),
    submittedAt: toDate(d.data().submittedAt),
    createdAt: toDateRequired(d.data().createdAt),
    updatedAt: toDateRequired(d.data().updatedAt),
  }));

  const subMap = new Map<string, any>();
  const gradedSubIds: string[] = [];

  for (const s of studentSubs) {
    const taskId = (s as any).taskId;
    subMap.set(taskId, s);
    if ((s as any).status === 'graded') {
      gradedSubIds.push(s.id);
    }
  }

  // Fetch all feedback for graded submissions concurrently in parallel
  const feedbacks = await Promise.all(gradedSubIds.map(id => getFeedbackForSubmission(id)));
  
  const fbMap = new Map<string, any>();
  feedbacks.forEach(fb => {
    if (fb) fbMap.set(fb.submissionId, fb);
  });

  return tasks.map(task => {
    const sub = subMap.get(task.id) || null;
    const feedback = sub ? (fbMap.get(sub.id) || null) : null;
    return {
      ...task,
      submission: sub ? { ...sub, feedback } : null,
    };
  });
}

// Get student submission with feedback for TaskWorkspace
export async function getStudentSubmissionWithFeedback(taskId: string, studentId: string): Promise<any | null> {
  const sub = await getStudentSubmission(taskId, studentId);
  if (!sub) return null;
  
  let feedback: any = null;
  if (sub.status === 'graded') {
    const fb = await getFeedbackForSubmission(sub.id);
    feedback = fb ? [fb] : [];
  }
  
  return { ...sub, feedback };
}
