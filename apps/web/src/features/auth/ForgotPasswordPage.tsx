import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to submit request';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-olive-100 text-olive-800 shadow-sm border border-olive-200 mb-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-3xl font-serif tracking-tight text-foreground font-bold">
          Password Recovery
        </h2>
        <p className="mt-1 text-sm text-muted-foreground font-medium">
          RevenIQ Security Portal
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="border border-cream-300 shadow-premium bg-white/95 backdrop-blur-sm">
          {submitted ? (
            <div>
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 rounded-full bg-olive-50 border border-olive-200 text-olive-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl font-semibold">Check your inbox</CardTitle>
                <CardDescription className="text-sm pt-1 leading-relaxed">
                  If <strong className="text-foreground">{email}</strong> exists in our records,
                  we have dispatched a secure link to reset your password. The link expires in 1 hour.
                </CardDescription>
              </CardHeader>

              <CardFooter className="pt-2">
                <Link to="/login" className="w-full">
                  <Button variant="outline" className="w-full h-11 flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Return to Sign In
                  </Button>
                </Link>
              </CardFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl font-semibold">Reset Password</CardTitle>
                <CardDescription className="text-sm">
                  Enter your email address and we will send you a reset link.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      autoComplete="email"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-primary hover:bg-olive-700 text-white font-medium shadow-sm"
                >
                  {loading ? 'Sending link...' : 'Send Reset Link'}
                </Button>

                <div className="text-center text-xs">
                  <Link
                    to="/login"
                    className="font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                  </Link>
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
