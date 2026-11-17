// Quick-start links. The app icon shortcuts in manifest.webmanifest (long-press the icon on Android,
// right-click it on desktop) open the app with ?go=..., and so can any bookmark or automation:
//   ?go=focus   start a session right away in the mode used last
//   ?go=pomo    start a Pomodoro round right away
//   ?go=grove   open on the Grove tab
//   ?go=widget  open the small "Today" card
const q = new URLSearchParams(location.search);
export const GO = ['focus', 'pomo', 'grove', 'widget'].includes(q.get('go')) ? q.get('go') : null;

// Drop the parameter straight away, so reloading the page does not start another session.
if (q.has('go')) {
  q.delete('go');
  history.replaceState(history.state, '', location.pathname + (q.size ? `?${q}` : '') + location.hash);
}
