import React, { useState, useEffect } from 'react';

const ConfirmEmail = () => {
  // Extract the token from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const confirmEmail = async () => {
      if (!token) {
        setError('No confirmation token provided. Please check your email for the confirmation link.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setConfirmed(true);
        } else {
          setError(data.message || 'Failed to confirm email. Please try again.');
        }
      } catch (err) {
        setError('An error occurred while confirming your email. Please try again.');
        console.error('Confirmation error:', err);
      } finally {
        setLoading(false);
      }
    };

    confirmEmail();
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <h2 className="text-2xl font-bold mb-4">Confirming your email...</h2>
        <p className="text-gray-600">Please wait while we verify your subscription.</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Invalid Link</h2>
        <p className="text-gray-700 mb-4">No confirmation token provided. Please check your email for the confirmation link.</p>
        <a href="/newsletter/" className="text-primary hover:underline">Subscribe again</a>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Success!</h2>
        <p className="text-gray-700 mb-6">Your email has been confirmed.</p>
        <p className="text-gray-600 text-sm">You're now subscribed to our newsletter.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-2">Confirmation Failed</h2>
      <p className="text-gray-700 mb-4">{error}</p>
      <a href="/newsletter/" className="text-primary hover:underline">Subscribe again</a>
    </div>
  );
};

export default ConfirmEmail;
