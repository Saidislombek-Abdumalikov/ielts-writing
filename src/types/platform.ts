/**
 * EdTech Platform Domain Definitions & Role Hierarchy.
 * Prepares the architecture for Student <-> Teacher <-> Education Center <-> Admin infrastructure.
 * Protected core IELTS Writing logic types remain backward compatible.
 */

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';

export interface EducationCenter {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface PlatformUser {
  id: string;
  telegram_id?: string | null;
  username: string;
  name: string;
  email?: string | null;
  role: UserRole;
  center_id?: string | null;
  teacher_id?: string | null;
  group_id?: string | null;
  created_at: string;
}

export interface PlatformGroup {
  id: string;
  center_id: string;
  teacher_id: string;
  name: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface PlatformCourse {
  id: string;
  center_id?: string | null;
  title: string;
  description?: string | null;
  created_at: string;
}
