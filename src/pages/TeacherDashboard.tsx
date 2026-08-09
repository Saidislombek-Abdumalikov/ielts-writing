import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { getAllTasks, createTask, updateTask, deleteTask } from '../lib/db';
import { uploadTask1Image } from '../lib/storage';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Plus, Users, Search, Edit2, Trash2, Calendar, Image as ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function TeacherDashboard() {
  const { dbUser } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  
  const getTwoDaysFromNowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const defaultTask = {
    title: '',
    ieltsType: 'task2',
    assignmentMode: 'full',
    focusLabel: '',
    promptText: '',
    task1Prompt: '',
    task1ImageUrl: '',
    task2Prompt: '',
    imageUrl: '',
    timerMinutes: 40,
    startDate: new Date().toISOString().slice(0, 16),
    dueDate: getTwoDaysFromNowString()
  };
  
  const [newTask, setNewTask] = useState(defaultTask);
  const navigate = useNavigate();

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setImageError('');
      const uploadedUrl = await uploadTask1Image(file);
      setNewTask(prev => ({
        ...prev,
        imageUrl: uploadedUrl,
        task1ImageUrl: uploadedUrl
      }));
    } catch (err: any) {
      setImageError(err.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const loadTasks = async () => {
    const t = await getAllTasks();
    setTasks(t);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      await updateTask(editingTask, newTask);
    } else {
      await createTask(dbUser!.id, newTask);
    }
    setShowCreate(false);
    setEditingTask(null);
    loadTasks();
    setNewTask(defaultTask);
  };

  const handleEdit = (task: any) => {
    setNewTask({
      title: task.title,
      ieltsType: task.ieltsType,
      assignmentMode: task.assignmentMode || 'full',
      focusLabel: task.focusLabel || '',
      promptText: task.promptText || '',
      task1Prompt: task.task1Prompt || '',
      task1ImageUrl: task.task1ImageUrl || task.imageUrl || '',
      task2Prompt: task.task2Prompt || '',
      imageUrl: task.imageUrl || '',
      timerMinutes: task.timerMinutes || 40,
      startDate: task.startDate ? new Date(task.startDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      dueDate: new Date(task.dueDate).toISOString().slice(0, 16)
    });
    setEditingTask(task.id);
    setShowCreate(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTaskId) {
      await deleteTask(deleteTaskId);
      setDeleteTaskId(null);
      loadTasks();
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.ieltsType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Teacher Dashboard</h2>
          <p className="text-sm text-slate-400">Manage assignments, track student submissions, and evaluate responses.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search assignments..." 
              className="glass-input pl-9 pr-4 py-2 rounded-xl text-sm w-full sm:w-64"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => {
              setShowCreate(!showCreate);
              if (editingTask) {
                setEditingTask(null);
                setNewTask(defaultTask);
              }
            }}
            className="gradient-btn px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center shadow-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Assignment
          </button>
        </div>
      </div>

      {showCreate && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card p-4 sm:p-6 rounded-2xl overflow-hidden"
          onSubmit={handleCreateOrUpdate}
        >
          <h3 className="text-lg sm:text-xl font-semibold mb-6">{editingTask ? 'Edit Assignment' : 'New Assignment'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title</label>
                <input type="text" required className="w-full glass-input px-4 py-2 rounded-lg text-sm" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="e.g. Full Academic Writing Mock Exam 1" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">IELTS Type</label>
                  <select 
                    className="w-full glass-input px-4 py-2 rounded-lg appearance-none text-sm bg-slate-900" 
                    value={newTask.ieltsType} 
                    onChange={e => {
                      const type = e.target.value;
                      setNewTask({
                        ...newTask, 
                        ieltsType: type,
                        timerMinutes: type === 'mock' ? 60 : type === 'task1' ? 20 : 40
                      });
                    }}
                  >
                    <option value="task1">Task 1 (Report - 20m)</option>
                    <option value="task2">Task 2 (Essay - 40m)</option>
                    <option value="mock">🏆 Full IELTS Mock Exam (Task 1 + 2, 60m Shared Timer)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Assignment Mode</label>
                  <select className="w-full glass-input px-4 py-2 rounded-lg appearance-none text-sm bg-slate-900" value={newTask.assignmentMode} onChange={e => setNewTask({...newTask, assignmentMode: e.target.value})}>
                    <option value="full">Full Exam</option>
                    <option value="partly">Partly (e.g. Focus area)</option>
                  </select>
                </div>
              </div>
              
              {newTask.assignmentMode === 'partly' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Focus Area (e.g., Overview only)</label>
                  <input className="w-full glass-input px-4 py-2 rounded-lg text-sm" value={newTask.focusLabel} onChange={e => setNewTask({...newTask, focusLabel: e.target.value})} placeholder="e.g. Write Introduction and Overview" />
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Total Exam Timer (minutes)</label>
                <input type="number" required className="w-full glass-input px-4 py-2 rounded-lg text-sm" value={newTask.timerMinutes} onChange={e => setNewTask({...newTask, timerMinutes: parseInt(e.target.value)})} />
                <p className="text-xs text-slate-500 mt-1">Shared total timer for the entire exam (e.g., 60 or 70 mins)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1" /> Start Date & Time
                  </label>
                  <input type="datetime-local" required className="w-full glass-input px-4 py-2 rounded-lg text-sm" value={newTask.startDate} onChange={e => setNewTask({...newTask, startDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1" /> Finish Deadline
                  </label>
                  <input type="datetime-local" required className="w-full glass-input px-4 py-2 rounded-lg text-sm" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
                </div>
              </div>
            </div>
            
            {newTask.ieltsType === 'mock' ? (
              <div className="flex flex-col space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-indigo-300 mb-1">Task 1 Question / Prompt (Report)</label>
                  <textarea required className="w-full min-h-[90px] glass-input px-4 py-3 rounded-lg resize-none text-sm" value={newTask.task1Prompt || newTask.promptText} onChange={e => setNewTask({...newTask, task1Prompt: e.target.value, promptText: e.target.value})} placeholder="Enter Task 1 prompt..." />
                </div>
                
                {/* Image Upload for Task 1 */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center">
                    <ImageIcon className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                    Task 1 Visual Diagram / Graph Image (Optional)
                  </label>
                  {newTask.imageUrl || newTask.task1ImageUrl ? (
                    <div className="relative group w-fit rounded-xl overflow-hidden border border-slate-700 bg-slate-900 p-2 flex items-center space-x-3">
                      <img src={newTask.imageUrl || newTask.task1ImageUrl} alt="Task 1 preview" className="h-16 w-24 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => setNewTask({...newTask, imageUrl: '', task1ImageUrl: ''})}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors text-xs flex items-center"
                      >
                        <X className="w-4 h-4 mr-1" /> Remove Image
                      </button>
                    </div>
                  ) : (
                    <div className="relative border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-4 text-center transition-all bg-slate-900/40">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        disabled={uploadingImage}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center space-y-1">
                        {uploadingImage ? (
                          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        ) : (
                          <Upload className="w-6 h-6 text-slate-400" />
                        )}
                        <span className="text-xs text-slate-300 font-medium">
                          {uploadingImage ? 'Uploading Image to Cloud Storage...' : 'Click or Drag Task 1 Graph / Map / Chart Image here'}
                        </span>
                        <span className="text-[10px] text-slate-500">Supports PNG, JPG, WEBP, SVG (Max 5MB)</span>
                      </div>
                    </div>
                  )}
                  {imageError && <p className="text-xs text-red-400 font-medium">{imageError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-indigo-300 mb-1">Task 2 Question / Prompt (Essay)</label>
                  <textarea required className="w-full min-h-[90px] glass-input px-4 py-3 rounded-lg resize-none text-sm" value={newTask.task2Prompt} onChange={e => setNewTask({...newTask, task2Prompt: e.target.value})} placeholder="Enter Task 2 essay prompt..." />
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Prompt / Question</label>
                  <textarea required className="w-full min-h-[140px] glass-input px-4 py-3 rounded-lg resize-none text-sm" value={newTask.promptText} onChange={e => setNewTask({...newTask, promptText: e.target.value})} placeholder="Enter the exact prompt..." />
                </div>

                {newTask.ieltsType === 'task1' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300 flex items-center">
                      <ImageIcon className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                      Task 1 Visual Diagram / Graph Image (Optional)
                    </label>
                    {newTask.imageUrl ? (
                      <div className="relative group w-fit rounded-xl overflow-hidden border border-slate-700 bg-slate-900 p-2 flex items-center space-x-3">
                        <img src={newTask.imageUrl} alt="Task 1 preview" className="h-16 w-24 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setNewTask({...newTask, imageUrl: ''})}
                          className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors text-xs flex items-center"
                        >
                          <X className="w-4 h-4 mr-1" /> Remove Image
                        </button>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-4 text-center transition-all bg-slate-900/40">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          disabled={uploadingImage}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <div className="flex flex-col items-center space-y-1">
                          {uploadingImage ? (
                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                          ) : (
                            <Upload className="w-6 h-6 text-slate-400" />
                          )}
                          <span className="text-xs text-slate-300 font-medium">
                            {uploadingImage ? 'Uploading Image to Cloud Storage...' : 'Click or Drag Task 1 Graph / Map / Chart Image here'}
                          </span>
                          <span className="text-[10px] text-slate-500">Supports PNG, JPG, WEBP, SVG (Max 5MB)</span>
                        </div>
                      </div>
                    )}
                    {imageError && <p className="text-xs text-red-400 font-medium">{imageError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => { setShowCreate(false); setEditingTask(null); setNewTask(defaultTask); }} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" className="gradient-btn px-6 py-2 rounded-xl text-sm font-medium">{editingTask ? 'Update Task' : 'Publish Task'}</button>
          </div>
        </motion.form>
      )}

      <div className="grid grid-cols-1 mb-10">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center justify-between">
          <span>Active Assignments & Submissions</span>
          <span className="text-sm font-normal text-slate-400">{filteredTasks.length} tasks</span>
        </h3>
        <div className="glass-card rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider bg-slate-900/50">
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Type & Mode</th>
                <th className="px-6 py-4 font-medium">Start Date</th>
                <th className="px-6 py-4 font-medium">Deadline</th>
                <th className="px-6 py-4 font-medium text-right">Submissions & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTasks.map(task => (
                <tr key={task.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium">
                    <div>{task.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 uppercase tracking-wider">
                        {task.ieltsType}
                      </span>
                      {task.assignmentMode === 'partly' && (
                        <span className="px-2 py-1 text-xs rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Partly
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {task.startDate ? new Date(task.startDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Immediate'}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {new Date(task.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end space-x-3">
                    <button 
                      onClick={() => navigate(`/teacher/submissions/${task.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-semibold flex items-center transition-colors"
                      title="View Submissions & Missing Roster"
                    >
                      <Users className="w-3.5 h-3.5 mr-1.5" />
                      Submissions
                    </button>
                    <button 
                      onClick={() => handleEdit(task)}
                      className="text-slate-400 hover:text-white transition-colors"
                      title="Edit Task"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteTaskId(task.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    No assignments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal 
        isOpen={deleteTaskId !== null}
        title="Delete Assignment"
        message="Are you sure you want to delete this assignment and all student submissions associated with it?"
        confirmText="Delete Task"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTaskId(null)}
      />
    </div>
  );
}
