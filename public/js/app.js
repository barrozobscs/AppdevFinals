/* PacePath front-end. Real authentication, file processing, and AI generation require a backend. */
const STORE_KEY = 'pacePathProjectUI_v2';
const THEME_KEY = 'pacePathTheme';
if (localStorage.getItem(THEME_KEY) === 'dark') document.documentElement.dataset.theme = 'dark';

const data = loadData();
const state = {
  screen: 'welcome',
  name: data.name || 'Lance',
  email: data.email || '',
  profilePicture: data.profilePicture || null,
  flashcardKnown: {},
  selectedMaterial: '',
  gapMaterial: 'all',
  topic: 1,
  question: 0,
  answers: {},
  quizId: '',
  quizQuestions: [],
  startedAt: null,
  showAllAnswers: false,
  pendingFiles: [],
  dragOver: false,
  reviewerMode: 'reviewer',
  flashcardIndex: 0,
  flashcardRevealed: false,
  reviewerText: '',
  studyGuide: null,
  aiProgress: null,
};

let pendingProfilePicture = null;
let lastRenderedScreen = null;
const root = document.querySelector('#app');
const toastEl = document.querySelector('#toast');

const questions = [
  { topic: 1, text: 'What does an adaptive learning system use to personalize a student’s next study steps?', options: ['A fixed sequence for every student', 'The student’s assessment performance', 'The file upload date only', 'The number of pages in a document'], answer: 1 },
  { topic: 1, text: 'Which item can be generated from uploaded study material?', options: ['A reviewer and practice quiz', 'A class attendance sheet', 'A public website', 'A payment receipt'], answer: 0 },
  { topic: 2, text: 'What is the purpose of extracting text from an uploaded file?', options: ['To identify concepts and topics', 'To change the file name', 'To share the file publicly', 'To grade a student immediately'], answer: 0 },
  { topic: 2, text: 'Which formats are accepted by PacePath?', options: ['MP3 only', 'PDF, DOCX, PPTX, or TXT', 'ZIP only', 'EXE files'], answer: 1 },
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
function confirmDialog({ title, message, confirmText = 'Continue', danger = false }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.innerHTML = `<section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"><span class="confirm-dialog-icon" aria-hidden="true">!</span><h2 id="confirm-dialog-title"></h2><p id="confirm-dialog-message"></p><div class="confirm-dialog-actions"><button type="button" class="button secondary" data-confirm-cancel>Cancel</button><button type="button" class="button ${danger ? 'danger' : ''}" data-confirm-accept></button></div></section>`;
    backdrop.querySelector('#confirm-dialog-title').textContent = title;
    backdrop.querySelector('#confirm-dialog-message').textContent = message;
    backdrop.querySelector('[data-confirm-accept]').textContent = confirmText;
    const cancelButton = backdrop.querySelector('[data-confirm-cancel]');
    const acceptButton = backdrop.querySelector('[data-confirm-accept]');
    const finish = result => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      resolve(result);
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === cancelButton ? acceptButton : cancelButton).focus();
      }
    };
    cancelButton.addEventListener('click', () => finish(false));
    acceptButton.addEventListener('click', () => finish(true));
    backdrop.addEventListener('click', event => { if (event.target === backdrop) finish(false); });
    document.addEventListener('keydown', onKeyDown);
    document.body.append(backdrop);
    cancelButton.focus();
  });
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

