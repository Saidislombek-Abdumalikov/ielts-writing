import {
  DbUser,
  getAllUsers,
  getUserById,
  getUserByUsername,
  getTeacherStudents,
  createUser,
  deleteUser,
  assignStudentToGroup,
  assignStudentToTeacher,
  verifyPassword,
} from '../db';

export const UserService = {
  getAll: async (): Promise<DbUser[]> => getAllUsers(),
  getById: async (id: string): Promise<DbUser | null> => getUserById(id),
  getByUsername: async (username: string): Promise<DbUser | null> => getUserByUsername(username),
  getStudentsForTeacher: async (teacherId: string): Promise<DbUser[]> => getTeacherStudents(teacherId),
  create: async (data: { name: string; username: string; password: string; role: string; groupId?: string | null; teacherId?: string | null }): Promise<DbUser> =>
    createUser(data),
  delete: async (id: string): Promise<void> => deleteUser(id),
  assignGroup: async (studentId: string, groupId: string | null): Promise<DbUser> => assignStudentToGroup(studentId, groupId),
  assignTeacher: async (studentId: string, teacherId: string | null): Promise<DbUser> => assignStudentToTeacher(studentId, teacherId),
  verifyPassword: async (input: string, hash: string): Promise<boolean> => verifyPassword(input, hash),
};
