import { DbGroup, getGroupsForTeacher, createGroup, deleteGroup } from '../db';

export const GroupService = {
  getForTeacher: async (teacherId: string): Promise<DbGroup[]> => getGroupsForTeacher(teacherId),
  create: async (data: { name: string; teacherId: string }): Promise<DbGroup> => createGroup(data),
  delete: async (groupId: string): Promise<void> => deleteGroup(groupId),
};
