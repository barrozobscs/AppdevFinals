/* PacePath front-end. Real authentication, file processing, and AI generation require a backend. */
const STORE_KEY = 'pacePathProjectUI_v2';

const data = loadData();
const state = {
  screen: 'welcome',
  name: data.name || 'Lance',
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
};

const root = document.querySelector('#app');
const toastEl = document.querySelector('#toast');

const questions = [
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
  return `<header class="topbar"><a class="brand" href="#materials" data-screen="materials"><span class="brand-mark">P</span><span>PacePath<small>SELF-PACED STUDY HUB</small></span></a><nav class="nav" aria-label="Main navigation">${navButton('materials', 'Materials')}${navButton('reviewer', 'Reviewer')}${navButton('quiz', 'Quiz')}${navButton('gaps', 'Gap Analysis')}${navButton('roadmap', 'Roadmap')}</nav><div class="account"><span class="avatar">${esc(initials(state.name))}</span><span>${esc(state.name)}</span><button class="logout" data-action="logout">Log out</button></div></header>`;
}
function shell(content) { return `${header()}<main class="page">${content}<div class="footer-note">PacePath · Study from your own materials</div></main>`; }
function pageTitle(title, sub, action = '') { return `<div class="page-title"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`; }
function btn(label, action, cls = '') { return `<button type="button" class="button ${cls}" data-action="${action}">${label}</button>`; }
function emptyState(title, text, actionLabel = 'Go to materials', action = 'materials') {
  return `<article class="card empty-state"><div class="empty-mark">＋</div><h2>${title}</h2><p>${text}</p><button class="button" data-screen="${action}">${actionLabel}</button></article>`;
}

function welcome() {
  return `<div class="welcome"><header class="welcome-top"><a class="brand" href="#"><span class="brand-mark">P</span><span>PacePath<small>SELF-PACED STUDY HUB</small></span></a></header><main class="welcome-main"><section class="welcome-intro"><span class="eyebrow">Your materials, your learning plan</span><h1>Study smarter from your own materials</h1><p>Upload your notes, practice with quizzes, see which topics need attention, and follow a personalized learning roadmap.</p></section><section class="flow" aria-label="How it works"><div class="flow-step"><b>01</b>Upload documents</div><div class="flow-step"><b>02</b>Take web quiz</div><div class="flow-step"><b>03</b>View skill gaps</div><div class="flow-step"><b>04</b>Follow roadmap</div></section><div class="auth-grid"><form class="card auth-card" id="login-form"><h2>Log in</h2><div class="field"><label for="login-email">Email</label><input id="login-email" type="email" placeholder="you@school.edu" required></div><div class="field"><label for="login-password">Password</label><input id="login-password" type="password" placeholder="Password" required></div><button class="button" type="submit">Log in</button><div class="auth-separator"><span>or sign in with</span></div><div class="social-buttons"><button type="button" class="social-button google" data-action="social-login" data-provider="Google" title="Sign in with your Gmail account"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 12.25c0-.72-.06-1.42-.18-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.27Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.04H3.28v2.53A9.75 9.75 0 0 0 12 21.75Z"/><path fill="#FBBC05" d="M6.53 13.83a5.86 5.86 0 0 1 0-3.66V7.64H3.28a9.76 9.76 0 0 0 0 8.72l3.25-2.53Z"/><path fill="#EA4335" d="M12 6.13c1.43 0 2.71.49 3.72 1.47l2.79-2.79C16.83 3.2 14.62 2.25 12 2.25a9.75 9.75 0 0 0-8.72 5.39l3.25 2.53C7.3 7.85 9.46 6.13 12 6.13Z"/></svg><span>Google / Gmail</span></button><button type="button" class="social-button facebook" data-action="social-login" data-provider="Facebook" title="Sign in with Facebook"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v1.9H7v3.1h2.8v8h3.7Z"/></svg><span>Facebook</span></button></div></form><form class="card auth-card" id="register-form"><h2>Create an account</h2><div class="field"><label for="register-name">Full name</label><input id="register-name" type="text" placeholder="Full name" autocomplete="name" required></div><div class="field"><label for="register-email">Email</label><input id="register-email" type="email" placeholder="you@school.edu" autocomplete="email" required></div><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label for="register-password">Password</label><input id="register-password" type="password" placeholder="Password" minlength="4" required></div><div class="field"><label for="register-confirm">Confirm password</label><input id="register-confirm" type="password" placeholder="Confirm password" minlength="4" required></div></div><label class="consent-row"><input id="privacy-consent" type="checkbox" required><span>I consent to PacePath using my account details, study materials, quiz answers, and progress to provide its learning features.</span></label><button class="button secondary" type="submit">Create account</button></form></div></main></div>`;
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
  return shell(`<input id="file-picker" type="file" accept=".pdf,.docx,.pptx" multiple hidden>${pageTitle('Study Materials','Upload lecture notes, slides, or readings. View each file’s processing status and open its study tools.',btn('＋ Browse files','browse'))}<div class="grid upload-grid"><div class="dropzone ${state.dragOver?'drag':''}" id="dropzone"><div class="upload-icon">⇧</div><strong>Drag &amp; drop files here</strong><p>PDF, DOCX, or PPTX</p><button class="button secondary small" data-action="browse">Browse files</button></div><article class="card"><div class="eyebrow">Selected file</div>${selectedMarkup}<div class="check-list"><span>Extract text from the document</span><span>Identify the topics it covers</span><span>Generate the reviewer and quiz questions</span></div><button class="button" data-action="upload" ${selected.length?'':'disabled'}>Upload &amp; generate</button></article></div><article class="card"><div class="card-title"><h2>My materials</h2><span class="small-text">${data.materials.length} file${data.materials.length===1?'':'s'}</span></div><div class="table-wrap"><table class="table"><thead><tr><th>File name</th><th>Type</th><th>Uploaded</th><th>Status</th><th>Topics</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div></article>`);
}

