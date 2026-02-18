import React from 'react';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    style = {},
    ...props
}) => {
    const variantMap = {
        primary: 'btn-primary',
        p: 'btn-primary',
        outline: 'btn-outline',
        o: 'btn-outline',
        danger: 'btn-danger'
    };
    const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
    const widthClass = fullWidth ? 'btn-full' : '';
    const variantClass = variantMap[variant] || 'btn-outline';

    return (
        <button
            className={['btn', variantClass, sizeClass, widthClass, className].filter(Boolean).join(' ')}
            style={style}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