function timerText() {
  const seconds = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function activeQuestions() { return state.quizQuestions.length ? state.quizQuestions : questions; }

function showLoadingScreen(message) {
  root.innerHTML = `<main class="app-loading" role="status" aria-label="${message}">
    <span class="app-loading-mark" aria-hidden="true">P</span>
    <span class="app-loading-spinner" aria-hidden="true"></span>
    <strong>PacePath</strong>
    <p>${message}</p>
  </main>`;
}

function render() {
  if (state.screen === 'welcome') root.innerHTML = welcome();
  else if (state.screen === 'auth') root.innerHTML = authPage();
  else {
    const pages = { materials, reviewer, quiz, results, gaps: gapScreen, roadmap, profile: profilePage };
    root.innerHTML = (pages[state.screen] || materials)();
  }
  if (lastRenderedScreen !== state.screen) {
    const page = root.querySelector('.homepage, .welcome, .page');
    if (page) page.classList.add('page-enter');
    lastRenderedScreen = state.screen;
  }
}
function go(screen) {
  if (screen === 'quiz' && state.screen !== 'quiz') { state.startedAt = Date.now(); state.question = 0; state.answers = {}; state.showAllAnswers = false; }
  state.screen = screen;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function login(name) { state.name = name || 'Lance'; data.name = state.name; save(); go('materials'); notify(`Welcome, ${state.name}`); }
async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'The request failed.');
    error.status = response.status;
    throw error;
  }
  return body;
}
async function apiProgress(path, options = {}, onProgress = () => {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'The request failed.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = chunk.split(/\r?\n/).find(line => line.startsWith('data: '));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6));
      if (event.type === 'progress') onProgress(event);
      else if (event.type === 'error') throw new Error(event.error || 'AI generation failed.');
      else if (event.type === 'done') {
        onProgress({ percent: 100, phase: 'complete', message: 'Complete.' });
        return event.data;
      }
    }
    if (done) break;
  }
  throw new Error('The server closed the progress stream before finishing.');
}
async function loadAccountProgress() {
  const progress = await apiRequest('/api/progress');
  data.attempts = progress.attempts;
  data.mastery = progress.mastery;
  const roadmap = await apiRequest('/api/roadmap');
  data.roadmapStatus = roadmap.statuses;
}
async function enterAccount(user) {
  state.name = user.fullName;
  state.email = user.email || '';
  state.profilePicture = user.profilePicture || null;
  data.name = user.fullName;
  data.email = state.email;
  data.profilePicture = state.profilePicture;
  try {
    const { materials } = await apiRequest('/api/materials');
    data.materials = materials;
  } catch (error) { notify(error.message); }
  try { await loadAccountProgress(); }
  catch (error) { notify(error.message); }
  save();
  state.screen = 'materials';
  render();
  notify(`Welcome, ${user.fullName}`);
}
async function restoreSession() {
  try {
    const { user } = await apiRequest('/api/me');
    state.name = user.fullName;
    state.email = user.email || '';
    state.profilePicture = user.profilePicture || null;
    data.name = user.fullName;
    data.email = state.email;
    data.profilePicture = state.profilePicture;
    const { materials } = await apiRequest('/api/materials');
    data.materials = materials;
    await loadAccountProgress();
    save();
    state.screen = 'materials';
    render();
    return true;
  } catch (error) {
    if (error.status !== 401) notify(error.message);
    return false;
  }
}
async function logoutAccount() {
  try { await apiRequest('/api/logout', { method: 'POST' }); }
  catch (error) { notify(error.message); }
  state.screen = 'welcome';
  render();
}
async function openReviewer(id) {
  setMaterial(id);
  const material = activeMaterial();
  if (!material) { state.reviewerText = ''; state.studyGuide = null; go('reviewer'); return; }
  state.reviewerText = '';
  state.studyGuide = null;
  try {
    const result = await apiRequest(`/api/materials/${encodeURIComponent(material.id)}/reviewer`);
    state.studyGuide = result.studyGuide || null;
    state.reviewerText = state.studyGuide ? '' : result.content;
    go('reviewer');
  } catch (error) { notify(error.message); }
}
async function processMaterial(id) {
  if (!id) return;
  state.aiProgress = { percent: 2, phase: 'preparing', message: 'Starting AI study guide generation…' };
  render();
  try {
    const { material, studyGuide } = await apiProgress(`/api/materials/${encodeURIComponent(id)}/process`, { method: 'POST' }, progress => {
      state.aiProgress = progress;
      render();
    });
    const index = data.materials.findIndex(item => item.id === material.id);
    if (index >= 0) data.materials[index] = material;
    state.studyGuide = studyGuide || null;
    state.reviewerText = '';
    save();
    render();
    await new Promise(resolve => setTimeout(resolve, 500));
    state.aiProgress = null;
    render();
    notify('AI study guide and quiz generated. Open the reviewer to read it.');
  } catch (error) {
    try {
      const { materials } = await apiRequest('/api/materials');
      data.materials = materials;
      save();
    } catch {}
    state.aiProgress = { percent: state.aiProgress?.percent || 0, phase: 'error', message: error.message };
    render();
    setTimeout(() => { if (state.aiProgress?.phase === 'error') { state.aiProgress = null; render(); } }, 5000);
    notify(error.message);
  }
}
function setMaterial(id) { if (id && data.materials.some(material => material.id === id)) state.selectedMaterial = id; }
async function openQuiz(id) {
  const replacingQuiz = state.screen === 'quiz' && Boolean(state.quizId);
  const hasAnswers = replacingQuiz && Object.keys(state.answers).length > 0;
  const confirmed = await confirmDialog({
    title: 'Start a new quiz?',
    message: hasAnswers
      ? 'Starting another quiz will discard the answers in your current quiz. Do you want to continue?'
      : replacingQuiz
        ? 'This will replace the quiz that is currently open. Do you want to continue?'
        : 'A new quiz will start with fresh questions and no saved answers. Continue?',
    confirmText: 'Start quiz',
  });
  if (!confirmed) return;
  setMaterial(id);
  const material = activeMaterial();
  if (!material || material.status !== 'Ready') { go('quiz'); return; }
  try {
    const quiz = await apiRequest(`/api/materials/${encodeURIComponent(material.id)}/quiz`);
    state.quizId = quiz.quizId;
    state.quizQuestions = quiz.questions;
    state.startedAt = Date.now();
    state.question = 0;
    state.answers = {};
    state.showAllAnswers = false;
    go('quiz');
  } catch (error) { notify(error.message); }
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
  const questionSet = activeQuestions();
  if (!state.quizId || !questionSet.length) { notify('Open a material quiz before submitting.'); return; }
  const blank = questionSet.length - Object.keys(state.answers).length;
  if (blank && !(await confirmDialog({
    title: 'Submit quiz with unanswered questions?',
    message: `You have ${blank} unanswered question${blank === 1 ? '' : 's'}. Submit your quiz anyway?`,
    confirmText: 'Submit quiz',
  }))) return;
  try {
    await apiRequest('/api/attempts', {
      method: 'POST',
      body: JSON.stringify({ materialId: material.id, quizId: state.quizId, answers: state.answers, duration: timerText() }),
    });
    await loadAccountProgress();
    save();
    go('results');
    notify('Quiz result and topic progress saved to your account.');
  } catch (error) { notify(error.message); }
}
function addFiles(files) {
  const allowed = ['pdf', 'docx', 'pptx', 'txt'];
  const selected = [...files].filter(file => allowed.includes(file.name.split('.').pop().toLowerCase()));
  if (selected.length !== files.length) notify('Supported study materials: PDF, DOCX, PPTX, and TXT.');
  state.pendingFiles = selected;
  render();
}
async function uploadPending() {
  if (!state.pendingFiles.length) { notify('Choose a file first.'); return; }
  const files = [...state.pendingFiles];
  const form = new FormData();
  files.forEach(file => form.append('files', file));
  state.pendingFiles = [];
  state.aiProgress = { percent: 2, phase: 'preparing', message: 'Uploading and preparing your materials…' };
  render();
  try {
    const { materials } = await apiProgress('/api/materials', { method: 'POST', body: form }, progress => {
      state.aiProgress = progress;
      render();
    });
    data.materials.unshift(...materials);
    state.selectedMaterial = materials[0]?.id || '';
    save();
    state.screen = 'materials';
    render();
    await new Promise(resolve => setTimeout(resolve, 500));
    state.aiProgress = null;
    render();
    const readyCount = materials.filter(material => material.status === 'Ready').length;
    if (readyCount === materials.length) {
      notify('AI study guides and quizzes generated. Open a reviewer to study the material.');
    } else if (readyCount > 0) {
      notify('Some files failed. Use Retry beside each failed material.');
    } else {
      notify('These files failed processing. Use Retry beside each failed material.');
    }
  } catch (error) {
    state.pendingFiles = files;
    state.aiProgress = { percent: state.aiProgress?.percent || 0, phase: 'error', message: error.message };
    render();
    setTimeout(() => { if (state.aiProgress?.phase === 'error') { state.aiProgress = null; render(); } }, 5000);
    notify(error.message);
  }
}
async function deleteMaterial(id) {
  const material = data.materials.find(item => item.id === id);
  if (!material || !(await confirmDialog({
    title: 'Delete this material?',
    message: `Delete “${material.name}” and its reviewer, quiz attempts, and topic progress? This cannot be undone.`,
    confirmText: 'Delete material',
    danger: true,
  }))) return;
  try {
    await apiRequest(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const { materials } = await apiRequest('/api/materials');
    data.materials = materials;
    if (state.selectedMaterial === id) state.selectedMaterial = materials.find(item => item.status === 'Ready')?.id || materials[0]?.id || '';
    state.studyGuide = null;
    state.reviewerText = '';
    await loadAccountProgress().catch(() => {});
    save();
    render();
    notify('Material and its study records deleted.');
  } catch (error) { notify(error.message); }
}
async function updateRoadmap() {
  try {
    const roadmap = await apiRequest('/api/roadmap/refresh', { method: 'POST' });
    data.roadmapStatus = roadmap.statuses;
    save();
    go('roadmap');
    notify('Roadmap refreshed and saved to your account.');
  } catch (error) { notify(error.message); }
}

async function persistRoadmapStatus(key, status) {
  const separator = key.indexOf(':');
  const materialId = key.slice(0, separator);
  const topic = key.slice(separator + 1);
  try {
    const roadmap = await apiRequest('/api/roadmap/item', {
      method: 'PATCH',
      body: JSON.stringify({ materialId, topic, status }),
    });
    data.roadmapStatus = roadmap.statuses;
    save();
    render();
  } catch (error) { notify(error.message); }
}

root.addEventListener('click', event => {
  const screen = event.target.closest('[data-screen]');
  if (screen) {
    if (state.screen === 'welcome') return;
    if (screen.dataset.screen === 'reviewer') openReviewer();
    else if (screen.dataset.screen === 'quiz') openQuiz();
    else go(screen.dataset.screen);
    return;
  }
  const topicChoice = event.target.closest('[data-topic-choice]');
  if (topicChoice) { state.topic = Number(topicChoice.dataset.topicChoice); state.flashcardIndex = 0; state.flashcardRevealed = false; render(); return; }
  const questionButton = event.target.closest('[data-question]');
  if (questionButton) { state.question = Number(questionButton.dataset.question) - 1; render(); return; }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  switch (action.dataset.action) {
    case 'go-auth': state.screen = 'auth'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'go-home': state.screen = 'welcome'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'toggle-theme': {
      const dark = document.documentElement.dataset.theme !== 'dark';
      if (dark) document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
      render();
      break;
    }
    case 'choose-profile-photo': root.querySelector('#profile-photo-input')?.click(); break;
    case 'social-login': {
      showLoadingScreen(`Connecting to ${action.dataset.provider}…`);
      window.location.assign(`/auth/${action.dataset.provider.toLowerCase()}`);
      break;
    }
    case 'browse': root.querySelector('#file-picker')?.click(); break;
    case 'clear-files': state.pendingFiles = []; render(); break;
    case 'upload': uploadPending(); break;
    case 'delete-material': deleteMaterial(action.dataset.id); break;
    case 'open-reviewer': openReviewer(action.dataset.id); break;
    case 'open-quiz': openQuiz(action.dataset.id); break;
    case 'retry': processMaterial(action.dataset.id); break;
    case 'process-material': processMaterial(action.dataset.id); break;
    case 'regenerate': processMaterial(activeMaterial()?.id); break;
    case 'review-mode': state.reviewerMode = action.dataset.mode; state.flashcardRevealed = false; render(); break;
    case 'flip-flashcard': state.flashcardRevealed = !state.flashcardRevealed; render(); break;
    case 'previous-card': if (state.flashcardIndex > 0) { state.flashcardIndex--; state.flashcardRevealed = false; render(); } break;
    case 'next-card': { const topic = state.studyGuide?.topics?.[state.topic - 1]; const count = topic ? topic.flashcards.length : (topicContent[state.topic] || topicContent[1]).points.length; state.flashcardIndex = (state.flashcardIndex + 1) % Math.max(1, count); state.flashcardRevealed = false; render(); break; }
    case 'flashcard-review': { const topic = state.studyGuide?.topics?.[state.topic - 1]; const count = topic ? topic.flashcards.length : (topicContent[state.topic] || topicContent[1]).points.length; state.flashcardIndex = (state.flashcardIndex + 1) % Math.max(1, count); state.flashcardRevealed = false; render(); break; }
    case 'flashcard-known': { const topic = state.studyGuide?.topics?.[state.topic - 1]; const count = topic ? topic.flashcards.length : (topicContent[state.topic] || topicContent[1]).points.length; const key = `${activeMaterial()?.id || 'none'}:${state.topic}`; const known = state.flashcardKnown[key] || []; if (!known.includes(state.flashcardIndex)) known.push(state.flashcardIndex); state.flashcardKnown[key] = known; state.flashcardIndex = (state.flashcardIndex + 1) % Math.max(1, count); state.flashcardRevealed = false; render(); break; }
    case 'previous': if (state.question > 0) { state.question--; render(); } break;
    case 'next': if (state.question < activeQuestions().length - 1) { state.question++; render(); } else submitQuiz(); break;
    case 'submit-quiz': submitQuiz(); break;
    case 'toggle-answers': state.showAllAnswers = !state.showAllAnswers; render(); break;
    case 'retake': openQuiz(); break;
    case 'study-topic': state.topic = Number(action.dataset.topic) || 1; state.reviewerMode = 'reviewer'; openReviewer(action.dataset.id); break;
    case 'update-roadmap': updateRoadmap(); break;
    case 'logout': logoutAccount(); break;
  }
});

root.addEventListener('change', event => {
  if (event.target.id === 'profile-photo-input') {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { notify('Choose an image smaller than 4 MB.'); event.target.value = ''; return; }
    if (state.profilePicturePreview) URL.revokeObjectURL(state.profilePicturePreview);
    pendingProfilePicture = file;
    state.profilePicturePreview = URL.createObjectURL(file);
    event.target.value = '';
    render();
    notify('Photo preview ready. Click Save profile to apply it.');
    return;
  }
  if (event.target.id === 'file-picker') { addFiles(event.target.files); return; }
  if (event.target.id === 'material-select') { openReviewer(event.target.value); return; }
  if (event.target.id === 'gap-material-filter' || event.target.id === 'roadmap-material-filter') { state.gapMaterial = event.target.value; render(); return; }
  if (event.target.matches('[data-roadmap-status]')) { persistRoadmapStatus(event.target.dataset.key, event.target.value); return; }
  if (event.target.name === 'answer') { state.answers[state.question] = Number(event.target.value); render(); }
});

root.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'login-form') {
    const email = root.querySelector('#login-email').value.trim();
    const password = root.querySelector('#login-password').value;
    showLoadingScreen('Signing you in…');
    apiRequest('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      .then(({ user }) => enterAccount(user))
      .catch(error => { state.screen = 'auth'; render(); notify(error.message); });
  }
  if (event.target.id === 'register-form') {
    const name = root.querySelector('#register-name').value.trim();
    const email = root.querySelector('#register-email').value.trim();
    const password = root.querySelector('#register-password').value;
    const confirmPassword = root.querySelector('#register-confirm').value;
    if (password !== confirmPassword) { notify('Passwords do not match.'); return; }
    if (!root.querySelector('#privacy-consent').checked) { notify('Please review and accept the privacy notice.'); return; }
    showLoadingScreen('Creating your account…');
    apiRequest('/api/register', { method: 'POST', body: JSON.stringify({ fullName: name, email, password, privacyConsent: true }) })
      .then(({ user }) => enterAccount(user))
      .catch(error => { state.screen = 'auth'; render(); notify(error.message); });
  }
});

