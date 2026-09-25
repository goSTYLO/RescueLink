import { AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/Button';

export function AccessDeniedNotice({
  title = 'Access Denied',
  message = 'You do not have permission to access this page.',
  redirectPath = '/dashboard',
  redirectLabel = 'Back to Dashboard',
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-md border border-primary/40 bg-card/70 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-md bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
            <AlertOctagon className="w-5 h-5" strokeWidth={2} />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-primary">{title}</h2>
            <p className="text-sm text-muted mt-1">{message}</p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => navigate(redirectPath, { replace: true })}>
                {redirectLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
