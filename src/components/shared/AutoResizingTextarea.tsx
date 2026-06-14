import React, { useEffect, useRef } from 'react';

interface AutoResizingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onAutofill?: () => void;
  isAutofilling?: boolean;
}

const AutoResizingTextarea: React.FC<AutoResizingTextareaProps> = ({ 
  onAutofill, 
  isAutofilling, 
  className, 
  value, 
  ...props 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <div className="relative group w-full">
      <textarea
        ref={textareaRef}
        value={value}
        className={`w-full bg-white/30 border border-white/70 p-4 rounded-sm text-xs text-white leading-relaxed outline-none focus:border-amber-500/30 transition-all resize-none overflow-hidden ${className}`}
        style={{ fontStyle: 'normal' }} // Ensure no italics
        {...props}
      />
      {onAutofill && !value && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onAutofill();
          }}
          disabled={isAutofilling}
          className="absolute right-2 top-2 px-2 py-1 bg-amber-500/30 hover:bg-amber-500/50 border border-amber-500/60 rounded text-xs text-amber-500 font-black uppercase tracking-widest transition-all opacity-0 group-hover:opacity-100 disabled:opacity-80"
        >
          {isAutofilling ? '...' : 'Autofill'}
        </button>
      )}
    </div>
  );
};

export default AutoResizingTextarea;
