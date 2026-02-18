import React from 'react';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    ...props
}) => {
    const base = 'btn';
    const variantClass = `btn-${variant}`;
    const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
    const widthClass = fullWidth ? 'btn-full' : '';

    return (
        <button
            className={[base, variantClass, sizeClass, widthClass, className].filter(Boolean).join(' ')}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
