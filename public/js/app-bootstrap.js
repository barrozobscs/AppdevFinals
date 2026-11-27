(async () => {
  const pageTemplateNames = ['header', 'shell', 'page-title', 'auth', 'landing', 'materials', 'profile', 'reviewer', 'quiz', 'results', 'gaps', 'roadmap'];
  try {
    await loadPageTemplates(pageTemplateNames);
    const authError = new URLSearchParams(window.location.search).get('auth_error');
    if (authError) {
      const authMessages = {
        google_not_configured: 'Google sign-in needs OAuth credentials in server/.env.',
        facebook_not_configured: 'Facebook sign-in needs OAuth credentials in server/.env.',
        google_failed: 'Google sign-in failed. Check the OAuth settings and server terminal.',
        facebook_failed: 'Facebook sign-in failed. Check the OAuth settings and server terminal.',
        session: 'Sign-in succeeded, but PacePath could not save the login session.',
      };
      state.screen = 'auth';
      render();
      notify(authMessages[authError] || 'Sign-in was cancelled or could not be completed.');
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
      return;
    }
    const restored = await restoreSession();
    if (!restored) render();
  } catch (error) {
    console.error('PacePath could not initialize its page templates:', error);
    root.innerHTML = '<main class="page"><article class="card empty-state"><h1>Page could not load</h1><p>Refresh PacePath to try again.</p></article></main>';
  }
})();
