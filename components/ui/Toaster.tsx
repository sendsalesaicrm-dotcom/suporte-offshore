import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

// Simple event bus for toasts
type ToastType = 'success' | 'error' | 'info';

interface ToastEvent {
  message: string;
  type: ToastType;
}

export const toast = (message: string, type: ToastType = 'info') => {
  const event = new CustomEvent<ToastEvent>('app-toast', { detail: { message, type } });
  window.dispatchEvent(event);
};

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<(ToastEvent & { id: number })[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastEvent>;
      const newToast = { ...customEvent.detail, id: Date.now() };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 3000);
    };

    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "px-4 py-3 rounded-md shadow-lg text-sm font-medium text-white transition-all animate-in slide-in-from-right-full",
            t.type === 'success' ? "bg-green-600" : t.type === 'error' ? "bg-red-600" : "bg-slate-800"
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
};