import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
        403 - Access Restricted
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        Your account role does not have permission to view or manage this module. If you believe this is an error, please reach out to an administrator.
      </p>
      <Link to="/dashboard">
        <Button className="bg-primary hover:bg-olive-700 text-white flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}

