import React from 'react';

interface SubmitButtonProps {
  isSubmitting: boolean;
  isSubmitted: boolean;
  variant: 'simple' | 'detailed';
  disabled?: boolean;
}

const SubmitButton = ({ isSubmitting, isSubmitted, variant, disabled }: SubmitButtonProps) => {
  return (
    <button
      type="submit"
      className={`w-full py-3 text-lg ${
        isSubmitted ? 'bg-green-500' : 'btn-primary'
      } ${(isSubmitting || disabled) ? 'opacity-75 cursor-not-allowed' : ''}`}
      disabled={isSubmitting || isSubmitted || disabled}
    >
      {isSubmitting
        ? 'Subscribing...'
        : isSubmitted
          ? 'Subscribed!'
          : variant === 'simple'
            ? 'Subscribe'
            : 'Subscribe Now'}
    </button>
  );
};

export default SubmitButton;
