import {
  DbSubmission,
  upsertSubmission,
  getTaskSubmissionsForTeacher,
  getStudentSubmissionWithFeedback,
  submitFeedback,
  syncPendingSubmissions,
} from '../db';

export const SubmissionService = {
  upsert: async (taskId: string, studentId: string, data: any): Promise<DbSubmission> =>
    upsertSubmission(taskId, studentId, data),
  getForTeacher: async (taskId: string, teacherId: string) =>
    getTaskSubmissionsForTeacher(taskId, teacherId),
  getWithFeedback: async (taskId: string, studentId: string) =>
    getStudentSubmissionWithFeedback(taskId, studentId),
  submitFeedback: async (submissionId: string, teacherId: string, bandScore: string, comments: string) =>
    submitFeedback(submissionId, teacherId, bandScore, comments),
  syncPending: async (studentId: string): Promise<number> =>
    syncPendingSubmissions(studentId),
};
