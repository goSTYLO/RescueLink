export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#134178] focus:border-transparent resize-none ${className}`}
      {...props}
    />
  );
}
