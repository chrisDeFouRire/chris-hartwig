import { useState, type FormEvent } from 'react';
import ErrorNotification from './form/ErrorNotification';
import InputField from './form/InputField';
import CheckboxField from './form/CheckboxField';
import SubmitButton from './form/SubmitButton';

interface NewsletterFormProps {
  variant?: 'simple' | 'detailed';
}

const NewsletterForm = ({ variant = 'detailed' }: NewsletterFormProps) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || (variant === 'detailed' && !agreedToPrivacy)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          ...(name && { name }) // Only include name if it exists
        }),
      });

      const data = await response.json() as { message: string };

      if (!response.ok) {
        throw new Error(data.message || 'Failed to subscribe');
      }

      // Show success feedback and that confirmation email has been sent
      setConfirmationSent(true);
      setIsSubmitted(true);

      // Reset form after delay
      setTimeout(() => {
        setEmail('');
        setName('');
        setAgreedToPrivacy(false);
        setIsSubmitting(false);

        // Reset submission state after a while
        setTimeout(() => {
          setIsSubmitted(false);
          setConfirmationSent(false);
        }, 3000);
      }, 500);
    } catch (error) {
      console.error('Subscription error:', error);
      setIsSubmitting(false);

      // Set error message for user display
      setError(error instanceof Error ? error.message : 'An error occurred while subscribing');

      // Clear error after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ErrorNotification message={error} />}

      <InputField
        id="email"
        name="email"
        label="Email address"
        type="email"
        value={email}
        placeholder="you@example.com"
        required
        disabled={isSubmitting}
        onChange={(e) => setEmail(e.target.value)}
      />

      {variant === 'detailed' && (
        <>
          <InputField
            id="name"
            name="name"
            label="Name"
            type="text"
            value={name}
            placeholder="Your name"
            disabled={isSubmitting}
            onChange={(e) => setName(e.target.value)}
            optional
          />

          <CheckboxField
            id="privacy"
            name="privacy"
            label="I agree to the"
            checked={agreedToPrivacy}
            required
            disabled={isSubmitting}
            onChange={(e) => setAgreedToPrivacy(e.target.checked)}
            link={{ href: "/privacy/", text: "Privacy Policy" }}
          />
        </>
      )}

      <SubmitButton
        isSubmitting={isSubmitting}
        isSubmitted={isSubmitted}
        variant={variant}
      />

      {confirmationSent && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-700 text-sm">
            Thank you for subscribing! Please check your email to confirm your subscription.
          </p>
        </div>
      )}

      {variant === 'simple' && (
        <p className="text-sm text-gray-500 text-center mt-2">No spam. Unsubscribe anytime.</p>
      )}
    </form>
  );
};

export default NewsletterForm;
