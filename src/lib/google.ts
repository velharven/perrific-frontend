export function getGoogleClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return (id ?? '').trim();
}

export function isGoogleConfigured(): boolean {
  return getGoogleClientId().length > 0;
}
