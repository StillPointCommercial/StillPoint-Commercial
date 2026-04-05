import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-charcoal-light mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-input border border-border bg-warm-white px-3 py-2 text-sm text-text
            placeholder:text-warm-gray focus-ring transition-colors
            ${error ? 'border-attention-red' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-attention-red text-xs mt-1">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
