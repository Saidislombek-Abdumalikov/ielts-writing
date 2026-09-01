import { DbTask, getAllTasks, getTasksForTeacher, getTasksForStudent, createTask, updateTask, deleteTask } from '../db';

export const TaskService = {
  getAll: async () => getAllTasks(),
  getForTeacher: async (teacherId: string) => getTasksForTeacher(teacherId),
  getForStudent: async (studentId: string) => getTasksForStudent(studentId),
  create: async (teacherId: string, taskData: any) => createTask(teacherId, taskData),
  update: async (id: string, taskData: Partial<DbTask>) => updateTask(id, taskData),
  delete: async (id: string) => deleteTask(id),
};
