import { useState, useEffect } from 'react';
import { getErrorLog, clearErrorLog, ErrorLog } from '../utils/errorHandler';

/**
 * DevTools Component
 *
 * A floating panel for development that shows:
 * - Error log
 * - Network requests
 * - State debugging
 *
 * Only renders in development mode.
 */
export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [activeTab, setActiveTab] = useState<'errors' | 'network' | 'state'>('errors');

  // Refresh error log periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setErrors(getErrorLog());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const handleClearErrors = () => {
    clearErrorLog();
    setErrors([]);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 bg-navy-800 text-white rounded-full shadow-lg hover:bg-navy-900 transition-all flex items-center justify-center"
        title="Toggle DevTools"
      >
        {errors.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
            {errors.length}
          </span>
        )}
        🛠️
      </button>

      {/* DevTools Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-96 max-h-[60vh] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-navy-800 text-white px-4 py-2 flex items-center justify-between">
            <span className="font-semibold">DevTools</span>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-navy-700 rounded p-1"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            {(['errors', 'network', 'state'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-gray-100 text-navy-800 border-b-2 border-navy-800'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'errors' && errors.length > 0 && (
                  <span className="ml-1 text-red-500">({errors.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(60vh-100px)] p-4">
            {activeTab === 'errors' && (
              <div>
                {errors.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No errors logged</p>
                ) : (
                  <>
                    <button
                      onClick={handleClearErrors}
                      className="mb-3 text-sm text-red-600 hover:underline"
                    >
                      Clear All
                    </button>
                    <div className="space-y-3">
                      {errors.map((error, i) => (
                        <div
                          key={i}
                          className="bg-red-50 border border-red-200 rounded p-3 text-sm"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-red-800">
                              [{error.type}]
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(error.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-red-700">{error.message}</p>
                          {error.component && (
                            <p className="text-xs text-gray-600 mt-1">
                              Component: {error.component}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'network' && (
              <div className="text-gray-500 text-center py-4">
                <p>Network tab coming soon</p>
                <p className="text-sm mt-2">
                  Use browser DevTools (F12) → Network tab
                </p>
              </div>
            )}

            {activeTab === 'state' && (
              <div className="text-gray-500 text-center py-4">
                <p>State tab coming soon</p>
                <p className="text-sm mt-2">
                  Use React DevTools extension for state inspection
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
            Press F12 for full browser DevTools
          </div>
        </div>
      )}
    </>
  );
}

export default DevTools;
