import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const classes = `ui-button ui-button-${variant} ui-button-${size} ${className}`.trim();

  return (
    <button className={classes} {...props}>
      {iconLeft ? <span className="ui-button-icon">{iconLeft}</span> : null}
      <span>{children}</span>
      {iconRight ? <span className="ui-button-icon">{iconRight}</span> : null}
    </button>
  );
}
