
import React, { useEffect } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface Props {
  notifications: Notification[];
  removeNotification: (id: string) => void;
}

const NotificationToast: React.FC<Props> = ({ notifications, removeNotification }) => {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-3 w-[calc(100%-2rem)] max-w-md pointer-events-none">
      {notifications.map((notif) => (
        <div key={notif.id} className="pointer-events-auto">
          <ToastItem notif={notif} remove={() => removeNotification(notif.id)} />
        </div>
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ notif: Notification; remove: () => void }> = ({ notif, remove }) => {
  useEffect(() => {
    const timer = setTimeout(remove, 5000);
    return () => clearTimeout(timer);
  }, [remove]);

  const bgClass =
    notif.type === 'success' ? 'bg-proyecto-green/10 border-proyecto-green' :
      notif.type === 'error' ? 'bg-red-500/10 border-red-500' :
        'bg-proyecto-accent/10 border-proyecto-accent';

  const icon =
    notif.type === 'success' ? (
      <svg className="w-5 h-5 text-proyecto-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
    ) : notif.type === 'error' ? (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
    ) : (
      <svg className="w-5 h-5 text-proyecto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    );

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border-l-4 shadow-2xl blue-glass ${bgClass} animate-slide-in`}>
      <div className="flex-shrink-0">{icon}</div>
      <p className="text-sm font-medium text-white pr-4">{notif.message}</p>
      <button onClick={remove} className="text-slate-500 hover:text-white transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};

export default NotificationToast;
