-- =====================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR IELTS WRITING EDTECH PLATFORM
-- Multi-Tenant Role-Based Architecture with Row Level Security (RLS)
-- =====================================================================

-- 1. EXTENSIONS & CUSTOM ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE task_ielts_type AS ENUM ('task1', 'task2', 'mock');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'graded');

-- 2. EDUCATION CENTERS TABLE
CREATE TABLE IF NOT EXISTS centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PLATFORM USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'STUDENT',
  center_id UUID REFERENCES centers(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  group_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id UUID REFERENCES centers(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD CONSTRAINT fk_user_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;

-- 5. TASKS TABLE (IELTS WRITING ASSIGNMENTS)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  ielts_type task_ielts_type NOT NULL DEFAULT 'task2',
  assignment_mode TEXT DEFAULT 'full',
  focus_label TEXT,
  prompt_text TEXT NOT NULL,
  task1_prompt TEXT,
  task1_image_url TEXT,
  task2_prompt TEXT,
  image_url TEXT,
  timer_minutes INT DEFAULT 40,
  min_timer_minutes INT,
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SUBMISSIONS TABLE (STUDENT ESSAY SUBMISSIONS)
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  task1_content TEXT,
  task2_content TEXT,
  task1_word_count INT DEFAULT 0,
  task2_word_count INT DEFAULT 0,
  word_count INT DEFAULT 0,
  paste_attempt_count INT DEFAULT 0,
  suspicious_burst_flag BOOLEAN DEFAULT FALSE,
  status submission_status NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  operation_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, student_id)
);

-- 7. FEEDBACK TABLE (TEACHER EVALUATION & SCORES)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID UNIQUE NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  band_score TEXT NOT NULL,
  comments TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. INDEXES FOR HIGH-CONCURRENCY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_teacher_id ON users(teacher_id);
CREATE INDEX IF NOT EXISTS idx_tasks_teacher_id ON tasks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_student ON submissions(task_id, student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Students view Admin tasks & assigned Teacher tasks
CREATE POLICY student_view_tasks ON tasks FOR SELECT USING (
  teacher_id IN (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN'))
  OR teacher_id = (SELECT teacher_id FROM users WHERE id = auth.uid())
);

-- Teachers manage their own tasks & view Admin tasks
CREATE POLICY teacher_manage_tasks ON tasks FOR ALL USING (
  teacher_id = auth.uid() OR teacher_id IN (SELECT id FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Students manage their own submissions
CREATE POLICY student_submissions ON submissions FOR ALL USING (
  student_id = auth.uid()
);

-- Teachers view submissions from their assigned students
CREATE POLICY teacher_view_submissions ON submissions FOR SELECT USING (
  student_id IN (SELECT id FROM users WHERE teacher_id = auth.uid())
  OR task_id IN (SELECT id FROM tasks WHERE teacher_id = auth.uid())
);
