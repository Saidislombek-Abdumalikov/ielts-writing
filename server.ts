import express from 'express';
import path from 'path';
import { requireAuth, AuthRequest } from './src/middleware/auth';
import { createUser, getUserById, getUserByUsername } from './src/db/users';
import { db, initDbSchema, syncDb } from './src/db/index';
import { tasks, submissions, feedback, users } from './src/db/schema';
import { eq, desc, and, ne } from 'drizzle-orm';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function seedDatabase() {
  try {
    const passwordHashAdmin = await bcrypt.hash('admin1', 10);
    const admin = await getUserByUsername('admin');
    if (!admin) {
      await createUser({
        name: 'Admin',
        username: 'admin',
        passwordHash: passwordHashAdmin,
        role: 'admin'
      });
      console.log('Admin account seeded');
    } else {
      await db.update(users).set({ passwordHash: passwordHashAdmin, role: 'admin' }).where(eq(users.id, admin.id));
    }

    const passwordHashTeach = await bcrypt.hash('123', 10);
    const teacher = await getUserByUsername('teach');
    if (!teacher) {
      await createUser({
        name: 'Teacher',
        username: 'teach',
        passwordHash: passwordHashTeach,
        role: 'teacher'
      });
      console.log('Teacher account seeded');
    } else {
      await db.update(users).set({ passwordHash: passwordHashTeach, role: 'teacher' }).where(eq(users.id, teacher.id));
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

let appInstance: express.Express | null = null;

export async function createApp() {
  if (appInstance) return appInstance;

  await initDbSchema();
  await seedDatabase();
  
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Check health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Debug: dump all database contents (remove in production)
  app.get('/api/debug', async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      const allTasks = await db.select().from(tasks);
      const allSubmissions = await db.select().from(submissions);
      const allFeedback = await db.select().from(feedback);
      res.json({
        users: allUsers.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name })),
        tasks: allTasks.map(t => ({ id: t.id, title: t.title, teacherId: t.teacherId })),
        submissions: allSubmissions.map(s => ({ 
          id: s.id, taskId: s.taskId, studentId: s.studentId, 
          status: s.status, wordCount: s.wordCount, 
          contentLength: (s.content || '').length,
          submittedAt: s.submittedAt, updatedAt: s.updatedAt 
        })),
        feedback: allFeedback
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Login route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' });
        return;
      }
      const user = await getUserByUsername(username);
      if (!user) {
        res.status(401).json({ error: 'User does not exist. Please check your username.' });
        return;
      }
      
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Incorrect password. Please try again.' });
        return;
      }
      
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'fallback_secret_for_development',
        { expiresIn: '7d' }
      );
      
      const { passwordHash, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: error?.message || 'Login failed' });
    }
  });

  // Impersonate user account (Admin only)
  app.post('/api/auth/impersonate/:userId', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Admin only' });
        return;
      }
      
      const targetUserId = parseInt(req.params.userId);
      const targetUser = await getUserById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const token = jwt.sign(
        { id: targetUser.id, username: targetUser.username, role: targetUser.role, impersonatedByAdminId: req.user.id },
        process.env.JWT_SECRET || 'fallback_secret_for_development',
        { expiresIn: '1d' }
      );
      
      const { passwordHash, ...safeUser } = targetUser;
      res.json({ token, user: safeUser });
    } catch (error: any) {
      console.error('Impersonation error:', error);
      res.status(500).json({ error: 'Impersonation failed' });
    }
  });

  // Register route (Admin or Teacher only)
  app.post('/api/auth/register', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'teacher')) {
        res.status(403).json({ error: 'Forbidden: Only teachers and admins can create accounts' });
        return;
      }
      
      const { name, username, password, role } = req.body;
      if (!name || !username || !password) {
        res.status(400).json({ error: 'Name, username, and password required' });
        return;
      }

      if (role === 'admin' && req.user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Cannot create admin accounts' });
        return;
      }

      if (role === 'teacher' && req.user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Only admins can create teacher accounts' });
        return;
      }
      
      const existing = await getUserByUsername(username);
      if (existing) {
        res.status(400).json({ error: 'Username already taken' });
        return;
      }
      
      const passwordHash = await bcrypt.hash(password, 10);
      
      const newUser = await createUser({
        name,
        username,
        passwordHash,
        role: role || 'student'
      });
      
      const { passwordHash: _, ...safeUser } = newUser;
      await syncDb();
      res.json({ user: safeUser });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Get current user profile
  app.get('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const dbUser = await getUserById(req.user.id);
      if (!dbUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const { passwordHash, ...safeUser } = dbUser;
      res.json(safeUser);
    } catch (error: any) {
      console.error('Failed to get user:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  });

  // List all users (Admin & Teacher)
  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'teacher')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      let baseQuery = db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt
      }).from(users);

      if (req.user.role === 'teacher') {
        const allUsers = await baseQuery.where(eq(users.role, 'student')).orderBy(desc(users.createdAt));
        res.json(allUsers);
      } else {
        const allUsers = await baseQuery.orderBy(desc(users.createdAt));
        res.json(allUsers);
      }
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Edit user account credentials (Admin & Teacher)
  app.put('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'teacher')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      
      const targetUserId = parseInt(req.params.id);
      const targetUser = await getUserById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Teacher can only edit students
      if (req.user.role === 'teacher' && targetUser.role !== 'student') {
        res.status(403).json({ error: 'Forbidden: Teachers can only edit student accounts' });
        return;
      }

      const { name, username, password, role } = req.body;
      const updateData: any = {};

      if (name) updateData.name = name;
      if (username) {
        // Check if username unique
        const existing = await db.select().from(users).where(and(eq(users.username, username), ne(users.id, targetUserId)));
        if (existing.length > 0) {
          res.status(400).json({ error: 'Username is already taken by another user' });
          return;
        }
        updateData.username = username;
      }
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }
      if (role && req.user.role === 'admin') {
        updateData.role = role;
      }

      const updated = await db.update(users).set(updateData).where(eq(users.id, targetUserId)).returning();
      const { passwordHash, ...safeUser } = updated[0];
      res.json(safeUser);
    } catch (error: any) {
      console.error('Failed to update user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Delete user (Admin only)
  app.delete('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Admin only' });
        return;
      }
      const targetUserId = parseInt(req.params.id);
      if (targetUserId === req.user.id) {
        res.status(400).json({ error: 'Cannot delete your own admin account' });
        return;
      }
      
      // Delete user's feedback & submissions first due to FK constraints
      const userSubs = await db.select().from(submissions).where(eq(submissions.studentId, targetUserId));
      for (const sub of userSubs) {
        await db.delete(feedback).where(eq(feedback.submissionId, sub.id));
      }
      await db.delete(submissions).where(eq(submissions.studentId, targetUserId));
      await db.delete(feedback).where(eq(feedback.teacherId, targetUserId));
      await db.delete(tasks).where(eq(tasks.teacherId, targetUserId));
      await db.delete(users).where(eq(users.id, targetUserId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // List tasks
  app.get('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      
      if (req.user && req.user.role === 'student') {
        const userSubs = await db.select().from(submissions).where(eq(submissions.studentId, req.user.id));
        const subMap = new Map<number, any>();
        
        for (const s of userSubs) {
          let fb = null;
          if (s.status === 'graded') {
            const fbRes = await db.select().from(feedback).where(eq(feedback.submissionId, s.id)).orderBy(desc(feedback.createdAt));
            fb = fbRes[0] || null;
          }
          subMap.set(s.taskId, { ...s, feedback: fb });
        }

        const tasksWithSub = allTasks.map(t => ({
          ...t,
          submission: subMap.get(t.id) || null
        }));
        res.json(tasksWithSub);
        return;
      }

      res.json(allTasks);
    } catch (error: any) {
      console.error('Failed to fetch tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get specific task
  app.get('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const task = await db.select().from(tasks).where(eq(tasks.id, taskId));
      if (task.length === 0) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json(task[0]);
    } catch (error: any) {
      console.error('Failed to fetch task:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // Create task (Teacher or Admin)
  app.post('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const user = await getUserById(req.user.id);
      if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
        res.status(403).json({ error: 'Forbidden: Teachers and Admins only' });
        return;
      }
      
      const { title, ieltsType, assignmentMode, focusLabel, promptText, imageUrl, timerMinutes, minTimerMinutes, startDate, dueDate } = req.body;
      if (!title || !promptText || !dueDate) {
        res.status(400).json({ error: 'Title, prompt text, and due date are required' });
        return;
      }

      const parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        res.status(400).json({ error: 'Invalid due date format' });
        return;
      }
      
      const newTask = await db.insert(tasks).values({
        teacherId: user.id,
        title,
        ieltsType: ieltsType || 'task2',
        assignmentMode: assignmentMode || 'full',
        focusLabel: focusLabel || null,
        promptText,
        imageUrl: imageUrl || null,
        timerMinutes: timerMinutes ? Number(timerMinutes) : 40,
        minTimerMinutes: minTimerMinutes ? Number(minTimerMinutes) : null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: parsedDueDate
      }).returning();
      
      await syncDb();
      res.json(newTask[0]);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      res.status(500).json({ error: error?.message || 'Failed to create task' });
    }
  });

  // Edit task (Teacher or Admin)
  app.put('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const user = await getUserById(req.user.id);
      if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
        res.status(403).json({ error: 'Forbidden: Teachers and Admins only' });
        return;
      }
      
      const taskId = parseInt(req.params.id);
      const { title, ieltsType, assignmentMode, focusLabel, promptText, imageUrl, timerMinutes, minTimerMinutes, startDate, dueDate } = req.body;
      
      const updatePayload: any = {};
      if (title !== undefined) updatePayload.title = title;
      if (ieltsType !== undefined) updatePayload.ieltsType = ieltsType;
      if (assignmentMode !== undefined) updatePayload.assignmentMode = assignmentMode;
      if (focusLabel !== undefined) updatePayload.focusLabel = focusLabel;
      if (promptText !== undefined) updatePayload.promptText = promptText;
      if (imageUrl !== undefined) updatePayload.imageUrl = imageUrl;
      if (timerMinutes !== undefined) updatePayload.timerMinutes = Number(timerMinutes);
      if (minTimerMinutes !== undefined) updatePayload.minTimerMinutes = Number(minTimerMinutes);
      if (startDate !== undefined) updatePayload.startDate = startDate ? new Date(startDate) : null;
      if (dueDate !== undefined) updatePayload.dueDate = new Date(dueDate);

      const updatedTask = await db.update(tasks).set(updatePayload).where(eq(tasks.id, taskId)).returning();
      
      res.json(updatedTask[0]);
    } catch (error: any) {
      console.error('Failed to update task:', error);
      res.status(500).json({ error: error?.message || 'Failed to update task' });
    }
  });

  // Delete task (Teacher or Admin)
  app.delete('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const user = await getUserById(req.user.id);
      if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
        res.status(403).json({ error: 'Forbidden: Teachers and Admins only' });
        return;
      }
      
      const taskId = parseInt(req.params.id);
      
      // Delete associated feedback and submissions first due to FK constraints
      const taskSubmissions = await db.select().from(submissions).where(eq(submissions.taskId, taskId));
      for (const sub of taskSubmissions) {
        await db.delete(feedback).where(eq(feedback.submissionId, sub.id));
      }
      await db.delete(submissions).where(eq(submissions.taskId, taskId));
      await db.delete(tasks).where(eq(tasks.id, taskId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // Student submission sync (Draft or final)
  app.post('/api/submissions/:taskId', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const user = await getUserById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      const taskId = parseInt(req.params.taskId);
      const { content, wordCount, pasteAttemptCount, suspiciousBurstFlag, status } = req.body;
      
      console.log(`[Submit] User ${user.id} (${user.username}) -> Task ${taskId}, status=${status}, contentLen=${(content || '').length}`);

      // Check if submission already exists
      const existing = await db.select().from(submissions).where(
        and(eq(submissions.taskId, taskId), eq(submissions.studentId, user.id))
      );
      
      if (existing.length > 0) {
        const currentStatus = existing[0].status;
        // Never allow a draft auto-save to revert an already submitted or graded essay back to draft
        const targetStatus = (currentStatus === 'submitted' || currentStatus === 'graded')
          ? currentStatus
          : (status || currentStatus);

        console.log(`[Submit] Updating existing submission ${existing[0].id}: currentStatus=${currentStatus} -> targetStatus=${targetStatus}`);

        const updated = await db.update(submissions).set({
          content: content !== undefined ? content : existing[0].content,
          wordCount: wordCount !== undefined ? wordCount : existing[0].wordCount,
          pasteAttemptCount: Math.max(existing[0].pasteAttemptCount, pasteAttemptCount || 0),
          suspiciousBurstFlag: existing[0].suspiciousBurstFlag || Boolean(suspiciousBurstFlag),
          status: targetStatus,
          updatedAt: new Date(),
          submittedAt: targetStatus === 'submitted' 
            ? (existing[0].submittedAt || new Date()) 
            : existing[0].submittedAt,
        }).where(eq(submissions.id, existing[0].id)).returning();

        console.log(`[Submit] Updated submission ${updated[0].id}, final status=${updated[0].status}`);
        await syncDb();
        res.json(updated[0]);
      } else {
        console.log(`[Submit] Creating NEW submission for user ${user.id} on task ${taskId}`);
        const newSub = await db.insert(submissions).values({
          taskId,
          studentId: user.id,
          content: content || '',
          wordCount: wordCount || 0,
          pasteAttemptCount: pasteAttemptCount || 0,
          suspiciousBurstFlag: Boolean(suspiciousBurstFlag),
          status: status || 'draft',
          submittedAt: status === 'submitted' ? new Date() : null,
        }).returning();

        console.log(`[Submit] Created submission ${newSub[0].id}, status=${newSub[0].status}`);
        await syncDb();
        res.json(newSub[0]);
      }
    } catch (error: any) {
      console.error('Failed to save submission:', error);
      res.status(500).json({ error: 'Failed to save submission' });
    }
  });

  // Get student's submission for a task
  app.get('/api/submissions/:taskId/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const user = await getUserById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      const taskId = parseInt(req.params.taskId);
      const sub = await db.select().from(submissions).where(
        and(eq(submissions.taskId, taskId), eq(submissions.studentId, user.id))
      );
      
      if (sub.length === 0) {
        res.status(404).json({ error: 'No submission found' });
        return;
      }

      // get feedback if graded
      let fb = null;
      if (sub[0].status === 'graded') {
         const fbRes = await db.select().from(feedback).where(eq(feedback.submissionId, sub[0].id));
         fb = fbRes;
      }

      res.json({ ...sub[0], feedback: fb });
    } catch (error: any) {
      console.error('Failed to get submission:', error);
      res.status(500).json({ error: 'Failed to fetch submission' });
    }
  });

  // Get all submissions for a task with missing students roster (Teacher or Admin)
  app.get('/api/tasks/:taskId/submissions', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const user = await getUserById(req.user.id);
      if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
        res.status(403).json({ error: 'Forbidden: Teachers and Admins only' });
        return;
      }
      
      const taskId = parseInt(req.params.taskId);
      
      // Step 1: Get all student accounts (case-insensitive role check)
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        role: users.role,
      }).from(users);

      const allStudents = allUsers.filter(u => u.role && u.role.toLowerCase() === 'student');

      // Step 2: Get all submissions for this task (simple flat query, no joins)
      const taskSubmissions = await db.select().from(submissions)
        .where(eq(submissions.taskId, taskId))
        .orderBy(desc(submissions.updatedAt));

      console.log(`[Submissions] Task ${taskId}: Found ${taskSubmissions.length} raw submissions`);

      // Step 3: Build a user lookup map across all users
      const userMap = new Map<number, { id: number; name: string; username: string; email: string | null }>();
      for (const u of allUsers) {
        userMap.set(u.id, u);
      }

      // Step 4: Combine submissions with student info
      const allSubs = taskSubmissions.map(sub => ({
        submission: sub,
        student: userMap.get(sub.studentId) || { id: sub.studentId, name: 'Unknown Student', username: 'unknown', email: '' }
      }));

      // Step 5: Calculate missing students
      const submittedStudentIds = new Set(taskSubmissions.map(s => s.studentId));
      const missingStudents = allStudents.filter(st => !submittedStudentIds.has(st.id));
      
      const totalStudentsCount = allStudents.length;
      const submittedCount = taskSubmissions.filter(s => s.status === 'submitted' || s.status === 'graded').length;

      console.log(`[Submissions] Task ${taskId}: ${submittedCount} submitted, ${missingStudents.length} missing, ${totalStudentsCount} total students`);

      res.json({
        submissions: allSubs,
        totalStudents: totalStudentsCount,
        submittedCount,
        missingStudents
      });
    } catch (error: any) {
      console.error('Failed to get submissions:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  });
  
  // Submit feedback (Teacher or Admin)
  app.post('/api/submissions/:subId/feedback', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const user = await getUserById(req.user.id);
      if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
        res.status(403).json({ error: 'Forbidden: Teachers and Admins only' });
        return;
      }
      
      const subId = parseInt(req.params.subId);
      const { bandScore, comments } = req.body;
      
      // Update submission status to graded
      await db.update(submissions).set({ status: 'graded', updatedAt: new Date() }).where(eq(submissions.id, subId));
      
      const newFeedback = await db.insert(feedback).values({
        submissionId: subId,
        teacherId: user.id,
        bandScore,
        comments,
      }).returning();
      
      await syncDb();
      res.json(newFeedback[0]);
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  });
  
  // Get feedback for a submission
  app.get('/api/submissions/:subId/feedback', requireAuth, async (req: AuthRequest, res) => {
    try {
      const subId = parseInt(req.params.subId);
      const fb = await db.select().from(feedback).where(eq(feedback.submissionId, subId));
      
      if (fb.length === 0) {
        res.status(404).json({ error: 'No feedback found' });
        return;
      }
      res.json(fb[0]);
    } catch (error: any) {
      console.error('Failed to get feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  });

  appInstance = app;
  return app;
}

export async function startServer() {
  const app = await createApp();
  const PORT = process.env.PORT || 3000;

  // Catch-all 404 for API endpoints so Vite SPA fallback never serves HTML for API requests
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.originalUrl} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        watch: {
          ignored: ['**/.data/**', '**/.git/**'],
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