function reviewer() {
  const material = activeMaterial();
  if (!material) return shell(`${pageTitle('Reviewer','Review topics from your uploaded materials.')}${emptyState('No ready materials yet','Upload a file and wait for it to be ready before opening a reviewer.')}`);
  const count = Math.max(5, material.topics || 0);
  const selected = topicContent[state.topic] || topicContent[1];
  const topicOptions = Array.from({ length: count }, (_, i) => `<button type="button" class="topic-choice ${state.topic === i + 1 ? 'active' : ''}" data-topic-choice="${i + 1}">Topic ${i + 1}</button>`).join('');
  const topicPills = Array.from({ length: count }, (_, i) => `<button type="button" class="topic-pill ${state.topic === i + 1 ? 'active' : ''}" data-topic-choice="${i + 1}">Topic ${i + 1}</button>`).join('');
  const modeContent = state.reviewerMode === 'flashcards' ? flashcards(selected) : `<section class="review-section"><span class="eyebrow">Topic ${state.topic}</span><h3>${esc(selected.title)}</h3><p>${esc(selected.description)}</p><span class="eyebrow">Key points</span><ul class="keypoints">${selected.points.map(point => `<li>${esc(point)}</li>`).join('')}</ul></section><section class="review-section"><span class="eyebrow">Study prompt</span><p>Explain the main idea in your own words, then test your understanding with a practice quiz.</p></section>`;
  return shell(`${pageTitle('Reviewer',`Organized by topic from ${esc(material.name)}.`,btn('Regenerate reviewer','regenerate','secondary'))}<div class="grid review-layout"><aside class="card topic-sidebar"><div class="field"><label for="material-select">Material</label><select class="select" id="material-select">${readyMaterials().map(file => `<option value="${esc(file.id)}" ${file.id === material.id ? 'selected' : ''}>${esc(file.name)}</option>`).join('')}</select></div><div class="eyebrow">Topics in this material (${count})</div><div class="topic-list">${topicOptions}</div><button class="button" data-action="open-quiz">Take quiz on this material</button></aside><article class="card"><div class="breadcrumbs">Materials / <b>${esc(material.name)}</b></div><div class="review-header"><div><h2>Reviewer</h2><span class="small-text">From ${esc(material.name)}</span></div><span class="badge">Ready</span></div><div class="topic-pills">${topicPills}</div><div class="review-tabs"><button class="${state.reviewerMode==='reviewer'?'active':''}" data-action="review-mode" data-mode="reviewer">Reviewer</button><button class="${state.reviewerMode==='flashcards'?'active':''}" data-action="review-mode" data-mode="flashcards">Flashcards</button></div>${modeContent}<div class="button-row">${btn('Take practice quiz','open-quiz')}<button class="button secondary" data-screen="materials">Back to materials</button></div></article></div>`);
}

