import React from 'react';

const Card = ({ children, hover = false, className = '', ...props }) => {
    return (
        <div className={['card', hover ? 'card-hover' : '', className].filter(Boolean).join(' ')} {...props}>
            {children}
        </div>
    );
};

export default Card;
