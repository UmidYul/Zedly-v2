interface InputFieldProps {
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function InputField({
  label,
  type = "text",
  value,
  placeholder,
  autoComplete,
  disabled,
  onChange
}: InputFieldProps) {
  return (
    <label className="input-field">
      <span className="input-label">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
