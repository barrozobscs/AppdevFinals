/* PacePath front-end. Real authentication, file processing, and AI generation require a backend. */
const STORE_KEY = 'pacePathProjectUI_v2';

const data = loadData();
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}
async function refreshMaterials() {
  const result = await api('/materials');
  data.materials = result.materials;
  if (!data.materials.some(item => item.id === state.selectedMaterial)) state.selectedMaterial = data.materials[0]?.id || '';
  save();
}
async function refreshProgress() {
  const result = await api('/progress');
  data.mastery = result.mastery;
  data.attempts = result.attempts;
  const roadmap = await api('/roadmap');
  data.roadmapStatus = roadmap.statuses;
  save();
}
const state = {
  screen: 'welcome',
  name: data.name || 'Lance',
  email: data.email || '',
  selectedMaterial: '',
  gapMaterial: 'all',
  topic: 1,
  question: 0,
  answers: {},
  startedAt: null,
  showAllAnswers: false,
  pendingFiles: [],
  dragOver: false,
  reviewerMode: 'reviewer',
  flashcardIndex: 0,
  flashcardRevealed: false,
  flashcardKnown: {},
  quizId: '',
  reviewerText: '',
  reviewerMaterialId: '',
};

const root = document.querySelector('#app');
const toastEl = document.querySelector('#toast');

let questions = [
  { topic: 1, text: 'What does an adaptive learning system use to personalize a student’s next study steps?', options: ['A fixed sequence for every student', 'The student’s assessment performance', 'The file upload date only', 'The number of pages in a document'], answer: 1 },
  { topic: 1, text: 'Which item can be generated from uploaded study material?', options: ['A reviewer and practice quiz', 'A class attendance sheet', 'A public website', 'A payment receipt'], answer: 0 },
  { topic: 2, text: 'What is the purpose of extracting text from an uploaded file?', options: ['To identify concepts and topics', 'To change the file name', 'To share the file publicly', 'To grade a student immediately'], answer: 0 },
  { topic: 2, text: 'Which formats are accepted by PacePath?', options: ['MP3 only', 'PDF, DOCX, or PPTX', 'ZIP only', 'EXE files'], answer: 1 },
  { topic: 3, text: 'What does a quiz attempt record?', options: ['Answers and assessment results', 'Only the student’s display name', 'The browser theme', 'The material file size'], answer: 0 },
  { topic: 3, text: 'When should topic accuracy be updated?', options: ['After a quiz is assessed', 'When the student opens the site', 'When a file is renamed', 'At random intervals'], answer: 0 },
  { topic: 4, text: 'A topic has 30% accuracy. What should the roadmap generally do?', options: ['Prioritize more review for the topic', 'Mark it mastered', 'Remove it from the material', 'Skip all practice questions'], answer: 0 },
  { topic: 4, text: 'Which score falls below the 50% weak-topic threshold?', options: ['90%', '70%', '30%', '80%'], answer: 2 },
  { topic: 5, text: 'What is the purpose of a personalized learning roadmap?', options: ['Recommend what to study next', 'Store uploaded passwords', 'Replace every learning material', 'Show unrelated notifications'], answer: 0 },
  { topic: 5, text: 'What can explain why a roadmap step is prioritized?', options: ['Topic accuracy and mastery', 'The screen color', 'The browser brand', 'The current window size'], answer: 0 },
];

const topicContent = {
  1: { title: 'Learning systems and adaptation', description: 'An adaptive learning system adjusts practice and study recommendations using a learner’s demonstrated understanding.', points: ['Use quiz performance to estimate topic mastery.', 'Keep the learner in control of reviewing and practicing.', 'Update recommendations as new assessment results arrive.'] },
  2: { title: 'Study materials and topic extraction', description: 'Uploaded notes and readings provide the source for identifying concepts that can be organized into reviewer and quiz content.', points: ['Track the file type, upload date, and processing status.', 'Extract readable text before identifying topics.', 'Keep generated topics connected to their source material.'] },
  3: { title: 'Assessment and performance', description: 'A quiz attempt groups the learner’s answers and provides evidence about their understanding of each topic.', points: ['Save selected responses during the attempt.', 'Grade answers when the quiz is submitted.', 'Use the result to update topic accuracy.'] },
  4: { title: 'Knowledge gaps and mastery', description: 'Knowledge gap analysis highlights topics that need attention and separates them from topics the learner has mastered.', points: ['Weak: below 50% accuracy.', 'Developing: 50–79% accuracy.', 'Mastered: 80% accuracy or higher.'] },
  5: { title: 'Personalized learning roadmap', description: 'The roadmap orders review and practice activities using topic performance and the source material.', points: ['Prioritize the lowest accuracy topics first.', 'Explain why a topic is recommended now.', 'Track completion and refresh priorities after another quiz.'] },
};

