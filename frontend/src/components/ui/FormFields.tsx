import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

interface FieldBaseProps {
  label: string;
  hint?: string;
  error?: string;
}

export function Input({
  label,
  hint,
  error,
  className,
  ...props
}: FieldBaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <label className={cn("ui-field", className)} htmlFor={inputId}>
      <span className="ui-field-label">{label}</span>
      <input
        id={inputId}
        className={cn("ui-field-control", error && "ui-field-control-error")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      />
      {hint ? (
        <small id={hintId} className="ui-field-hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={errorId} className="ui-field-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends FieldBaseProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
}

export function Select({ label, hint, error, options, className, ...props }: SelectProps) {
  const selectId = useId();
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;

  return (
    <label className={cn("ui-field", className)} htmlFor={selectId}>
      <span className="ui-field-label">{label}</span>
      <select
        id={selectId}
        className={cn("ui-field-control", error && "ui-field-control-error")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <small id={hintId} className="ui-field-hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={errorId} className="ui-field-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  ...props
}: FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaId = useId();
  const hintId = `${textareaId}-hint`;
  const errorId = `${textareaId}-error`;

  return (
    <label className={cn("ui-field", className)} htmlFor={textareaId}>
      <span className="ui-field-label">{label}</span>
      <textarea
        id={textareaId}
        className={cn("ui-field-control ui-field-textarea", error && "ui-field-control-error")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      />
      {hint ? (
        <small id={hintId} className="ui-field-hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={errorId} className="ui-field-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("ui-checkbox", className)}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  label: string;
  name: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
}

export function RadioGroup({ label, name, value, options, onChange }: RadioGroupProps) {
  return (
    <fieldset className="ui-radio-group">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="ui-radio-item">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
