import React from 'react';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    const normalizedStatus = status.toLowerCase();
    
    switch (normalizedStatus) {
      case 'approved':
      case 'completed':
      case 'active':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStyles()} uppercase`}>
      {status}
    </span>
  );
};

export default StatusBadge;
