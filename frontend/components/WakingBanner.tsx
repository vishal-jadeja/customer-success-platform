// Shown when the mount-time silent refresh is still in flight past 3s —
// Render's free tier cold-starts in ~50s, and without this the first
// visitor just sees a blank screen and assumes the app is broken.
export default function WakingBanner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      <p className="text-sm text-gray-600">
        Waking up the server&hellip; this can take up to a minute on the first visit.
      </p>
    </div>
  );
}
