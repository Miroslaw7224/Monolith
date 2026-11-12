/**
 * Inline script run before first paint to set data-theme and avoid FOUC.
 * Must be placed in <head>.
 */
export function ThemeScript() {
  const script = `
(function() {
  var oldKeys = ['nexus-theme', 'secondbrain-theme'];
  var key = 'monolith-theme';
  var prev = localStorage.getItem(key);
  if (prev !== 'dark' && prev !== 'light') {
    for (var i = 0; i < oldKeys.length; i++) {
      var migrated = localStorage.getItem(oldKeys[i]);
      if (migrated === 'dark' || migrated === 'light') {
        localStorage.setItem(key, migrated);
        localStorage.removeItem(oldKeys[i]);
        break;
      }
    }
  }
  var stored = localStorage.getItem(key);
  var theme = stored === 'dark' || stored === 'light' ? stored : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
