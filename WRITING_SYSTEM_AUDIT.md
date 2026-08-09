# Phase 0 — IELTS Writing Test Engine System Audit Report

**Date**: August 9, 2026  
**Status**: Audit Complete — Pending Approval for Phase 1 Implementation

---

## Executive Summary & Overview

This system audit reviews the existing IELTS Writing Web Application codebase (`ielts-writing-app`) in accordance with the Master Prompt instructions. The application is a client-side Single Page Application (SPA) built using **React 19**, **Vite 6**, **TypeScript**, **Tailwind CSS v4**, and **Firebase SDK (Firestore)**.

All legacy serverless Express/Node APIs and PostgreSQL/Drizzle code have been removed; the app interacts directly with Cloud Firestore in the browser via standard SDK calls (`src/lib/db.ts`).

---

## 1. Current Architecture

- **Frontend**: React 19 + Vite 6 + TypeScript + React Router v8 + Tailwind CSS v4 + Framer Motion (`motion/react`) + Lucide Icons.
- **Backend / Database**: Cloud Firestore (`firebase/app`, `firebase/firestore`). Client-side direct database access via `src/lib/db.ts`.
- **Authentication**: Custom client-side session authentication backed by Firestore `users` collection documents with SHA-256 password hashes (`hashPassword`). User sessions stored in `localStorage` (`userId` and `originalAdminUserId`).
- **File / Image Storage**: Currently, tasks store an optional `imageUrl` string (URL string or empty). No direct Firebase Storage / Object Storage image upload pipeline is active in the task creation form yet.

---

## 2. Current Data Flow

```
[Student / Teacher Browser UI]
       │
       ▼
[React Component State / Local Storage]
       │ (Direct SDK Calls via src/lib/db.ts)
       ▼
[Cloud Firestore Database]
   ├── users (collection)
   ├── tasks (collection)
   ├── submissions (collection)
   └── feedback (collection)
```

1. **Authentication**: `AuthContext` restores `userId` from `localStorage` and fetches user document from `users` collection.
2. **Tasks Loading**: `getTasksForStudent` fetches all `tasks`, matching `submissions` for the student, and `feedback` documents in parallel.
3. **Writing & Auto-save**: Student typing in `TaskWorkspace.tsx` triggers a debounced timer (2.5 seconds) calling `upsertSubmission`, which performs `addDoc` or `updateDoc` on the `submissions` collection.
4. **Grading & Feedback**: `EvaluationWorkspace.tsx` polls `submissions` every 3 seconds for the active task. When teacher submits score/comments, `submitFeedback` updates `submissions` status to `graded` and creates/updates a `feedback` document.

---

## 3. Current Writing Flow

- **Page**: `src/pages/TaskWorkspace.tsx`
- **Behavior**:
  - Displays prompt, title, and IELTS type (`task1` or `task2`).
  - Single `<textarea>` for student response.
  - Strict anti-cheat handlers (`handlePaste`, `handleCut`, `handleCopy`, `handleDragDrop`, `handleKeyDown`) block copying, cutting, pasting, and drag-and-drop.
  - Prompt container includes `select-none` to prevent text copying.
  - Word count is computed locally via regex split `content.trim().split(/\s+/)`.

---

## 4. Current Timer Flow

- **Page**: `src/pages/TaskWorkspace.tsx`
- **Implementation**:
  - `localStorage` key `task_timer_start_${id}_${studentId}` stores the initial timestamp (in ms) when the task was first opened.
  - On page load, `elapsedSecs = Math.floor((nowMs - startTimeMs) / 1000)` is calculated.
  - `remainingSecs = Math.max(0, totalSecs - elapsedSecs)` sets the countdown timer.
  - Every 1 second, a React `setInterval` decrements `timeLeft`.
  - When `timeLeft <= 0`, if essay is unsubmitted, `handleConfirmSubmit()` is automatically triggered.
- **Gaps**:
  - The timer is per-task (`task.timerMinutes`), NOT a **shared exam timer** for a combined Task 1 + Task 2 mock exam.
  - The expiration time is calculated client-side (backed by `localStorage` + initial `submission.createdAt`).

---

## 5. Current Autosave Flow

- **Trigger**: React `useEffect` listening to `content` changes in `TaskWorkspace.tsx`.
- **Interval**: 2500 ms debounce timeout.
- **Behavior**:
  - Checks if content changed since `lastSavedContentRef.current`.
  - Sends full content to Firestore via `upsertSubmission(id, dbUser.id, { content, wordCount, ... })`.
  - Updates `lastSavedContentRef.current` upon success.
- **Gaps**:
  - Does NOT currently use IndexedDB or secondary local draft queue for offline persistence.
  - If network disconnects during typing, changes remain only in transient React component state; refreshing while offline could cause data loss if auto-save failed.

---

## 6. Current Submission Flow

- **Student Submit**:
  - Student clicks "Submit Essay" -> ConfirmModal opens.
  - Upon confirmation, `upsertSubmission` sets `status: 'submitted'` and `submittedAt: Timestamp.now()`.
  - Sets `isSubmittedRef.current = true` to halt further auto-saves.
  - UI switches to read-only status.
- **Re-submitting / Re-opening**:
  - In `EvaluationWorkspace.tsx`, teacher can click `🔓 Allow Student to Edit (Unlock)`.
  - Calls `updateSubmissionByTeacher(subId, { status: 'draft' })`.
  - Overwrites existing submission record status back to `draft`.
