import React from 'react';

const SectionHeader = ({ title, subtitle, actions = null, className = '' }) => {
    return (
        <div className={['section-header', className].filter(Boolean).join(' ')}>
            <div>
                <h3 className="section-title">{title}</h3>
                {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
            </div>
            {actions ? <div>{actions}</div> : null}
        </div>
    );
};

export default SectionHeader;
