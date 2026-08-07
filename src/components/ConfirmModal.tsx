import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 w-full max-w-md glass-card p-6 rounded-2xl shadow-2xl border border-slate-700/50 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${
                  variant === 'danger'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : variant === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                }`}>
                  {variant === 'danger' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-100">{title}</h3>
              </div>
              <button
                onClick={onCancel}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {message}
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-sm font-medium glass-card hover:bg-slate-800 transition-colors text-slate-300"
              >
                {cancelText}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md ${
                  variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : variant === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'gradient-btn text-white'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
