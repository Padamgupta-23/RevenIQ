import React, { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { evaluatePassword, PasswordStrengthIndicator } from './PasswordStrengthIndicator';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { success, error } = useToast();
  const navigate = useNavigate();

  const passwordRules = useMemo(() => evaluatePassword(password), [password]);
  const isPasswordValid = passwordRules.every((r) => r.passed);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('Missing password reset token.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg('Please satisfy all password security rules.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/reset-password', {
        token,
        password,
      });

      if (res.data?.data?.message) {
        success('Password updated', 'You can now sign in with your new password');
        navigate('/login', { replace: true });
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Invalid or expired reset token';
      setErrorMsg(message);
      error('Reset failed', message);
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
          Create New Password
        </h2>
        <p className="mt-1 text-sm text-muted-foreground font-medium">
          Choose a new secure password for your RevenIQ account
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="border border-cream-300 shadow-premium bg-white/95 backdrop-blur-sm">
          {!token ? (
            <div>
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl font-semibold">Missing Reset Token</CardTitle>
                <CardDescription className="text-sm pt-1 leading-relaxed">
                  The password reset link appears incomplete or malformed. Please request a new link.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Link to="/forgot-password" className="w-full">
                  <Button className="w-full h-11 bg-primary text-white">
                    Request New Link
                  </Button>
                </Link>
              </CardFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl font-semibold">Set New Password</CardTitle>
                <CardDescription className="text-sm">
                  Must meet all complexity rules below
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
                    <Input
                      id="password"
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="new-password"
                    />
                  </div>
                  <PasswordStrengthIndicator rules={passwordRules} />
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5 pointer-events-none" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-rose-600 font-medium pt-1">
                      Passwords do not match
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-4">
                <Button
                  type="submit"
                  disabled={loading || !isPasswordValid || !passwordsMatch}
                  className="w-full h-11 bg-olive-800 hover:bg-olive-900 text-white font-semibold shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? 'Updating Password...' : 'Save New Password'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>

                <div className="text-center text-xs">
                  <Link
                    to="/login"
                    className="font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel and return to Sign In
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