function flashcards(topic) {
  const point = topic.points[state.flashcardIndex % topic.points.length];
  return `<section class="flashcard-area"><div class="flashcard-count">FLASHCARD ${state.flashcardIndex + 1} OF ${topic.points.length} · TOPIC ${state.topic}</div><button type="button" class="flashcard ${state.flashcardRevealed?'revealed':''}" data-action="flip-flashcard"><span class="flashcard-face-label">${state.flashcardRevealed?'KEY POINT':'TOPIC'}</span><strong>${state.flashcardRevealed?esc(point):esc(topic.title)}</strong><small>${state.flashcardRevealed?'Click to view the topic':'Click to reveal a key point'}</small></button><div class="flashcard-controls"><button class="button secondary" data-action="previous-card" ${state.flashcardIndex===0?'disabled':''}>← Previous</button><button class="button" data-action="next-card">Next →</button></div></section>`;
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
  return shell(`${pageTitle('Quiz',`${esc(material.name)} · 10 questions · 20 points`)}<article class="card quiz-summary"><div class="quiz-meta"><div><strong class="quiz-name">Practice quiz</strong><div class="small-text">${esc(material.name)} · 10 questions · 20 points</div></div><span class="badge">Elapsed <span id="timer">${timerText()}</span></span></div><div class="quiz-meta quiz-progress-label"><span class="small-text">Question ${state.question + 1} of ${questions.length}</span><span class="small-text">${Math.round((state.question + 1) / questions.length * 100)}%</span></div><div class="quiz-progress"><i style="width:${(state.question + 1) / questions.length * 100}%"></i></div></article><div class="grid quiz-layout"><article class="card question-card"><div class="question-label"><span>Multiple choice</span><span>2 points</span><span>Topic ${q.topic}</span></div><h2 class="question-text">${esc(q.text)}</h2><div class="answers">${q.options.map((option, i) => `<label class="answer-option ${selected === i ? 'selected' : ''}"><input type="radio" name="answer" value="${i}" ${selected === i ? 'checked' : ''}><span>${String.fromCharCode(65 + i)}. ${esc(option)}</span></label>`).join('')}</div><div class="question-controls"><button class="button secondary" data-action="previous" ${state.question === 0 ? 'disabled' : ''}>← Previous</button><button class="button" data-action="next">${state.question === questions.length - 1 ? 'Review answers' : 'Next →'}</button></div></article><aside class="card"><div class="card-title"><h2>Questions</h2><span class="small-text">${answered} answered</span></div><div class="question-grid">${questions.map((_, i) => `<button class="question-number ${i === state.question ? 'current' : ''} ${state.answers[i] !== undefined ? 'answered' : ''}" data-question="${i + 1}">${i + 1}</button>`).join('')}</div><div class="legend"><span><i class="answered"></i> Answered</span><span><i class="current"></i> Current</span><span><i class="empty"></i> Not answered</span></div><hr class="rule"><button class="button" style="width:100%" data-action="submit-quiz">Submit quiz</button></aside></div>`);
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
  const pages = { materials, reviewer, quiz, results, gaps: gapScreen, roadmap };
  root.innerHTML = (pages[state.screen] || materials)();
}
function go(screen) {
  if (screen === 'quiz' && state.screen !== 'quiz') { state.startedAt = Date.now(); state.question = 0; state.answers = {}; state.showAllAnswers = false; }
  state.screen = screen;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function login(name) { state.name = name || 'Lance'; data.name = state.name; save(); go('materials'); notify(`Welcome, ${state.name}`); }
function setMaterial(id) { if (id && data.materials.some(material => material.id === id)) state.selectedMaterial = id; }
function openQuiz(id) {
  setMaterial(id);
  if (!activeMaterial()) { go('quiz'); return; }
  state.startedAt = Date.now(); state.question = 0; state.answers = {}; state.showAllAnswers = false; go('quiz');
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
function submitQuiz() {
  const material = activeMaterial();
  if (!material) { notify('Upload a ready material before taking a quiz.'); return; }
  const blank = questions.length - Object.keys(state.answers).length;
  if (blank && !confirm(`You have ${blank} unanswered question${blank === 1 ? '' : 's'}. Submit anyway?`)) return;
  const answers = resultData();
  const score = answers.reduce((sum, answer) => sum + (answer.correct ? 2 : 0), 0);
  const percent = Math.round(score / 20 * 100);
  const duration = timerText();
  const topicScores = topicResult();
  updateTopicMetrics(topicScores, material);
  data.attempts.push({ id: `a${Date.now()}`, date: today(), materialId: material.id, materialName: material.name, score, total: 20, percent, duration, answers: state.answers });
  save();
  go('results');
  notify('Quiz submitted. Your topic analysis is updated.');
}
function addFiles(files) {
  const allowed = ['pdf', 'docx', 'pptx'];
  const selected = [...files].filter(file => allowed.includes(file.name.split('.').pop().toLowerCase()));
  if (selected.length !== files.length) notify('Only PDF, DOCX, and PPTX files are supported.');
  state.pendingFiles = selected;
  render();
}
function uploadPending() {
  if (!state.pendingFiles.length) { notify('Choose a file first.'); return; }
  const pending = state.pendingFiles.map((file, index) => ({ id: `u${Date.now()}${index}`, name: file.name, type: file.name.split('.').pop().toUpperCase(), size: formatBytes(file.size), uploaded: today(), status: 'Processing', topics: 0 }));
  data.materials.unshift(...pending);
  state.selectedMaterial = pending[0].id;
  state.pendingFiles = [];
  save();
  state.screen = 'materials';
  render();
  notify('Files added to your materials.');
  setTimeout(() => {
    pending.forEach(file => { const record = data.materials.find(item => item.id === file.id); if (record) { record.status = 'Ready'; record.topics = 5; } });
    save();
    if (state.screen === 'materials') render();
    notify('Your files are ready. Open the reviewer to view the topics.');
  }, 1200);
}
function updateRoadmap() { save(); go('roadmap'); notify('Roadmap refreshed from your topic results.'); }

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
    case 'social-login': notify(`${action.dataset.provider} sign-in is not connected yet.`); break;
    case 'browse': root.querySelector('#file-picker')?.click(); break;
    case 'clear-files': state.pendingFiles = []; render(); break;
    case 'upload': uploadPending(); break;
    case 'open-reviewer': setMaterial(action.dataset.id); go('reviewer'); break;
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
    case 'next-card': { const topic = topicContent[state.topic] || topicContent[1]; state.flashcardIndex = (state.flashcardIndex + 1) % topic.points.length; state.flashcardRevealed = false; render(); break; }
    case 'previous': if (state.question > 0) { state.question--; render(); } break;
    case 'next': if (state.question < questions.length - 1) { state.question++; render(); } else notify('Review your answers or submit the quiz.'); break;
    case 'submit-quiz': submitQuiz(); break;
    case 'toggle-answers': state.showAllAnswers = !state.showAllAnswers; render(); break;
    case 'retake': openQuiz(); break;
    case 'study-topic': setMaterial(action.dataset.id); state.topic = Number(action.dataset.topic) || 1; state.reviewerMode = 'reviewer'; go('reviewer'); break;
    case 'update-roadmap': updateRoadmap(); break;
    case 'logout': state.screen = 'welcome'; render(); break;
  }
});

