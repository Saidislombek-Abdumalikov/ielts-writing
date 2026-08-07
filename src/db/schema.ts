import { boolean, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  username: varchar('username', { length: 100 }).unique().notNull(),
  email: varchar('email', { length: 255 }),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('student'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  teacherId: integer('teacher_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  ieltsType: varchar('ielts_type', { length: 20 }).notNull().default('task2'),
  assignmentMode: varchar('assignment_mode', { length: 20 }).notNull().default('full'),
  focusLabel: text('focus_label'),
  promptText: text('prompt_text').notNull(),
  imageUrl: text('image_url'),
  timerMinutes: integer('timer_minutes'),
  minTimerMinutes: integer('min_timer_minutes'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id).notNull(),
  studentId: integer('student_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  content: text('content').notNull().default(''),
  wordCount: integer('word_count').notNull().default(0),
  pasteAttemptCount: integer('paste_attempt_count').notNull().default(0),
  suspiciousBurstFlag: boolean('suspicious_burst_flag').notNull().default(false),
  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => submissions.id).notNull(),
  teacherId: integer('teacher_id').references(() => users.id).notNull(),
  bandScore: varchar('band_score', { length: 10 }).notNull(),
  comments: text('comments').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  submissions: many(submissions),
  feedback: many(feedback),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  teacher: one(users, {
    fields: [tasks.teacherId],
    references: [users.id],
  }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  task: one(tasks, {
    fields: [submissions.taskId],
    references: [tasks.id],
  }),
  student: one(users, {
    fields: [submissions.studentId],
    references: [users.id],
  }),
  feedback: many(feedback),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  submission: one(submissions, {
    fields: [feedback.submissionId],
    references: [submissions.id],
  }),
  teacher: one(users, {
    fields: [feedback.teacherId],
    references: [users.id],
  }),
}));
