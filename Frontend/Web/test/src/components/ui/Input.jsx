export function Input({ className = '', error = false, ...props }) {
  return (
    <input
      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 transition-all duration-300 text-gray-800 placeholder-gray-400 ${
        error 
          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
      } ${className}`}
      {...props}
    />
  );
}
