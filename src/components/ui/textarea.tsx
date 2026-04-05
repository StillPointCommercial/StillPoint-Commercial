import { forwardRef } from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div>
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-charcoal-light mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full rounded-input border border-border bg-warm-white px-3 py-2 text-sm text-text
            placeholder:text-warm-gray focus-ring transition-colors resize-y min-h-[80px]
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

Textarea.displayName = 'Textarea'
