import React from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

const ConfirmModal: React.FC<Props> = ({ isOpen, title, body, confirmLabel, onConfirm, onCancel, isDangerous }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onCancel} />
      <div className="glass p-8 w-full max-w-sm relative space-y-6 border-white/70">
        <h2 className={`text-xl font-bold uppercase tracking-tighter ${isDangerous ? 'text-red-500' : 'text-white'}`}>{title}</h2>
        <p className="text-sm text-white leading-relaxed">{body}</p>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 border border-white/70 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-white/30">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-black ${isDangerous ? 'bg-red-500 text-white' : 'bg-white text-black'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
