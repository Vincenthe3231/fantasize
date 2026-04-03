import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function safeRedirectPath(raw: string | null): string {
  if (raw == null || raw === '') return '/';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return '/';
  return decoded;
}

const SignIn = () => {
  const [searchParams] = useSearchParams();
  const { userId, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nextPath = safeRedirectPath(searchParams.get('redirect'));

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-bg)]">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--accent-color)]" aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (userId) {
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setErr(error.message ?? 'Sign in failed');
      return;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--canvas-bg)] px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Use your email and password to open the workspace.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting || isLoading}>
            {submitting || isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="text-[var(--accent-color)] underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignIn;
