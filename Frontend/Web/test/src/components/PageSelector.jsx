export default function PageSelector({ currentPage, onPageChange }) {
  const pages = [
    { id: 'login', name: 'Login' },
    { id: 'forgot-password', name: 'Forgot Password' },
    { id: 'enter-code', name: 'Enter Code' },
    { id: 'create-password', name: 'Create New Password' },
    { id: 'dashboard', name: 'Dashboard' },
  ];

  return (
    <div className="fixed top-4 left-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Page Selector</div>
      <div className="flex flex-col gap-1">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => onPageChange(page.id)}
            className={`px-3 py-1.5 text-sm rounded transition-colors text-left ${
              currentPage === page.id
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {page.name}
          </button>
        ))}
      </div>
    </div>
  );
}