root.addEventListener('change', event => {
  if (event.target.id === 'file-picker') { addFiles(event.target.files); return; }
  if (event.target.id === 'material-select') { setMaterial(event.target.value); render(); return; }
  if (event.target.id === 'gap-material-filter' || event.target.id === 'roadmap-material-filter') { state.gapMaterial = event.target.value; render(); return; }
  if (event.target.matches('[data-roadmap-status]')) { data.roadmapStatus[event.target.dataset.key] = event.target.value; save(); render(); return; }
  if (event.target.name === 'answer') { state.answers[state.question] = Number(event.target.value); render(); }
});

root.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'login-form') {
    const email = root.querySelector('#login-email').value;
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    login(name || 'Student');
  }
  if (event.target.id === 'register-form') {
    const name = root.querySelector('#register-name').value.trim();
    const password = root.querySelector('#register-password').value;
    const confirmPassword = root.querySelector('#register-confirm').value;
    if (password !== confirmPassword) { notify('Passwords do not match.'); return; }
    if (!root.querySelector('#privacy-consent').checked) { notify('Please review and accept the privacy notice.'); return; }
    login(name);
  }
});

root.addEventListener('dragover', event => { if (event.target.closest('#dropzone')) { event.preventDefault(); state.dragOver = true; root.querySelector('#dropzone')?.classList.add('drag'); } });
root.addEventListener('dragleave', event => { if (event.target.closest('#dropzone')) { state.dragOver = false; root.querySelector('#dropzone')?.classList.remove('drag'); } });
root.addEventListener('drop', event => { if (event.target.closest('#dropzone')) { event.preventDefault(); state.dragOver = false; addFiles(event.dataTransfer.files); } });
setInterval(() => { const timer = document.querySelector('#timer'); if (timer && state.screen === 'quiz') timer.textContent = timerText(); }, 1000);
render();
