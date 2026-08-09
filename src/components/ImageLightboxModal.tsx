import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, Download } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  imageUrl: string;
  title?: string;
  onClose: () => void;
}

export default function ImageLightboxModal({ isOpen, imageUrl, title, onClose }: ImageLightboxModalProps) {
  if (!isOpen || !imageUrl) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative max-w-5xl w-full max-h-[90vh] glass-card p-4 sm:p-6 rounded-2xl flex flex-col items-center overflow-hidden border-slate-700 bg-slate-950/90 shadow-2xl"
        >
          <div className="flex items-center justify-between w-full pb-3 border-b border-slate-800">
            <h3 className="text-base sm:text-lg font-bold text-slate-200 truncate flex items-center">
              <ZoomIn className="w-5 h-5 mr-2 text-indigo-400" />
              {title || 'Task 1 Prompt Visual Graph / Diagram'}
            </h3>
            <div className="flex items-center space-x-2">
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Download image"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full overflow-auto flex items-center justify-center p-2 sm:p-4">
            <img
              src={imageUrl}
              alt="Task 1 Visual Prompt High Res"
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-slate-800"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
