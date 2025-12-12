import { useEffect, useRef, useState, type FormEvent } from 'react';
import ErrorNotification from './form/ErrorNotification';
import InputField from './form/InputField';
import CheckboxField from './form/CheckboxField';
import SubmitButton from './form/SubmitButton';

declare global {
  interface Window {
    turnstile?: {
      render: (idOrElement: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      ready: (callback: () => void) => void;
    };
  }
}

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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);

  const widgetIdRef = useRef<string | null>(null);
  const widgetContainerIdRef = useRef(`turnstile-widget-${Math.random().toString(36).slice(2)}`);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);

  const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;
  const isLocalDev = !siteKey;

  useEffect(() => {
    // Skip loading Turnstile in local development when site key is not set
    if (isLocalDev) {
      console.log('Skipping Turnstile widget (local development mode)');
      setTurnstileReady(true); // Set ready so form can submit
      return;
    }

    const existingScript = document.querySelector(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    ) as HTMLScriptElement | null;

    const handleScriptLoad = () => setTurnstileReady(true);
    const handleScriptError = () => setError('Failed to load verification. Please refresh.');

    if (existingScript) {
      existingScript.async = false;
      existingScript.defer = false;
      if (window.turnstile) {
        setTurnstileReady(true);
      } else {
        existingScript.addEventListener('load', handleScriptLoad);
        existingScript.addEventListener('error', handleScriptError);
      }
      return () => {
        existingScript.removeEventListener('load', handleScriptLoad);
        existingScript.removeEventListener('error', handleScriptError);
      };
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = false;
    script.defer = false;
    script.onload = handleScriptLoad;
    script.onerror = handleScriptError;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [siteKey, isLocalDev]);

  useEffect(() => {
    // Skip rendering Turnstile widget in local development
    if (isLocalDev) {
      return;
    }

    if (!turnstileReady || !window.turnstile) {
      return;
    }

    const turnstile = window.turnstile;
    if (!turnstile) {
      return;
    }

    turnstile.ready(() => {
      if (!turnstile) {
        return;
      }

      const containerEl = widgetContainerRef.current;
      if (!containerEl) {
        console.warn('Turnstile container not ready');
        return;
      }

      if (widgetIdRef.current) {
        turnstile.reset(widgetIdRef.current);
        return;
      }

      const id = turnstile.render(containerEl, {
        sitekey: siteKey,
        callback: (token: string) => {
          setTurnstileToken(token);
          setError(null);
        },
        'error-callback': () => {
          setTurnstileToken(null);
          setError('Verification failed. Please retry.');
        },
        'expired-callback': () => setTurnstileToken(null),
      });

      widgetIdRef.current = id;
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileReady, siteKey, isLocalDev]);

  const resetTurnstile = () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      setTurnstileToken(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || (variant === 'detailed' && !agreedToPrivacy)) {
      return;
    }

    // Skip Turnstile token check in local development
    if (!isLocalDev && !turnstileToken) {
      setError('Please complete the verification challenge.');
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
          ...(name && { name }), // Only include name if it exists
          ...(!isLocalDev && { turnstileToken }), // Only include token if not in local dev
        }),
      });

      const data = await response.json() as { message: string };

      if (!response.ok) {
        throw new Error(data.message || 'Failed to subscribe');
      }

      // Show success feedback and that confirmation email has been sent
      setConfirmationSent(true);
      setIsSubmitted(true);
      resetTurnstile();

      // Reset form after delay
      setTimeout(() => {
        setEmail('');
        setName('');
        setAgreedToPrivacy(false);
        setIsSubmitting(false);
        setTurnstileToken(null);

        // Reset submission state after a while
        setTimeout(() => {
          setIsSubmitted(false);
          setConfirmationSent(false);
        }, 3000);
      }, 500);
    } catch (error) {
      console.error('Subscription error:', error);
      setIsSubmitting(false);
      resetTurnstile();

      // Set error message for user display
      setError(error instanceof Error ? error.message : 'An error occurred while subscribing');

      // Clear error after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  const canSubmit =
    Boolean(email) &&
    (!variant || variant === 'simple' || agreedToPrivacy) &&
    (isLocalDev || Boolean(turnstileToken));

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

      {!isLocalDev && (
        <div className="mt-4">
          <div
            id={widgetContainerIdRef.current}
            ref={widgetContainerRef}
            className="w-full"
          />
        </div>
      )}

      <SubmitButton
        isSubmitting={isSubmitting}
        isSubmitted={isSubmitted}
        variant={variant}
        disabled={!canSubmit}
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
