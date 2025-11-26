import React from 'react';

interface InputFieldProps {
  id: string;
  name: string;
  label: string;
  type: string;
  value: string;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  optional?: boolean; // To indicate if field is optional
}

const InputField = ({
  id,
  name,
  label,
  type,
  value,
  placeholder,
  required = false,
  disabled = false,
  onChange,
  optional = false
}: InputFieldProps) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {optional && <span className="text-gray-500">(optional)</span>}
      </label>
      <input
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
        required={!optional ? required : false}
        disabled={disabled}
      />
    </div>
  );
};

export default InputField;