- **Gaps**:
  - Overwrites the single `submissions` document rather than creating a **Submission Version History** (`Version 1`, `Version 2`, etc.).

---

## 7. Current Teacher Flow

- **Pages**: `src/pages/TeacherDashboard.tsx` & `src/pages/EvaluationWorkspace.tsx`
- **Capabilities**:
  - Create & edit tasks (title, ieltsType, assignmentMode, promptText, timerMinutes, startDate, dueDate).
  - View roster of registered students vs received submissions vs missing students.
  - Live polling every 3 seconds for new student submissions.
  - Grade submission with Band Score (0.0–9.0) and written comments.
  - Unlock submission (`status: 'draft'`) so student can edit.
  - Teacher direct content edit (`updateSubmissionByTeacher`).

---

## 8. Current Task 1 Image Flow

- **Task Field**: `task.imageUrl` string field in `DbTask` schema.
- **Current State**: Tasks rely on external URL string inputs or text. No file picker, image upload button, storage bucket upload pipeline, image validation, or optimization exists yet.

---

## 9. Performance Bottlenecks

1. **Auto-save Frequency & Heavy Payloads**: Auto-saving sends the entire essay string to Firestore every 2.5 seconds.
2. **Polling Frequency**: `EvaluationWorkspace.tsx` polls `getTaskSubmissions` every 3 seconds, fetching all users and all submissions repeatedly.
3. **No Offline Queue**: Network retries are non-existent; failed requests log to `console.error` without offline retry queues.

---

## 10. Data-Loss Risks

1. **Network Drop During Tab Refresh**: If the student loses connection while typing and refreshes the browser before the 2.5s auto-save succeeds, un-saved text in memory is lost.
2. **Single Submission Document**: Re-opening a task overwrites the existing submission status and content rather than preserving Version 1, Version 2, etc.
3. **Single Task Isolation**: Students cannot take a unified 60-minute Mock Exam combining Task 1 + Task 2 seamlessly with a shared timer.

---

## 11. Existing Bugs & Limitations

1. **No Shared Exam Engine**: Tasks are treated as isolated individual assignments (either Task 1 OR Task 2), not a unified 60-minute Mock Exam containing both Task 1 and Task 2.
2. **No Image File Upload**: Task 1 image must be manually pasted as an external URL string.
3. **No Version History**: Re-opening overwrites previous submission records.

---

## 12. Recommended Architecture

```
[Student Editor Component]
       │
       ▼ (Instant 0ms React State Update)
[Local State & IndexedDB / LocalStorage Cache] (Instant Local Protection)
       │
       ▼ (Debounced 1000ms + Periodic 5s Backup)
[Firestore Database]
   ├── users
   ├── tasks
   ├── writing_mocks / mock_attempts (Shared 60m Timer)
   ├── submissions (With Version History Array/Subcollection)
   └── feedback
```

1. **Local-First Editor**: Write state to `IndexedDB` / `localStorage` synchronously on every stroke. Sync to Firestore via debounced queue.
2. **Shared Mock Exam Engine**:
   - `MockAttempt` record in Firestore with `startedAt`, `expiresAt` (server-calculated), `durationSeconds: 3600`.
   - Single shared 60-minute countdown timer across Task 1 & Task 2 tabs.
3. **Submission Versioning**:
   - Store submission versions array (`versions: [{ version: 1, task1Content, task2Content, submittedAt }]`).
4. **Task 1 Image Storage**:
   - Integrate Firebase Storage (`getStorage`, `uploadBytes`, `getDownloadURL`) with validation (PNG/JPG/WEBP < 5MB).

---

## 13. Files That Need Modification (Future Phases)

- `src/lib/firebase.ts`: Add `getStorage` export for Firebase Storage.
- `src/lib/db.ts`: Add Mock Exam types, Submission Version types, Firebase Storage upload helpers.
- `src/pages/TaskWorkspace.tsx`: Upgrade to Local-First IndexedDB persistence, shared 60-min timer, Task 1 + Task 2 tab switching.
- `src/pages/TeacherDashboard.tsx`: Add Task 1 image upload file picker and Mock Exam creator.
- `src/pages/EvaluationWorkspace.tsx`: Support viewing submission version history (Version 1 vs Version 2).

---

## 14. Database Changes Required (No Destructive Migrations)

- **`tasks` collection**: Add optional `mockExamId`, `task1ImageRef` metadata object.
- **`submissions` collection**: Add `versions` array field to preserve historical submissions.
- **`mock_attempts` collection (New)**: Store shared mock exam sessions (`studentId`, `startedAt`, `expiresAt`, `durationSeconds`, `task1Draft`, `task2Draft`, `status`).

---

## 15. Migration & Compatibility Risks

- **Existing Data Compatibility**: All existing single `tasks` and single `submissions` documents in Firestore must remain 100% readable. New versioning and mock features must fallback gracefully when viewing legacy submissions.
- **Data Safety**: Zero destructive operations will be executed. Old data will be preserved under all circumstances.

---

> [!IMPORTANT]
> **PHASE 0 AUDIT COMPLETE.** No application code or database schemas have been altered. Awaiting user approval to proceed to **PHASE 1 (Writing Performance Architecture)**.
