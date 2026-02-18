import React from 'react';

const StatusBadge = ({ label, tone = 'neutral', className = '' }) => {
    return (
        <span className={['status-badge', `status-badge-${tone}`, className].filter(Boolean).join(' ')}>
            {label}
        </span>
    );
};

export default StatusBadge;
