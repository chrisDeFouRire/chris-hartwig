import { useState, type FormEvent } from 'react';

const NewsletterForm = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !agreedToPrivacy) {
      return;
    }

    setIsSubmitting(true);

    // In a real implementation, you would send this to your backend
    try {
      console.log('Subscribing:', { email, name });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Show success feedback
      setIsSubmitted(true);

      // Reset form after delay
      setTimeout(() => {
        setEmail('');
        setName('');
        setAgreedToPrivacy(false);
        setIsSubmitting(false);
        setIsSubmitted(true);

        // Reset submission state after a while
        setTimeout(() => {
          setIsSubmitted(false);
        }, 3000);
      }, 3000);
    } catch (error) {
      console.error('Subscription error:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          required
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name (optional)
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id="privacy"
            name="privacy"
            type="checkbox"
            checked={agreedToPrivacy}
            onChange={(e) => setAgreedToPrivacy(e.target.checked)}
            required
            className="focus:ring-primary h-4 w-4 text-primary border-gray-300 rounded"
            disabled={isSubmitting}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="privacy" className="font-medium text-gray-700">
            I agree to the{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>{' '}
            and understand that I can unsubscribe at any time.
          </label>
        </div>
      </div>

      <button
        type="submit"
        className={`w-full py-3 text-lg ${isSubmitted
            ? 'bg-green-500'
            : 'btn-primary'
          } ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
        disabled={isSubmitting || isSubmitted}
      >
        {isSubmitting ? 'Subscribing...' : isSubmitted ? 'Subscribed!' : 'Subscribe Now'}
      </button>
    </form>
  );
};

export default NewsletterForm;