function loadData() {
  const empty = { name: 'Lance', materials: [], mastery: [], roadmapStatus: {}, attempts: [] };
  try { return { ...empty, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
  catch { return empty; }
}

function save() { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
function esc(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function notify(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
function today() { return new Date().toISOString().slice(0, 10); }
function dateLabel(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'L'; }
function readyMaterials() { return data.materials.filter(m => m.status === 'Ready'); }
function activeMaterial() { return data.materials.find(m => m.id === state.selectedMaterial) || readyMaterials()[0] || null; }
function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; }

function navButton(id, label) { return `<button type="button" class="${state.screen === id ? 'active' : ''}" data-screen="${id}">${label}</button>`; }
function header() {
  return `<header class="topbar"><a class="brand" href="#materials" data-screen="materials"><span class="brand-mark">P</span><span>PacePath<small>SELF-PACED STUDY HUB</small></span></a><nav class="nav" aria-label="Main navigation">${navButton('materials', 'Materials')}${navButton('reviewer', 'Reviewer')}${navButton('quiz', 'Quiz')}${navButton('gaps', 'Gap Analysis')}${navButton('roadmap', 'Roadmap')}</nav><div class="account"><button class="profile-trigger" data-screen="profile" title="Edit profile"><span class="avatar">${esc(initials(state.name))}</span><span>${esc(state.name)}</span><b>Profile</b></button><button class="logout" data-action="logout">Log out</button></div></header>`;
}
function shell(content) { return `${header()}<main class="page">${content}<div class="footer-note">PacePath · Study from your own materials</div></main>`; }
function pageTitle(title, sub, action = '') { return `<div class="page-title"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`; }
function btn(label, action, cls = '') { return `<button type="button" class="button ${cls}" data-action="${action}">${label}</button>`; }
function emptyState(title, text, actionLabel = 'Go to materials', action = 'materials') {
  return `<article class="card empty-state"><div class="empty-mark">＋</div><h2>${title}</h2><p>${text}</p><button class="button" data-screen="${action}">${actionLabel}</button></article>`;
}

function authPage() {
  return `<div class="welcome"><header class="welcome-top"><a class="brand" href="#" data-action="go-home"><span class="brand-mark">P</span><span>PacePath<small>SELF-PACED STUDY HUB</small></span></a></header><main class="welcome-main"><section class="welcome-intro"><span class="eyebrow">Your materials, your learning plan</span><h1>Study smarter from your own materials</h1><p>Upload your notes, practice with quizzes, see which topics need attention, and follow a personalized learning roadmap.</p></section><section class="flow" aria-label="How it works"><div class="flow-step"><b>01</b>Upload documents</div><div class="flow-step"><b>02</b>Take web quiz</div><div class="flow-step"><b>03</b>View skill gaps</div><div class="flow-step"><b>04</b>Follow roadmap</div></section><div class="auth-grid"><form class="card auth-card" id="login-form"><h2>Log in</h2><div class="field"><label for="login-email">Email</label><input id="login-email" type="email" placeholder="you@school.edu" required></div><div class="field"><label for="login-password">Password</label><input id="login-password" type="password" placeholder="Password" required></div><button class="button" type="submit">Log in</button><div class="auth-separator"><span>or sign in with</span></div><div class="social-buttons"><button type="button" class="social-button google" data-action="social-login" data-provider="Google" title="Sign in with your Gmail account"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 12.25c0-.72-.06-1.42-.18-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.27Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.04H3.28v2.53A9.75 9.75 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.53 13.83a5.86 5.86 0 0 1 0-3.66V7.64H3.28a9.76 9.76 0 0 0 0 8.72l3.25-2.53Z"/><path fill="#EA4335" d="M12 6.13c1.43 0 2.71.49 3.72 1.47l2.79-2.79C16.83 3.2 14.62 2.25 12 2.25a9.75 9.75 0 0 0-8.72 5.39l3.25 2.53C7.3 7.85 9.46 6.13 12 6.13Z"/></svg><span>Google / Gmail</span></button><button type="button" class="social-button facebook" data-action="social-login" data-provider="Facebook" title="Sign in with Facebook"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v1.9H7v3.1h2.8v8h3.7Z"/></svg><span>Facebook</span></button></div></form><form class="card auth-card" id="register-form"><h2>Create an account</h2><div class="field"><label for="register-name">Full name</label><input id="register-name" type="text" placeholder="Full name" autocomplete="name" required></div><div class="field"><label for="register-email">Email</label><input id="register-email" type="email" placeholder="you@school.edu" autocomplete="email" required></div><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label for="register-password">Password</label><input id="register-password" type="password" placeholder="Password" minlength="8" required></div><div class="field"><label for="register-confirm">Confirm password</label><input id="register-confirm" type="password" placeholder="Confirm password" minlength="8" required></div></div><label class="consent-row"><input id="privacy-consent" type="checkbox" required><span>I consent to PacePath using my account details, study materials, quiz answers, and progress to provide its learning features.</span></label><button class="button secondary" type="submit">Create account</button></form></div></main></div>`;
}

function welcome() {
  return `<div class="homepage" id="home"><header class="home-nav"><a class="home-brand" href="#home"><span class="brand-mark">P</span><span>PacePath<small>SELF-PACED STUDY HUB</small></span></a><nav aria-label="Homepage navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#study-tools">Study tools</a></nav><div class="home-nav-actions"><button class="home-login" data-action="go-auth">Log in</button><button class="home-cta" data-action="go-auth">Start studying free <span>→</span></button></div></header><main><section class="home-hero"><div class="home-hero-copy"><span class="home-kicker"><i></i> YOUR PERSONAL STUDY WORKSPACE</span><h1>Make your study materials <em>work for you.</em></h1><p>Bring your class slides and notes into one place. Review key ideas, practice with quizzes, and see what to study next.</p><div class="home-hero-actions"><button class="home-cta" data-action="go-auth">Start studying free <span>→</span></button><a class="home-secondary" href="#how-it-works">See how it works <span>↓</span></a></div><div class="home-trust"><span>✓</span> Keep your materials, practice, and progress together</div></div><div class="home-preview" aria-label="PacePath study workspace preview"><div class="preview-window"><div class="preview-top"><span class="preview-dots"><i></i><i></i><i></i></span><strong>PacePath <small>STUDY SPACE</small></strong><span class="preview-avatar">S</span></div><div class="preview-content"><div class="preview-greeting"><span>YOUR STUDY SPACE</span><strong>Keep your next step clear.</strong></div><div class="preview-stat-row"><div class="preview-stat"><span>MY MATERIALS</span><b>Organized</b><small>Slides and notes in one place</small></div><div class="preview-stat"><span>YOUR PROGRESS</span><b>Track growth</b><small>See topic results over time</small></div></div><div class="preview-module"><div class="preview-module-head"><span>RECENT MATERIAL</span><b>READY</b></div><div class="preview-file"><span class="preview-file-icon">PPT</span><span><strong>Lecture slides</strong><small>Open reviewer · Practice quiz</small></span><i>→</i></div><div class="preview-progress-label"><span>Suggested next step</span><b>Review a topic</b></div><div class="preview-progress"><i></i></div></div></div></div><div class="preview-float"><span>↗</span><div><b>Study with purpose</b><small>One clear next step at a time</small></div></div></div></section><section class="home-proof"><span>BUILT AROUND HOW YOU STUDY</span><div><b>Your materials</b><i>＋</i><b>Active practice</b><i>＋</i><b>Clear progress</b></div></section><section class="home-section" id="features"><div class="home-section-heading"><span class="home-kicker">A STUDY FLOW THAT CONNECTS</span><h2>From class materials to confident practice.</h2><p>Use the tools in PacePath as one simple learning loop.</p></div><div class="home-feature-grid"><article class="home-feature"><span class="feature-icon blue">▤</span><span class="feature-number">01 / ORGANIZE</span><h3>Keep materials together</h3><p>Upload your course files and open them from one study space. PowerPoint slides can be extracted for review.</p><a href="#how-it-works">Explore materials <b>→</b></a></article><article class="home-feature"><span class="feature-icon green">↻</span><span class="feature-number">02 / PRACTICE</span><h3>Learn by recalling</h3><p>Review slide content, turn key points into flashcards, and check your understanding with a quiz.</p><a href="#study-tools">See study tools <b>→</b></a></article><article class="home-feature"><span class="feature-icon amber">⌁</span><span class="feature-number">03 / IMPROVE</span><h3>Know what to study next</h3><p>Use quiz results to spot topics that need attention and follow your personal learning roadmap.</p><a href="#how-it-works">How it works <b>→</b></a></article></div></section><section class="home-workflow" id="how-it-works"><div><span class="home-kicker">SIMPLE BY DESIGN</span><h2>Three steps. A clearer way forward.</h2><p>Start with what you already have, then let your results guide your next study session.</p><button class="home-cta" data-action="go-auth">Build your study space <span>→</span></button></div><div class="workflow-steps"><article><b>01</b><div><h3>Add your material</h3><p>Upload a PDF, DOCX, or PPTX to your personal library.</p></div></article><article><b>02</b><div><h3>Review and practice</h3><p>Extracted PowerPoint slides become readable study content and quiz prompts.</p></div></article><article><b>03</b><div><h3>Follow your progress</h3><p>Use your quiz performance to focus review and update your roadmap.</p></div></article></div></section><section class="home-tools" id="study-tools"><div class="home-section-heading"><span class="home-kicker">YOUR PACE, YOUR PROGRESS</span><h2>Study tools that work together.</h2></div><div class="home-tool-list"><div><span>01</span><b>Slide reviewer</b><small>Read extracted slide content in a focused layout.</small></div><div><span>02</span><b>Flashcards</b><small>Flip through key points and track what you know.</small></div><div><span>03</span><b>Practice quizzes</b><small>Check your understanding and save each attempt.</small></div><div><span>04</span><b>Gap analysis &amp; roadmap</b><small>See topic accuracy and choose what to review next.</small></div></div></section><section class="home-bottom-cta"><span class="home-kicker">YOUR NEXT STUDY SESSION STARTS HERE</span><h2>Make progress with the materials you already have.</h2><button class="home-cta" data-action="go-auth">Get started with PacePath <span>→</span></button></section></main><footer class="home-footer"><a class="home-brand" href="#home"><span class="brand-mark">P</span><span>PacePath<small>SELF-PACED STUDY HUB</small></span></a><span>Study from your own materials. Move forward at your pace.</span><button data-action="go-auth">Log in / Create account</button></footer></div>`;
}

function fileRow(material) {
  const statusClass = material.status === 'Ready' ? '' : material.status.toLowerCase();
  let actions = material.status === 'Ready'
    ? `<button class="link-button" data-action="open-reviewer" data-id="${esc(material.id)}">View reviewer</button><span class="muted">·</span><button class="link-button" data-action="open-quiz" data-id="${esc(material.id)}">Take quiz</button>`
    : material.status === 'Failed'
      ? `<button class="button small secondary" data-action="retry" data-id="${esc(material.id)}">Retry</button>`
      : 'Available when ready';
  return `<tr><td class="filename">${esc(material.name)}</td><td>${esc(material.type)}</td><td>${dateLabel(material.uploaded)}</td><td><span class="badge ${statusClass}">${esc(material.status)}</span></td><td>${material.topics || '—'}</td><td>${actions}</td></tr>`;
}

function materials() {
  const selected = state.pendingFiles;
  const selectedMarkup = selected.length
    ? `<div class="file-summary"><div class="file-icon">${esc((selected[0].name.split('.').pop() || 'FILE').toUpperCase())}</div><div class="file-summary-copy"><strong>${esc(selected[0].name)}${selected.length > 1 ? ` + ${selected.length - 1} more` : ''}</strong><span class="small-text">${selected.length} file${selected.length === 1 ? '' : 's'} selected · ${formatBytes(selected.reduce((sum, file) => sum + file.size, 0))}</span></div><button class="link-button" data-action="clear-files">Remove</button></div>`
    : `<div class="file-summary empty-file"><div class="file-icon">FILE</div><div><strong>No file selected</strong><span class="small-text">Choose a file to prepare it for upload</span></div></div>`;
  const rows = data.materials.length
    ? data.materials.map(fileRow).join('')
    : `<tr><td colspan="6"><div class="table-empty"><strong>No materials uploaded yet</strong><span>Choose a PDF, DOCX, or PPTX to get started.</span></div></td></tr>`;
  return shell(`<input id="file-picker" type="file" accept=".pdf,.docx,.pptx" multiple hidden>${pageTitle('Study Materials','Upload lecture notes, slides, or readings. View each file’s processing status and open its study tools.')}<div class="grid upload-grid"><div class="dropzone ${state.dragOver?'drag':''}" id="dropzone"><div class="upload-icon">⇧</div><strong>Drag &amp; drop files here</strong><p>PDF, DOCX, or PPTX</p><button class="button secondary small" data-action="browse">Browse files</button></div><article class="card"><div class="eyebrow">Selected file</div>${selectedMarkup}<div class="check-list"><span>Extract text from the document</span><span>Identify the topics it covers</span><span>Generate the reviewer and quiz questions</span></div><button class="button" data-action="upload" ${selected.length?'':'disabled'}>Upload &amp; generate</button></article></div><article class="card"><div class="card-title"><h2>My materials</h2><span class="small-text">${data.materials.length} file${data.materials.length===1?'':'s'}</span></div><div class="table-wrap"><table class="table"><thead><tr><th>File name</th><th>Type</th><th>Uploaded</th><th>Status</th><th>Topics</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div></article>`);
}

function profile() {
  return shell(`${pageTitle('My profile','Manage the personal information on your PacePath account.')}<article class="card profile-card"><div class="profile-heading"><span class="avatar profile-avatar">${esc(initials(state.name))}</span><div><h2>Personal information</h2><p>Your name and email are used to identify your account.</p></div></div><form id="profile-form"><div class="field"><label for="profile-name">Full name</label><input id="profile-name" name="fullName" type="text" maxlength="200" autocomplete="name" value="${esc(state.name)}" required></div><div class="field"><label for="profile-email">Email address</label><input id="profile-email" name="email" type="email" maxlength="254" autocomplete="email" value="${esc(state.email)}" required></div><div class="profile-actions"><button class="button" type="submit">Save changes</button><button class="button secondary" type="button" data-screen="materials">Cancel</button></div></form></article>`);
}

function parsedSlides(content) {
  return String(content || '').split(/(?=^Slide \d+\s*$)/m).map(block => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const match = lines[0]?.match(/^Slide (\d+)/);
    if (!match) return null;
    const paragraphs = lines.slice(1);
    return { number: Number(match[1]), title: paragraphs[0] || 'Slide notes', paragraphs: paragraphs.slice(1) };
  }).filter(Boolean);
}
function currentFlashcardTopic() {
  const slide = parsedSlides(state.reviewerText)[state.topic - 1];
  return slide ? { title: slide.title, points: slide.paragraphs.length ? slide.paragraphs : ['Review the slide title and explain its main idea.'] } : (topicContent[state.topic] || topicContent[1]);
}
function slideCard(slide) {
  const body = slide.paragraphs.length
    ? `<div class="extract-slide-body">${slide.paragraphs.map(line => `<p>${esc(line)}</p>`).join('')}</div>`
    : `<p class="extract-empty">No additional text on this slide.</p>`;
  return `<article class="extract-slide"><div class="extract-slide-heading"><span>SLIDE ${slide.number}</span><h3>${esc(slide.title)}</h3></div>${body}</article>`;
}
async function loadReviewer(id) {
  state.reviewerMaterialId = id;
  state.reviewerText = '';
  try {
    const result = await api(`/materials/${encodeURIComponent(id)}/reviewer`);
    state.reviewerText = result.content;
    const slides = parsedSlides(result.content);
    if (state.topic > slides.length && slides.length) state.topic = 1;
    if (state.screen === 'reviewer' && activeMaterial()?.id === id) render();
  } catch (error) { notify(error.message); }
}
function reviewer() {
  const material = activeMaterial();
  if (!material) return shell(`${pageTitle('Reviewer','Review topics from your uploaded materials.')}${emptyState('No ready materials yet','Upload a file and wait for it to be ready before opening a reviewer.')}`);
  const slides = parsedSlides(state.reviewerMaterialId === material.id ? state.reviewerText : '');
  const count = slides.length || Math.max(5, material.topics || 0);
  const selected = topicContent[state.topic] || topicContent[1];
  const topicOptions = Array.from({ length: count }, (_, i) => `<button type="button" class="topic-choice ${state.topic === i + 1 ? 'active' : ''}" data-topic-choice="${i + 1}"><span class="slide-nav-number">${String(slides[i]?.number || i + 1).padStart(2, '0')}</span><span class="slide-nav-title">${esc(slides[i]?.title || `Topic ${i + 1}`)}</span><span class="slide-nav-arrow">›</span></button>`).join('');
  const selectedSlide = slides[state.topic - 1];
  const modeContent = state.reviewerMode === 'flashcards' && selectedSlide
    ? flashcards({ title: selectedSlide.title, points: selectedSlide.paragraphs.length ? selectedSlide.paragraphs : ['Review the slide title and explain its main idea.'] })
    : state.reviewerMode === 'flashcards' ? flashcards(selected)
      : selectedSlide ? `<section class="slide-reader"><div class="slide-reader-intro"><span class="eyebrow">Your material · Slide ${selectedSlide.number}</span><h3>${esc(selectedSlide.title)}</h3><p>Key text extracted from this slide.</p></div>${slideCard(selectedSlide)}</section>`
        : `<section class="review-section"><p>${state.reviewerMaterialId === material.id ? 'No readable slide text was found.' : 'Loading extracted slides…'}</p></section>`;
  return shell(`${pageTitle('Reviewer',`Organized by slide from ${esc(material.name)}.`,btn('Regenerate reviewer','regenerate','secondary'))}<div class="grid review-layout"><aside class="card topic-sidebar"><div class="field"><label for="material-select">Material</label><select class="select" id="material-select">${readyMaterials().map(file => `<option value="${esc(file.id)}" ${file.id === material.id ? 'selected' : ''}>${esc(file.name)}</option>`).join('')}</select></div><div class="eyebrow">Slides in this material (${count})</div><div class="topic-list">${topicOptions}</div><button class="button" data-action="open-quiz">Take quiz on this material</button></aside><article class="card"><div class="breadcrumbs">Materials / <b>${esc(material.name)}</b></div><div class="review-header"><div><h2>Reviewer</h2><span class="small-text">From ${esc(material.name)}</span></div><span class="badge">Ready</span></div><div class="review-tabs"><button class="${state.reviewerMode==='reviewer'?'active':''}" data-action="review-mode" data-mode="reviewer">Reviewer</button><button class="${state.reviewerMode==='flashcards'?'active':''}" data-action="review-mode" data-mode="flashcards">Flashcards</button></div>${modeContent}<div class="button-row">${btn('Take practice quiz','open-quiz')}<button class="button secondary" data-screen="materials">Back to materials</button></div></article></div>`);
}

function flashcards(topic) {
  const point = topic.points[state.flashcardIndex % topic.points.length];
  const materialId = activeMaterial()?.id || 'none';
  const known = state.flashcardKnown[`${materialId}:${state.topic}`] || [];
  const progress = Math.round((state.flashcardIndex + 1) / topic.points.length * 100);
  return `<section class="flashcard-area"><div class="flashcard-progress-row"><span>SLIDE ${state.topic} · CARD ${state.flashcardIndex + 1} OF ${topic.points.length}</span><span>${known.length} learned</span></div><div class="flashcard-progress"><i style="width:${progress}%"></i></div><button type="button" class="flashcard ${state.flashcardRevealed?'revealed':''}" data-action="flip-flashcard" aria-label="${state.flashcardRevealed?'Show prompt':'Reveal answer'}"><span class="flashcard-inner"><span class="flashcard-face flashcard-front"><span class="flashcard-face-label">PROMPT</span><strong>${esc(topic.title)}</strong><small>Think of the key idea, then flip the card</small></span><span class="flashcard-face flashcard-back"><span class="flashcard-face-label">KEY POINT</span><strong>${esc(point)}</strong><small>Click to flip back</small></span></span></button><div class="flashcard-controls"><button class="button secondary" data-action="previous-card" ${state.flashcardIndex===0?'disabled':''}>← Previous</button><button class="button secondary" data-action="flip-flashcard">${state.flashcardRevealed?'Show prompt':'Reveal answer'}</button><button class="button" data-action="next-card">Next →</button></div>${state.flashcardRevealed?`<div class="flashcard-rating"><span>How well did you know it?</span><button class="button secondary" data-action="flashcard-review">Still learning</button><button class="button" data-action="flashcard-known">Got it</button></div>`:''}</section>`;
}

function timerText() {
  const seconds = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function quiz() {
  const material = activeMaterial();
  if (!material) return shell(`${pageTitle('Quiz','Practice with questions based on your study material.')}${emptyState('No ready materials yet','Upload a study file and open its quiz once it is ready.')}`);
  const q = questions[state.question];
  const answered = Object.keys(state.answers).length;
  const selected = state.answers[state.question];
  return shell(`${pageTitle('Quiz',`${esc(material.name)} · ${questions.length} questions`)}<article class="card quiz-summary"><div class="quiz-meta"><div><strong class="quiz-name">Practice quiz</strong><div class="small-text">${esc(material.name)} · ${questions.length} questions</div></div><span class="badge">Elapsed <span id="timer">${timerText()}</span></span></div><div class="quiz-meta quiz-progress-label"><span class="small-text">Question ${state.question + 1} of ${questions.length}</span><span class="small-text">${Math.round((state.question + 1) / questions.length * 100)}%</span></div><div class="quiz-progress"><i style="width:${(state.question + 1) / questions.length * 100}%"></i></div></article><div class="grid quiz-layout"><article class="card question-card"><div class="question-label"><span>Multiple choice</span><span>2 points</span><span>Topic ${q.topic}</span></div><h2 class="question-text">${esc(q.text)}</h2><div class="answers">${q.options.map((option, i) => `<label class="answer-option ${selected === i ? 'selected' : ''}"><input type="radio" name="answer" value="${i}" ${selected === i ? 'checked' : ''}><span>${String.fromCharCode(65 + i)}. ${esc(option)}</span></label>`).join('')}</div><div class="question-controls"><button class="button secondary" data-action="previous" ${state.question === 0 ? 'disabled' : ''}>← Previous</button><button class="button" data-action="next">${state.question === questions.length - 1 ? 'Review answers' : 'Next →'}</button></div></article><aside class="card"><div class="card-title"><h2>Questions</h2><span class="small-text">${answered} answered</span></div><div class="question-grid">${questions.map((_, i) => `<button class="question-number ${i === state.question ? 'current' : ''} ${state.answers[i] !== undefined ? 'answered' : ''}" data-question="${i + 1}">${i + 1}</button>`).join('')}</div><div class="legend"><span><i class="answered"></i> Answered</span><span><i class="current"></i> Current</span><span><i class="empty"></i> Not answered</span></div><hr class="rule"><button class="button" style="width:100%" data-action="submit-quiz">Submit quiz</button></aside></div>`);
}

function resultData(answerSet = state.answers) { return questions.map((question, index) => ({ question, index, choice: answerSet[index], correct: answerSet[index] === question.answer })); }
function topicResult(answerSet = state.answers, materialId = activeMaterial()?.id || '') {
  return Array.from({ length: 5 }, (_, index) => {
    const topic = index + 1;
    const items = resultData(answerSet).filter(answer => answer.question.topic === topic);
    const correct = items.filter(answer => answer.correct).length;
    return { topic: `Topic ${topic}`, topicNumber: topic, materialId, correct, total: items.length, accuracy: items.length ? Math.round(correct / items.length * 100) : 0 };
  });
}

function results() {
  const attempt = data.attempts[data.attempts.length - 1];
  if (!attempt) return shell(`${pageTitle('Quiz results','Your completed quiz results will appear here.')}${emptyState('No quiz results yet','Complete a quiz to see your score and topic breakdown.')}`);
  const rows = resultData(attempt.answers);
  const score = attempt.score;
  const percent = attempt.percent;
  const reviews = state.showAllAnswers ? rows : rows.filter(answer => [0, 3, 6].includes(answer.index));
  const topics = topicResult(attempt.answers, attempt.materialId);
  return shell(`${pageTitle('Quiz results',`${esc(attempt.materialName)} · Submitted ${dateLabel(attempt.date)}`,btn('Retake quiz','retake','secondary'))}<div class="grid result-stats"><article class="card result-stat"><label>Score</label><strong>${score} / 20</strong></article><article class="card result-stat"><label>Percentage</label><strong>${percent}%</strong></article><article class="card result-stat"><label>Time taken</label><strong>${esc(attempt.duration)}</strong></article></div><div class="grid result-layout"><div class="grid"><article class="card"><div class="card-title"><h2>Performance by topic</h2><span class="small-text">${rows.filter(answer => answer.choice !== undefined).length} of 10 answered</span></div>${topics.map(topic => `<div class="topic-score"><strong>${topic.topic}</strong><div class="mini-bar"><i style="width:${topic.accuracy}%"></i></div><span>${topic.correct} of ${topic.total} correct</span></div>`).join('')}</article><article class="card"><div class="card-title"><h2>Answer review</h2><span class="small-text">${state.showAllAnswers ? 'All 10 answers' : 'Selected answers'}</span></div>${reviews.map(answer => `<div class="review-answer"><div><strong>Q${answer.index + 1} · Topic ${answer.question.topic}</strong><div class="muted">Your answer: ${answer.choice === undefined ? 'Not answered' : `Option ${String.fromCharCode(65 + answer.choice)}`}${!answer.correct ? ` · Correct answer: Option ${String.fromCharCode(65 + answer.question.answer)}` : ''}</div></div><span class="${answer.correct ? 'correct-text' : 'incorrect-text'}">${answer.correct ? 'Correct 2 / 2 pts' : 'Incorrect 0 / 2 pts'}</span></div>`).join('')}<button class="link-button" data-action="toggle-answers">${state.showAllAnswers ? 'Show fewer answers' : 'Show all 10 answers'}</button></article></div><aside class="grid"><article class="card"><h2>What next?</h2><p class="small-text">Your results update your topic analysis and roadmap.</p><button class="button" style="width:100%;margin:5px 0" data-screen="gaps">View gap analysis</button><button class="button secondary" style="width:100%;margin:5px 0" data-action="retake">Retake quiz</button><button class="button secondary" style="width:100%;margin:5px 0" data-screen="materials">Back to materials</button></article></aside></div>`);
}

function masteryLevel(accuracy) { return accuracy < 50 ? 'Weak' : accuracy < 80 ? 'Developing' : 'Mastered'; }
function getMetrics(materialId = 'all') { return data.mastery.filter(row => materialId === 'all' || row.materialId === materialId); }
function historyRows(attempts) {
  if (!attempts.length) return `<tr><td colspan="5"><div class="table-empty"><strong>No quiz attempts yet</strong><span>Complete a quiz to start tracking your progress.</span></div></td></tr>`;
  return attempts.slice().reverse().map(attempt => `<tr><td>${dateLabel(attempt.date)}</td><td class="filename">${esc(attempt.materialName)}</td><td>${attempt.score} / ${attempt.total}</td><td>${attempt.percent}%</td><td>${esc(attempt.duration)}</td></tr>`).join('');
}
function scoreChart(attempts) {
  if (!attempts.length) return `<div class="chart-empty">Your score history will appear after you complete a quiz.</div>`;
  const list = attempts.slice(-6);
  const points = list.map((attempt, i) => {
    const x = 28 + i * (276 / Math.max(1, list.length - 1));
    const y = 105 - attempt.percent * .85;
    return { x, y, label: i + 1 };
  });
  return `<svg class="chart" viewBox="0 0 330 130" role="img" aria-label="Quiz scores across attempts"><path d="M24 108H318M24 72H318M24 36H318" fill="none" stroke="#e4ebf2"/><polyline points="${points.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="#2466a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#fff" stroke="#2466a8" stroke-width="2"/>`).join('')}<text x="24" y="126">Earlier</text><text x="270" y="126">Recent</text></svg>`;
}

function gapScreen() {
  const rows = getMetrics(state.gapMaterial).sort((a, b) => a.accuracy - b.accuracy);
  const weak = rows.filter(row => row.accuracy < 50);
  const mastered = rows.filter(row => row.accuracy >= 80);
  const overall = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.accuracy, 0) / rows.length) : 0;
  const attempts = data.attempts.filter(attempt => state.gapMaterial === 'all' || attempt.materialId === state.gapMaterial);
  const select = `<label class="small-text" for="gap-material-filter">Material <select class="select" id="gap-material-filter" style="width:165px;display:inline-block;margin-left:6px"><option value="all" ${state.gapMaterial === 'all' ? 'selected' : ''}>All materials</option>${readyMaterials().map(material => `<option value="${esc(material.id)}" ${state.gapMaterial === material.id ? 'selected' : ''}>${esc(material.name)}</option>`).join('')}</select></label>`;
  const tableRows = rows.length ? rows.map(row => `<tr><td class="filename">${esc(row.topic)}</td><td>${row.answered}</td><td>${row.correct}</td><td><div class="accuracy-cell"><div class="mini-bar"><i style="width:${row.accuracy}%"></i></div>${row.accuracy}%</div></td><td><span class="mastery ${masteryLevel(row.accuracy).toLowerCase()}">${masteryLevel(row.accuracy)}</span></td><td>${dateLabel(row.date)}</td></tr>`).join('') : `<tr><td colspan="6"><div class="table-empty"><strong>No topics assessed yet</strong><span>Complete a quiz to see topic accuracy and mastery.</span></div></td></tr>`;
  const focus = weak.length ? weak.map(row => `<div class="focus-item"><div><strong>${esc(row.topic)} · ${row.accuracy}%</strong><span class="small-text">${masteryLevel(row.accuracy)}</span></div><button class="link-button" data-action="study-topic" data-id="${esc(row.materialId)}" data-topic="${row.topicNumber}">Study</button></div>`).join('') : `<p class="small-text">No weak topics to show yet.</p>`;
  return shell(`${pageTitle('Knowledge gap analysis','See which topics you understand and which need more attention.',select)}<div class="grid gap-stats"><article class="card gap-stat"><label>Topics assessed</label><strong>${rows.length}</strong><span class="small-text">In selected materials</span></article><article class="card gap-stat"><label>Overall accuracy</label><strong>${overall}%</strong><span class="small-text">Across assessed topics</span></article><article class="card gap-stat"><label>Weak topics</label><strong>${weak.length}</strong><span class="small-text">Below 50%</span></article><article class="card gap-stat"><label>Mastered topics</label><strong>${mastered.length}</strong><span class="small-text">80% and above</span></article></div><div class="grid gap-layout"><article class="card"><div class="card-title"><h2>Accuracy by topic</h2><span class="small-text">Last assessed</span></div><div class="table-wrap"><table class="table accuracy-table"><thead><tr><th>Topic</th><th>Answered</th><th>Correct</th><th>Accuracy</th><th>Mastery</th><th>Last assessed</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="small-text" style="margin:12px 0 0">Weak below 50% · Developing 50–79% · Mastered 80% and above</p></article><div class="grid"><article class="card"><div class="card-title"><h2>Needs focus</h2></div>${focus}<button class="button" style="width:100%;margin-top:10px" data-action="update-roadmap" ${rows.length?'':'disabled'}>Update my roadmap</button></article><article class="card"><div class="card-title"><h2>Score over attempts</h2></div>${scoreChart(attempts)}</article></div></div><article class="card history-card"><div class="card-title"><h2>Past quiz attempts</h2><span class="small-text">${attempts.length} attempt${attempts.length===1?'':'s'}</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Material</th><th>Score</th><th>Percentage</th><th>Time taken</th></tr></thead><tbody>${historyRows(attempts)}</tbody></table></div></article>`);
}

function roadmapItems() {
  const metrics = getMetrics(state.gapMaterial);
  const byTopic = new Map();
  metrics.forEach(row => { const key = `${row.materialId}:${row.topic}`; if (!byTopic.has(key)) byTopic.set(key, row); });
  return [...byTopic.values()].sort((a, b) => a.accuracy - b.accuracy).slice(0, 4);
}
function roadmapStatusKey(row) { return `${row.materialId}:${row.topic}`; }
function roadmap() {
  const items = roadmapItems();
  const select = `<label class="small-text" for="roadmap-material-filter">Material <select class="select" id="roadmap-material-filter" style="width:165px;display:inline-block;margin-left:6px"><option value="all" ${state.gapMaterial === 'all' ? 'selected' : ''}>All materials</option>${readyMaterials().map(material => `<option value="${esc(material.id)}" ${state.gapMaterial === material.id ? 'selected' : ''}>${esc(material.name)}</option>`).join('')}</select></label>`;
  if (!items.length) return shell(`${pageTitle('Learning roadmap','Your study steps are prioritized from your quiz results.',select)}${emptyState('Your roadmap will start here','Complete a quiz to identify topics for your personalized study sequence.','View materials','materials')}`);
  const done = items.filter(item => (data.roadmapStatus[roadmapStatusKey(item)] || 'Not started') === 'Done').length;
  const itemMarkup = items.map((item, index) => {
    const status = data.roadmapStatus[roadmapStatusKey(item)] || 'Not started';
    const reason = item.accuracy < 50 ? `Why now: accuracy is ${item.accuracy}%, below the 50% weak threshold.` : item.accuracy < 80 ? `Why next: accuracy is ${item.accuracy}%, still developing.` : `Why next: accuracy is ${item.accuracy}%; keep reviewing to maintain mastery.`;
    const topicNumber = item.topicNumber;
    return `<section class="roadmap-step ${status === 'Done' ? 'done' : ''}"><div class="roadmap-num">${status === 'Done' ? '✓' : index + 1}</div><div><h3>${esc(item.topic)}</h3><p>${esc(topicContent[topicNumber]?.title || 'Review this topic from your material.')}</p><p class="reason">${reason}</p></div><div class="step-actions"><label class="sr-only" for="step-status-${index}">Status for ${esc(item.topic)}</label><select class="step-status-select" id="step-status-${index}" data-roadmap-status data-key="${esc(roadmapStatusKey(item))}"><option ${status === 'Not started' ? 'selected' : ''}>Not started</option><option ${status === 'In progress' ? 'selected' : ''}>In progress</option><option ${status === 'Done' ? 'selected' : ''}>Done</option></select><button class="button small secondary" data-action="study-topic" data-id="${esc(item.materialId)}" data-topic="${topicNumber}">Open reviewer</button><button class="button small soft" data-action="open-quiz" data-id="${esc(item.materialId)}">Practice quiz</button></div></section>`;
  }).join('');
  return shell(`${pageTitle('Learning roadmap','A study sequence prioritized by your topic accuracy.',`${select}${btn('Regenerate roadmap','update-roadmap','secondary')}`)}<article class="card"><div class="roadmap-head"><div><h2>Personal learning plan <span class="badge" style="margin-left:7px">Active</span></h2><span class="small-text">Updated ${dateLabel(today())}</span></div><strong class="roadmap-count">${done} of ${items.length} steps done</strong></div><div class="roadmap-progress" style="margin:14px 0 4px"><i style="width:${100 * done / items.length}%"></i></div>${itemMarkup}</article>`);
}

function render() {
  if (state.screen === 'welcome') { root.innerHTML = welcome(); return; }
  if (state.screen === 'auth') { root.innerHTML = authPage(); return; }
  const pages = { materials, reviewer, quiz, results, gaps: gapScreen, roadmap, profile };
  root.innerHTML = (pages[state.screen] || materials)();
}
function go(screen) {
  if (screen === 'quiz' && state.screen !== 'quiz') { state.startedAt = Date.now(); state.question = 0; state.answers = {}; state.showAllAnswers = false; }
  state.screen = screen;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function login(user) { state.name = user.fullName; state.email = user.email; data.name = state.name; data.email = state.email; save(); go('materials'); notify(`Welcome, ${state.name}`); }
function setMaterial(id) { if (id && data.materials.some(material => material.id === id)) state.selectedMaterial = id; }
function openQuiz(id) {
  setMaterial(id);
  if (!activeMaterial()) { go('quiz'); return; }
  api(`/materials/${encodeURIComponent(activeMaterial().id)}/quiz`).then(result => {
    state.quizId = result.quizId;
    questions = result.questions.map(question => ({ ...question, answer: undefined }));
    state.startedAt = Date.now(); state.question = 0; state.answers = {}; state.showAllAnswers = false; go('quiz');
  }).catch(error => notify(error.message));
}
function updateTopicMetrics(scores, material) {
  scores.forEach(score => {
    const existing = data.mastery.find(row => row.topic === score.topic && row.materialId === material.id);
    if (existing) {
      existing.accuracy = Math.round((existing.accuracy * existing.answered + score.accuracy * score.total) / (existing.answered + score.total));
      existing.answered += score.total;
      existing.correct = Math.round(existing.answered * existing.accuracy / 100);
      existing.date = today();
    } else data.mastery.push({ ...score, materialId: material.id, answered: score.total, date: today() });
  });
}
async function submitQuiz() {
  const material = activeMaterial();
  if (!material) { notify('Upload a ready material before taking a quiz.'); return; }
  const blank = questions.length - Object.keys(state.answers).length;
  if (blank && !confirm(`You have ${blank} unanswered question${blank === 1 ? '' : 's'}. Submit anyway?`)) return;
  const duration = timerText();
  try {
    const response = await api('/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materialId: material.id, quizId: state.quizId, answers: state.answers, duration }) });
    await refreshProgress();
    if (!data.attempts.some(attempt => attempt.id === response.attempt.id)) throw new Error('Quiz saved, but its result could not be loaded.');
    go('results'); notify('Quiz submitted. Your progress is saved.');
  } catch (error) { notify(error.message); }
}
function addFiles(files) {
  const allowed = ['pdf', 'docx', 'pptx'];
  const selected = [...files].filter(file => allowed.includes(file.name.split('.').pop().toLowerCase()));
  if (selected.length !== files.length) notify('Only PDF, DOCX, and PPTX files are supported.');
  state.pendingFiles = selected;
  render();
}
async function uploadPending() {
  if (!state.pendingFiles.length) { notify('Choose a file first.'); return; }
  try {
    const form = new FormData();
    state.pendingFiles.forEach(file => form.append('files', file));
    await api('/materials', { method: 'POST', body: form });
    state.pendingFiles = [];
    await refreshMaterials();
    state.screen = 'materials'; render();
    notify('Files uploaded. PowerPoint files are ready for review.');
  } catch (error) { notify(error.message); }
}
async function updateRoadmap() {
  try { await api('/roadmap/refresh', { method: 'POST' }); await refreshProgress(); go('roadmap'); notify('Roadmap updated from your topic results.'); }
  catch (error) { notify(error.message); }
}

root.addEventListener('click', event => {
  const screen = event.target.closest('[data-screen]');
  if (screen) { if (state.screen === 'welcome') return; go(screen.dataset.screen); return; }
  const topicChoice = event.target.closest('[data-topic-choice]');
  if (topicChoice) { state.topic = Number(topicChoice.dataset.topicChoice); state.flashcardIndex = 0; state.flashcardRevealed = false; render(); return; }
  const questionButton = event.target.closest('[data-question]');
  if (questionButton) { state.question = Number(questionButton.dataset.question) - 1; render(); return; }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  switch (action.dataset.action) {
    case 'go-auth': state.screen = 'auth'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'go-home': state.screen = 'welcome'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'social-login': notify(`${action.dataset.provider} sign-in is not connected yet.`); break;
    case 'browse': root.querySelector('#file-picker')?.click(); break;
    case 'clear-files': state.pendingFiles = []; render(); break;
    case 'upload': uploadPending(); break;
    case 'open-reviewer': setMaterial(action.dataset.id); go('reviewer'); loadReviewer(action.dataset.id); break;
    case 'open-quiz': openQuiz(action.dataset.id); break;
    case 'retry': {
      const item = data.materials.find(material => material.id === action.dataset.id);
      if (item) { item.status = 'Processing'; save(); render(); setTimeout(() => { item.status = 'Ready'; item.topics = 5; save(); render(); notify('Your file is ready.'); }, 900); }
      break;
    }
    case 'regenerate': notify('Reviewer generation requires the AI service connection.'); break;
    case 'review-mode': state.reviewerMode = action.dataset.mode; state.flashcardRevealed = false; render(); break;
    case 'flip-flashcard': state.flashcardRevealed = !state.flashcardRevealed; render(); break;
    case 'previous-card': if (state.flashcardIndex > 0) { state.flashcardIndex--; state.flashcardRevealed = false; render(); } break;
    case 'next-card': { const topic = currentFlashcardTopic(); state.flashcardIndex = (state.flashcardIndex + 1) % topic.points.length; state.flashcardRevealed = false; render(); break; }
    case 'flashcard-review': state.flashcardRevealed = false; { const topic = currentFlashcardTopic(); state.flashcardIndex = (state.flashcardIndex + 1) % topic.points.length; render(); } break;
    case 'flashcard-known': { const topic = currentFlashcardTopic(); const key = `${activeMaterial()?.id || 'none'}:${state.topic}`; const known = state.flashcardKnown[key] || []; if (!known.includes(state.flashcardIndex)) known.push(state.flashcardIndex); state.flashcardKnown[key] = known; state.flashcardIndex = (state.flashcardIndex + 1) % topic.points.length; state.flashcardRevealed = false; render(); break; }
    case 'previous': if (state.question > 0) { state.question--; render(); } break;
    case 'next': if (state.question < questions.length - 1) { state.question++; render(); } else notify('Review your answers or submit the quiz.'); break;
    case 'submit-quiz': submitQuiz(); break;
    case 'toggle-answers': state.showAllAnswers = !state.showAllAnswers; render(); break;
    case 'retake': openQuiz(); break;
    case 'study-topic': setMaterial(action.dataset.id); state.topic = Number(action.dataset.topic) || 1; state.reviewerMode = 'reviewer'; go('reviewer'); loadReviewer(action.dataset.id); break;
    case 'update-roadmap': updateRoadmap(); break;
    case 'logout': api('/logout', { method: 'POST' }).catch(() => {}); data.materials = []; state.screen = 'welcome'; render(); break;
  }
});

root.addEventListener('change', event => {
  if (event.target.id === 'file-picker') { addFiles(event.target.files); return; }
  if (event.target.id === 'material-select') { setMaterial(event.target.value); render(); loadReviewer(event.target.value); return; }
  if (event.target.id === 'gap-material-filter' || event.target.id === 'roadmap-material-filter') { state.gapMaterial = event.target.value; render(); return; }
  if (event.target.matches('[data-roadmap-status]')) {
    const [materialId, ...topicParts] = event.target.dataset.key.split(':');
    api('/roadmap/item', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materialId, topic: topicParts.join(':'), status: event.target.value }) })
      .then(result => { data.roadmapStatus = result.statuses; save(); render(); }).catch(error => notify(error.message));
    return;
  }
  if (event.target.name === 'answer') { state.answers[state.question] = Number(event.target.value); render(); }
});

root.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'login-form') {
    api('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: root.querySelector('#login-email').value, password: root.querySelector('#login-password').value }) })
      .then(async ({ user }) => { login(user); await refreshMaterials(); await refreshProgress(); render(); }).catch(error => notify(error.message));
  }
  if (event.target.id === 'register-form') {
    const name = root.querySelector('#register-name').value.trim();
    const password = root.querySelector('#register-password').value;
    const confirmPassword = root.querySelector('#register-confirm').value;
    if (password !== confirmPassword) { notify('Passwords do not match.'); return; }
    if (!root.querySelector('#privacy-consent').checked) { notify('Please review and accept the privacy notice.'); return; }
    api('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: name, email: root.querySelector('#register-email').value, password }) })
      .then(async ({ user }) => { login(user); await refreshMaterials(); await refreshProgress(); render(); }).catch(error => notify(error.message));
  }
  if (event.target.id === 'profile-form') {
    const fullName = root.querySelector('#profile-name').value.trim();
    const email = root.querySelector('#profile-email').value.trim();
    api('/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName, email }) })
      .then(({ user }) => { state.name = user.fullName; state.email = user.email; data.name = state.name; data.email = state.email; save(); render(); notify('Profile updated.'); })
      .catch(error => notify(error.message));
  }
});

root.addEventListener('dragover', event => { if (event.target.closest('#dropzone')) { event.preventDefault(); state.dragOver = true; root.querySelector('#dropzone')?.classList.add('drag'); } });
root.addEventListener('dragleave', event => { if (event.target.closest('#dropzone')) { state.dragOver = false; root.querySelector('#dropzone')?.classList.remove('drag'); } });
root.addEventListener('drop', event => { if (event.target.closest('#dropzone')) { event.preventDefault(); state.dragOver = false; addFiles(event.dataTransfer.files); } });
document.addEventListener('keydown', event => {
  if (state.screen !== 'reviewer' || state.reviewerMode !== 'flashcards' || event.target.matches('input,textarea,select')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); root.querySelector('[data-action="next-card"]')?.click(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); root.querySelector('[data-action="previous-card"]')?.click(); }
  if (event.code === 'Space' && !event.target.closest('button')) { event.preventDefault(); root.querySelector('[data-action="flip-flashcard"]')?.click(); }
});
setInterval(() => { const timer = document.querySelector('#timer'); if (timer && state.screen === 'quiz') timer.textContent = timerText(); }, 1000);
api('/me').then(async ({ user }) => { login(user); await refreshMaterials(); await refreshProgress(); render(); }).catch(() => render());
