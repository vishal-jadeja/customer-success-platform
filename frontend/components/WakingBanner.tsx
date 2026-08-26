// Shown when the mount-time silent refresh is still in flight past 3s —
// Render's free tier cold-starts in ~50s, and without this the first
// visitor just sees a blank screen and assumes the app is broken.
export default function WakingBanner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-hairline-strong border-t-accent" />
      <p className="text-sm text-text-secondary">
        Waking up the server&hellip; this can take up to a minute on the first visit.
      </p>
    </div>
  );
}
