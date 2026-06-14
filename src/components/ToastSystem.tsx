import React, { useEffect } from 'react';
import { useStore } from '../StoreContext';

const ToastSystem: React.FC = () => {
  const { state, dispatch } = useStore();
  const { toasts } = state;

  useEffect(() => {
    toasts.forEach(toast => {
      const timer = setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', id: toast.id });
      }, 5000);
      return () => clearTimeout(timer);
    });
  }, [toasts, dispatch]);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={`pointer-events-auto glass p-4 rounded-sm border-l-4 shadow-xl min-w-[300px] animate-in slide-in-from-right duration-300 ${
            toast.type === 'error' ? 'border-red-500' : 
            toast.type === 'success' ? 'border-green-500' : 
            toast.type === 'warning' ? 'border-amber-500' : 'border-blue-500'
          }`}
        >
          <div className="flex justify-between items-start gap-4">
            <p className="text-sm font-medium">{toast.message}</p>
            <button 
              onClick={() => dispatch({ type: 'REMOVE_TOAST', id: toast.id })}
              className="text-white/90 hover:text-white"
            >
              ✕
            </button>
          </div>
          {toast.action && (
            <button 
              onClick={toast.action.onClick}
              className="mt-2 text-[10px] uppercase tracking-widest font-bold text-amber-500 hover:text-amber-400"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ToastSystem;
