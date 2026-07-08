export function AuthErrorMessage({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="text-sm text-destructive" role="status" aria-live="polite">
      {message}
    </p>
  );
}
