(() => {
  const pageTemplates = new Map();

  async function loadPageTemplates(names) {
    await Promise.all(names.map(async name => {
      const response = await fetch(`/pages/${encodeURIComponent(name)}.html`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Could not load the ${name} page template.`);
      pageTemplates.set(name, await response.text());
    }));
  }

  function renderPageTemplate(name, values = [], variant) {
    let template = pageTemplates.get(name);
    if (template === undefined) throw new Error(`Page template "${name}" has not been loaded.`);
    if (variant) {
      const match = [...template.matchAll(/<template data-variant="([^"]+)">([\s\S]*?)<\/template>/g)]
        .find(([, name]) => name === variant);
      if (!match) throw new Error(`Template state "${variant}" was not found in "${name}.html".`);
      template = match[2];
    }
    return template.replace(/\{\{(\d+)\}\}/g, (marker, index) => values[Number(index)] ?? '');
  }

  window.loadPageTemplates = loadPageTemplates;
  window.renderPageTemplate = renderPageTemplate;
})();
