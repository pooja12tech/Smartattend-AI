import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
  variant = 'default'
}) {
  const modalRef = useRef(null);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap / focus on open
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isSheet = variant === 'sheet';

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-center p-0 ${
        isSheet ? 'items-end' : 'items-end sm:items-center sm:p-6'
      } overflow-hidden animate-in fade-in duration-150`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-dialog-title' : undefined}
        tabIndex={-1}
        className={`bg-white border-t sm:border border-slate-200/90 shadow-2xl w-full ${maxWidth} ${
          isSheet
            ? 'rounded-t-3xl max-h-[85dvh]'
            : 'rounded-t-3xl sm:rounded-3xl max-h-[85dvh] sm:max-h-[90vh]'
        } flex flex-col text-[#111827] relative outline-none focus:ring-0 my-0 sm:my-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200`}
      >
        {/* Mobile Drag Handle Bar */}
        <div className={`w-full pt-3 pb-1 flex justify-center shrink-0 ${isSheet ? '' : 'sm:hidden'}`}>
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div className="p-6 sm:p-7 overflow-y-auto w-full">
          {/* Header */}
          {(title || subtitle) && (
            <div className="mb-5 pr-8 text-left">
              {title && (
                <h2
                  id="modal-dialog-title"
                  className="text-lg sm:text-xl font-extrabold text-[#111827] tracking-tight"
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  );
}
