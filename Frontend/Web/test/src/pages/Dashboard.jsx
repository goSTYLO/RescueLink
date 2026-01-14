export default function Dashboard({ user, onLogout }) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Welcome!</h1>
        
        <div className="space-y-4 mb-8">
          <div>
            <p className="text-gray-600 text-sm">Phone Number</p>
            <p className="text-lg font-semibold text-gray-800">
              {user?.phone_number || user?.phoneNumber || user?.phone || 'N/A'}
            </p>
          </div>
          {user?.first_name && (
            <div>
              <p className="text-gray-600 text-sm">Name</p>
              <p className="text-lg font-semibold text-gray-800">
                {user.first_name} {user.last_name}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