root.addEventListener('submit', event => {
  if (event.target.id !== 'profile-form') return;
  event.preventDefault();
  const fullName = root.querySelector('#profile-name').value.trim();
  const form = new FormData();
  form.append('fullName', fullName);
  if (pendingProfilePicture) form.append('profilePicture', pendingProfilePicture);
  apiRequest('/api/profile', { method: 'PATCH', body: form })
    .then(({ user }) => {
      state.name = user.fullName;
      data.name = state.name;
      if (user.profilePicture !== undefined) { state.profilePicture = user.profilePicture; data.profilePicture = user.profilePicture; }
      if (state.profilePicturePreview) URL.revokeObjectURL(state.profilePicturePreview);
      delete state.profilePicturePreview;
      pendingProfilePicture = null;
      save(); render(); notify('Profile saved.');
    })
    .catch(error => notify(error.message));
});

root.addEventListener('dragover', event => { if (event.target.closest('#dropzone')) { event.preventDefault(); state.dragOver = true; root.querySelector('#dropzone')?.classList.add('drag'); } });
root.addEventListener('dragleave', event => { if (event.target.closest('#dropzone')) { state.dragOver = false; root.querySelector('#dropzone')?.classList.remove('drag'); } });
root.addEventListener('drop', event => { if (event.target.closest('#dropzone')) { event.preventDefault(); state.dragOver = false; addFiles(event.dataTransfer.files); } });
let roadmapResizeTimer;
window.addEventListener('resize', () => { clearTimeout(roadmapResizeTimer); roadmapResizeTimer = setTimeout(() => { if (state.screen === 'roadmap') render(); }, 120); });
setInterval(() => { const timer = document.querySelector('#timer'); if (timer && state.screen === 'quiz') timer.textContent = timerText(); }, 1000);
