import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cream-200 border border-cream-300 text-olive-800 flex items-center justify-center mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
        404 - Page Not Found
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        The page or resource you requested does not exist or may have been relocated.
      </p>
      <Link to="/dashboard">
        <Button className="bg-primary hover:bg-olive-700 text-white flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
