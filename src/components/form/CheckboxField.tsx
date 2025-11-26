import React from 'react';

interface CheckboxFieldProps {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  required?: boolean;
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  link?: {
    href: string;
    text: string;
  };
}

const CheckboxField = ({
  id,
  name,
  label,
  checked,
  required = false,
  disabled = false,
  onChange,
  link
}: CheckboxFieldProps) => {
  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          required={required}
          className="focus:ring-primary h-4 w-4 text-primary border-gray-300 rounded"
          disabled={disabled}
        />
      </div>
      <div className="ml-3 text-sm">
        <label htmlFor={id} className="font-medium text-gray-700">
          {label}{' '}
          {link && (
            <a href={link.href} className="text-primary hover:underline">
              {link.text}
            </a>
          )}{' '}
          {required && 'and understand that I can unsubscribe at any time.'}
        </label>
      </div>
    </div>
  );
};

export default CheckboxField;