import React, { useState, useEffect } from 'react';

const MobileNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Toggle menu function
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Close menu when resizing to desktop sizes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Mobile menu toggle button - added here to be part of the component */}
      <button
        className="md:hidden fixed top-4 right-4 z-50 p-2 rounded-md text-gray-600 hover:text-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
        onClick={toggleMenu}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 transform transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          {isOpen ? (
            // Close icon (X)
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          ) : (
            // Menu icon (hamburger)
            <path
              fillRule="evenodd"
              d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          )}
        </svg>
      </button>

      {/* Mobile menu backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm transition-opacity duration-300"
          onClick={toggleMenu}
        ></div>
      )}

      {/* Mobile menu panel */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-full max-w-xs bg-white z-50 shadow-xl transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}
      >
        <nav className="flex flex-col p-2 space-y-1">
          <a
            href="/"
            className="px-4 py-3 text-gray-700 hover:text-primary hover:bg-gray-50 font-medium rounded-lg transition-colors duration-200"
            onClick={toggleMenu}
          >
            Home
          </a>
          <a
            href="/blog"
            className="px-4 py-3 text-gray-700 hover:text-primary hover:bg-gray-50 font-medium rounded-lg transition-colors duration-200"
            onClick={toggleMenu}
          >
            Blog
          </a>
          <a
            href="/newsletter"
            className="px-4 py-3 text-gray-700 hover:text-primary hover:bg-gray-50 font-medium rounded-lg transition-colors duration-200"
            onClick={toggleMenu}
          >
            Newsletter
          </a>
          <a
            href="/about"
            className="px-4 py-3 text-gray-700 hover:text-primary hover:bg-gray-50 font-medium rounded-lg transition-colors duration-200"
            onClick={toggleMenu}
          >
            About
          </a>
        </nav>
      </div>
    </>
  );
};

export default MobileNavigation;