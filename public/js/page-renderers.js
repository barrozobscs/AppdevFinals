function navButton(id, label) { return `<button type="button" class="${state.screen === id ? 'active' : ''}" data-screen="${id}">${label}</button>`; }
function themeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<button type="button" class="theme-toggle" data-action="toggle-theme" aria-label="Switch to ${dark ? 'light' : 'dark'} mode" aria-pressed="${dark}" title="Switch to ${dark ? 'light' : 'dark'} mode"><span aria-hidden="true">${dark ? '☀' : '☾'}</span><b>${dark ? 'Light mode' : 'Dark mode'}</b></button>`;
}
function avatarMarkup(extraClass = 'avatar') {
  const size = extraClass.includes('profile-avatar') ? 58 : 32;
  const boxStyle = `width:${size}px;height:${size}px;min-width:${size}px;min-height:${size}px;flex:none;overflow:hidden;display:grid;place-items:center;border-radius:50%`;
  const imageSource = state.profilePicturePreview || state.profilePicture;
  const image = imageSource
    ? `<img src="${esc(imageSource)}" alt="Profile photo" style="width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;display:block;border-radius:inherit">`
    : esc(initials(state.name));
  return `<span class="${extraClass}" style="${boxStyle}">${image}</span>`;
}
function header() {
  return renderPageTemplate('header', [
    navButton('materials', 'Materials'), navButton('reviewer', 'Reviewer'), navButton('quiz', 'Quiz'),
    navButton('gaps', 'Gap Analysis'), navButton('roadmap', 'Roadmap'), themeButton(),
    avatarMarkup(), esc(state.name),
  ]);
}
function shell(content) {
  const progress = state.aiProgress
    ? `<section class="ai-progress ${state.aiProgress.phase === 'generating' ? 'generating' : ''} ${state.aiProgress.phase === 'error' ? 'error' : ''}" role="status" aria-live="polite"><div class="ai-progress-heading"><strong>${esc(state.aiProgress.message)}</strong><span>${Math.round(state.aiProgress.percent)}%</span></div><div class="ai-progress-track" role="progressbar" aria-label="AI study guide progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.aiProgress.percent)}"><i style="width:${Math.max(0, Math.min(100, state.aiProgress.percent))}%"></i></div><small>${state.aiProgress.phase === 'generating' ? 'The percentage marks completed workflow stages; the AI service does not report its internal completion percentage.' : 'Progress updates as each processing stage completes.'}</small></section>`
    : '';
  return renderPageTemplate('shell', [header(), progress, content]);
}
function pageTitle(title, sub, action = '', className = '') {
  return renderPageTemplate('page-title', [title, sub, action, className]);
}
function btn(label, action, cls = '') { return `<button type="button" class="button ${cls}" data-action="${action}">${label}</button>`; }
function emptyState(title, text, actionLabel = 'Go to materials', action = 'materials') {
  return `<article class="card empty-state"><div class="empty-mark">＋</div><h2>${title}</h2><p>${text}</p><button class="button" data-screen="${action}">${actionLabel}</button></article>`;
}

function authPage() {
  return renderPageTemplate('auth', [themeButton()]);
}


function welcome() {
  return renderPageTemplate('landing', [themeButton()]);
}

function fileRow(material) {
  const statusClass = material.status === 'Ready' ? '' : material.status.toLowerCase();
  let actions = material.status === 'Ready'
    ? `<button class="link-button" data-action="open-reviewer" data-id="${esc(material.id)}">View reviewer</button><button class="link-button" data-action="open-quiz" data-id="${esc(material.id)}">Take quiz</button>`
    : material.status === 'Failed'
      ? `<button class="button small secondary" data-action="retry" data-id="${esc(material.id)}">Retry</button>`
      : `<button class="button small secondary" data-action="process-material" data-id="${esc(material.id)}">Extract text</button>`;
  actions += `<button class="link-button delete-material" data-action="delete-material" data-id="${esc(material.id)}">Delete</button>`;
  return `<tr><td class="filename">${esc(material.name)}</td><td>${esc(material.type)}</td><td>${dateLabel(material.uploaded)}</td><td><span class="badge ${statusClass}">${esc(material.status)}</span></td><td>${Number(material.topics) || 0}</td><td><div class="material-actions">${actions}</div></td></tr>`;
}

function materials() {
  const selected = state.pendingFiles;
  const selectedMarkup = selected.length
    ? `<div class="file-summary"><div class="file-icon">${esc((selected[0].name.split('.').pop() || 'FILE').toUpperCase())}</div><div class="file-summary-copy"><strong>${esc(selected[0].name)}${selected.length > 1 ? ` + ${selected.length - 1} more` : ''}</strong><span class="small-text">${selected.length} file${selected.length === 1 ? '' : 's'} selected · ${formatBytes(selected.reduce((sum, file) => sum + file.size, 0))}</span></div><button class="link-button" data-action="clear-files">Remove</button></div>`
    : `<div class="file-summary empty-file"><div class="file-icon">FILE</div><div><strong>No file selected</strong><span class="small-text">Choose a file to prepare it for upload</span></div></div>`;
  const rows = data.materials.length
    ? data.materials.map(fileRow).join('')
    : `<tr><td colspan="6"><div class="table-empty"><strong>No materials uploaded yet</strong><span>Choose a PDF, DOCX, PPTX, TXT, JPG, or PNG to get started.</span></div></td></tr>`;
  return shell(renderPageTemplate('materials', [pageTitle('Study Materials','Upload lecture notes, slides, or readings. View each file’s processing status and open its study tools.',btn('＋ Browse files','browse')),state.dragOver?'drag':'',selectedMarkup,selected.length?'':'disabled',data.materials.length,data.materials.length===1?'':'s',rows]));
}

function profilePage() {
  return shell(renderPageTemplate('profile', [pageTitle('My profile', 'Manage your account details and profile photo.'),avatarMarkup('avatar profile-avatar'),state.email ? 'Your account email is shown below. To change it, email verification will be needed.' : 'Facebook sign-in is linked to your account. Facebook did not share an email address.',esc(state.name),esc(state.email),state.email ? '' : 'placeholder="Not provided by Facebook"',state.email ? 'Email changes are disabled until verification is available.' : 'Email is not required for Facebook sign-in.']));
}

function reviewer() {
  const material = activeMaterial();
  if (!material) return shell(renderPageTemplate('reviewer', [pageTitle('Reviewer','Review topics from your uploaded materials.'),emptyState('No ready materials yet','Upload a file and wait for it to be ready before opening a reviewer.')], 'empty'));
  if (state.studyGuide) {
    const topics = state.studyGuide.topics || [];
    const topicIndex = Math.min(Math.max(state.topic - 1, 0), topics.length - 1);
    const selected = topics[topicIndex] || { title: 'Study guide', summary: '', key_points: [], flashcards: [] };
    const topicButtons = topics.map((topic, index) => `<button type="button" class="topic-choice ${topicIndex === index ? 'active' : ''}" data-topic-choice="${index + 1}"><span class="slide-nav-number">${String(index + 1).padStart(2, "0")}</span><span class="slide-nav-title">${esc(topic.title)}</span><span class="slide-nav-arrow" aria-hidden="true">›</span></button>`).join('');
    const cards = selected.flashcards || [];
    const cardKey = `${material.id}:${topicIndex + 1}`;
    const known = state.flashcardKnown[cardKey] || [];
    const cardIndex = cards.length ? state.flashcardIndex % cards.length : 0;
    const card = cards[cardIndex];
    const guideContent = state.reviewerMode === 'flashcards'
      ? card
        ? `<section class="flashcard-area"><div class="flashcard-count">FLASHCARD ${cardIndex + 1} OF ${cards.length}</div><div class="flashcard-progress-row"><span>TOPIC ${topicIndex + 1} · CARD ${cardIndex + 1} OF ${cards.length}</span><span>${known.length} learned</span></div><div class="flashcard-progress"><i style="width:${Math.round((cardIndex + 1) / cards.length * 100)}%"></i></div><button type="button" class="flashcard ${state.flashcardRevealed ? 'revealed' : ''}" data-action="flip-flashcard" aria-label="${state.flashcardRevealed ? 'Show prompt' : 'Reveal answer'}"><span class="flashcard-inner"><span class="flashcard-face flashcard-front"><span class="flashcard-face-label">PROMPT</span><strong>${esc(card.front)}</strong><small>Think of the key idea, then flip the card</small></span><span class="flashcard-face flashcard-back"><span class="flashcard-face-label">KEY POINT</span><strong>${esc(card.back)}</strong><small>Click to flip back</small></span></span></button><div class="flashcard-controls"><button class="button secondary" data-action="previous-card" ${cardIndex === 0 ? 'disabled' : ''}>← Previous</button><button class="button secondary" data-action="flip-flashcard">${state.flashcardRevealed ? 'Show prompt' : 'Reveal answer'}</button><button class="button" data-action="next-card">Next →</button></div>${state.flashcardRevealed ? `<div class="flashcard-rating"><span>How well did you know it?</span><button class="button secondary" data-action="flashcard-review">Still learning</button><button class="button" data-action="flashcard-known">Got it</button></div>` : ''}</section>`
        : emptyState('No flashcards yet', 'This AI generated guide did not include flashcards for this topic.')
      : `<section class="review-section"><span class="eyebrow">Topic ${topicIndex + 1}</span><h3>${esc(selected.title)}</h3><p>${esc(selected.summary)}</p><span class="eyebrow">Key points</span><ul class="keypoints">${(selected.key_points || []).map(point => `<li>${esc(point)}</li>`).join('')}</ul></section>`;
    return shell(renderPageTemplate('reviewer', [pageTitle('AI Study Guide',`Generated from ${esc(material.name)}.`,btn('Regenerate guide','regenerate','secondary')),readyMaterials().map(file => `<option value="${esc(file.id)}" ${file.id === material.id ? 'selected' : ''}>${esc(file.name)}</option>`).join(''),topics.length,topicButtons,esc(material.name),esc(state.studyGuide.title || 'Study guide'),esc(state.studyGuide.summary || ''),state.reviewerMode === 'reviewer' ? 'active' : '',state.reviewerMode === 'flashcards' ? 'active' : '',guideContent], 'guide'));
  }
  if (state.reviewerText) {
    return shell(renderPageTemplate('reviewer', [pageTitle('Reviewer',`Extracted text from ${esc(material.name)}.`),esc(material.name),esc(state.reviewerText)], 'extracted-text'));
  }
  const count = Math.max(5, material.topics || 0);
  const selected = topicContent[state.topic] || topicContent[1];
  const topicOptions = Array.from({ length: count }, (_, i) => `<button type="button" class="topic-choice ${state.topic === i + 1 ? 'active' : ''}" data-topic-choice="${i + 1}">Topic ${i + 1}</button>`).join('');
  const modeContent = state.reviewerMode === 'flashcards' ? flashcards(selected) : `<section class="review-section"><span class="eyebrow">Topic ${state.topic}</span><h3>${esc(selected.title)}</h3><p>${esc(selected.description)}</p><span class="eyebrow">Key points</span><ul class="keypoints">${selected.points.map(point => `<li>${esc(point)}</li>`).join('')}</ul></section><section class="review-section"><span class="eyebrow">Study prompt</span><p>Explain the main idea in your own words, then test your understanding with a practice quiz.</p></section>`;
  return shell(renderPageTemplate('reviewer', [pageTitle('Reviewer',`Organized by topic from ${esc(material.name)}.`,btn('Regenerate reviewer','regenerate','secondary')),readyMaterials().map(file => `<option value="${esc(file.id)}" ${file.id === material.id ? 'selected' : ''}>${esc(file.name)}</option>`).join(''),count,topicOptions,esc(material.name),esc(material.name),state.reviewerMode==='reviewer'?'active':'',state.reviewerMode==='flashcards'?'active':'',modeContent,btn('Take practice quiz','open-quiz')], 'topics'));
}

function flashcards(topic) {
  const point = topic.points[state.flashcardIndex % topic.points.length];
  const materialId = activeMaterial()?.id || 'none';
  const key = `${materialId}:${state.topic}`;
  const known = state.flashcardKnown[key] || [];
  const progress = Math.round((state.flashcardIndex + 1) / topic.points.length * 100);
  return `<section class="flashcard-area"><div class="flashcard-progress-row"><span>TOPIC ${state.topic} · CARD ${state.flashcardIndex + 1} OF ${topic.points.length}</span><span>${known.length} learned</span></div><div class="flashcard-progress"><i style="width:${progress}%"></i></div><button type="button" class="flashcard ${state.flashcardRevealed?'revealed':''}" data-action="flip-flashcard"><span class="flashcard-inner"><span class="flashcard-face flashcard-front"><span class="flashcard-face-label">PROMPT</span><strong>${esc(topic.title)}</strong><small>Think of the key idea, then flip the card</small></span><span class="flashcard-face flashcard-back"><span class="flashcard-face-label">KEY POINT</span><strong>${esc(point)}</strong><small>Click to flip back</small></span></span></button><div class="flashcard-controls"><button class="button secondary" data-action="previous-card" ${state.flashcardIndex===0?'disabled':''}>← Previous</button><button class="button secondary" data-action="flip-flashcard">${state.flashcardRevealed?'Show prompt':'Reveal answer'}</button><button class="button" data-action="next-card">Next →</button></div>${state.flashcardRevealed?`<div class="flashcard-rating"><span>How well did you know it?</span><button class="button secondary" data-action="flashcard-review">Still learning</button><button class="button" data-action="flashcard-known">Got it</button></div>`:''}</section>`;
}

function quiz() {
  const material = activeMaterial();
  if (!material) return shell(renderPageTemplate('quiz', [pageTitle('Quiz','Practice with questions based on your study material.'),emptyState('No ready materials yet','Upload a study file and open its quiz once it is ready.')], 'empty'));
  const questionSet = activeQuestions();
  const q = questionSet[state.question];
  if (!q) return shell(renderPageTemplate('quiz', [pageTitle('Quiz',esc(material.name))], 'unavailable'));
  const totalPoints = questionSet.reduce((sum, item) => sum + (item.points || 2), 0);
  const answered = Object.keys(state.answers).length;
  const selected = state.answers[state.question];
  return shell(renderPageTemplate('quiz', [pageTitle('Quiz',`${esc(material.name)} · ${questionSet.length} questions · ${totalPoints} points`),timerText(),state.question + 1,questionSet.length,Math.round((state.question + 1) / questionSet.length * 100),(state.question + 1) / questionSet.length * 100,q.points || 2,esc(q.topicName || `Topic ${q.topic}`),esc(q.text),q.options.map((option, i) => `<label class="answer-option ${selected === i ? 'selected' : ''}"><input type="radio" name="answer" value="${i}" ${selected === i ? 'checked' : ''}><span>${String.fromCharCode(65 + i)}. ${esc(option)}</span></label>`).join(''),state.question === 0 ? 'disabled' : '',state.question === questionSet.length - 1 ? 'Submit quiz' : 'Next →',answered,questionSet.map((_, i) => `<button class="question-number ${i === state.question ? 'current' : ''} ${state.answers[i] !== undefined ? 'answered' : ''}" data-question="${i + 1}">${i + 1}</button>`).join('')], 'active'));
}

function resultData(answerSet = state.answers, questionSet = activeQuestions()) {
  return questionSet.map((question, index) => ({ question, index, choice: answerSet[index], correct: answerSet[index] === question.answer }));
}
function topicResult(answerSet = state.answers, materialId = activeMaterial()?.id || '', questionSet = activeQuestions()) {
  const groups = new Map();
  resultData(answerSet, questionSet).forEach(answer => {
    const number = answer.question.topic || 1;
    const topic = answer.question.topicName || `Topic ${number}`;
    const row = groups.get(number) || { topic, topicNumber: number, materialId, correct: 0, total: 0, accuracy: 0 };
    row.total++;
    if (answer.correct) row.correct++;
    row.accuracy = Math.round(row.correct / row.total * 100);
    groups.set(number, row);
  });
  return [...groups.values()];
}

function results() {
  const attempt = data.attempts[data.attempts.length - 1];
  if (!attempt) return shell(renderPageTemplate('results', [pageTitle('Quiz results','Your completed quiz results will appear here.'),emptyState('No quiz results yet','Complete a quiz to see your score and topic breakdown.')], 'empty'));
  const questionSet = attempt.questions || questions;
  const rows = resultData(attempt.answers, questionSet);
  const score = attempt.score;
  const percent = attempt.percent;
  const reviews = state.showAllAnswers ? rows : rows.filter(answer => [0, 3, 6].includes(answer.index));
  const topics = topicResult(attempt.answers, attempt.materialId, questionSet);
  const points = question => question.points || 2;
  const answerLabel = answer => answer.choice === undefined ? 'Not answered' : `${String.fromCharCode(65 + answer.choice)}. ${answer.question.options[answer.choice]}`;
  return shell(renderPageTemplate('results', [pageTitle('Quiz results',`${esc(attempt.materialName)} · Submitted ${dateLabel(attempt.date)}`,btn('Retake quiz','retake','secondary')),score,attempt.total,percent,esc(attempt.duration),rows.filter(answer => answer.choice !== undefined).length,rows.length,topics.map(topic => `<div class="topic-score"><strong>${esc(topic.topic)}</strong><div class="mini-bar"><i style="width:${topic.accuracy}%"></i></div><span>${topic.correct} of ${topic.total} correct</span></div>`).join(''),state.showAllAnswers ? `All ${rows.length} answers` : 'Selected answers',reviews.map(answer => `<div class="review-answer"><div><strong>Q${answer.index + 1} · ${esc(answer.question.topicName || `Topic ${answer.question.topic}`)}</strong><div class="muted">Your answer: ${esc(answerLabel(answer))}${!answer.correct ? ` · Correct answer: ${String.fromCharCode(65 + answer.question.answer)}. ${esc(answer.question.options[answer.question.answer])}` : ''}</div></div><span class="${answer.correct ? 'correct-text' : 'incorrect-text'}">${answer.correct ? `Correct ${points(answer.question)} / ${points(answer.question)} pts` : `Incorrect 0 / ${points(answer.question)} pts`}</span></div>`).join(''),state.showAllAnswers ? 'Show fewer answers' : `Show all ${rows.length} answers`], 'summary'));
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
  return shell(renderPageTemplate('gaps', [pageTitle('Knowledge gap analysis','See which topics you understand and which need more attention.',select),rows.length,overall,weak.length,mastered.length,tableRows,scoreChart(attempts),focus,rows.length?'':'disabled']));
}

function roadmapItems() {
  const metrics = getMetrics(state.gapMaterial);
  const byTopic = new Map();
  metrics.forEach(row => { const key = `${row.materialId}:${row.topic}`; if (!byTopic.has(key)) byTopic.set(key, row); });
  return [...byTopic.values()].sort((a, b) => a.accuracy - b.accuracy);
}
function roadmapStatusKey(row) { return `${row.materialId}:${row.topic}`; }
function roadmap() {
  const items = roadmapItems();
  const select = `<label class="roadmap-filter" for="roadmap-material-filter"><span>Filter roadmap by material</span><select class="select roadmap-material-select" id="roadmap-material-filter"><option value="all" ${state.gapMaterial === 'all' ? 'selected' : ''}>All materials</option>${readyMaterials().map(material => `<option value="${esc(material.id)}" ${state.gapMaterial === material.id ? 'selected' : ''}>${esc(material.name)}</option>`).join('')}</select></label>`;
  if (!items.length) return shell(renderPageTemplate('roadmap', [pageTitle('Learning roadmap','Your study steps are prioritized from your quiz results.',`<div class="roadmap-header-actions">${select}</div>`,'roadmap-page-title'),emptyState('Your roadmap will start here','Complete a quiz to identify topics for your personalized study sequence.','View materials','materials')], 'empty'));
  const done = items.filter(item => (data.roadmapStatus[roadmapStatusKey(item)] || 'Not started') === 'Done').length;
  const routeColumns = 1;
  const routeRowHeight = window.innerWidth <= 700 ? 250 : 320;
  const routeRows = Math.ceil(items.length / routeColumns);
  const routePoints = [];
  const itemMarkup = items.map((item, index) => {
    const status = data.roadmapStatus[roadmapStatusKey(item)] || 'Not started';
    const reason = item.accuracy < 50 ? `Why now: accuracy is ${item.accuracy}%, below the 50% weak threshold.` : item.accuracy < 80 ? `Why next: accuracy is ${item.accuracy}%, still developing.` : `Why next: accuracy is ${item.accuracy}%; keep reviewing to maintain mastery.`;
    const topicNumber = item.topicNumber;
    const row = Math.floor(index / routeColumns);
    const slot = index % routeColumns;
    const column = row % 2 === 0 ? slot : routeColumns - 1 - slot;
    const x = window.innerWidth <= 700 ? 60 : 500;
    const y = row * routeRowHeight + routeRowHeight / 2;
    routePoints.push({ x, y });
    const lane = window.innerWidth <= 700 ? 'mobile' : index % 2 === 0 ? 'right' : 'left';
    return `<section class="roadmap-stop ${status === 'Done' ? 'done' : ''}" data-lane="${lane}" style="grid-column:${column + 1};grid-row:${row + 1}"><div class="roadmap-waypoint" aria-label="Waypoint ${index + 1}">${status === 'Done' ? '✓' : String(index + 1).padStart(2, '0')}</div><article class="roadmap-stop-card"><div class="roadmap-stop-heading"><div><span class="roadmap-kicker">WAYPOINT ${String(index + 1).padStart(2, '0')}</span><h3>${esc(item.topic)}</h3><p class="roadmap-stop-subtitle">${esc(topicContent[topicNumber]?.title || 'Review this topic from your material.')}</p></div><span class="roadmap-stop-status">${esc(status)}</span></div><p class="reason">${reason}</p><div class="step-actions"><label class="sr-only" for="step-status-${index}">Status for ${esc(item.topic)}</label><select class="step-status-select" id="step-status-${index}" data-roadmap-status data-key="${esc(roadmapStatusKey(item))}"><option ${status === 'Not started' ? 'selected' : ''}>Not started</option><option ${status === 'In progress' ? 'selected' : ''}>In progress</option><option ${status === 'Done' ? 'selected' : ''}>Done</option></select><button class="button small secondary" data-action="study-topic" data-id="${esc(item.materialId)}" data-topic="${topicNumber}">Open reviewer</button><button class="button small soft" data-action="open-quiz" data-id="${esc(item.materialId)}">Practice quiz</button></div></article></section>`;
  }).join('');
  const routePath = routePoints.map((point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = routePoints[index - 1];
    const curveX = (prev.x + point.x) / 2;
    return `C ${curveX} ${prev.y}, ${curveX} ${point.y}, ${point.x} ${point.y}`;
  }).join(' ');
  const routeSvg = `<svg class="roadmap-track-svg" viewBox="0 0 1000 ${routeRows * routeRowHeight}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="roadmap-track-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#42c8d2"/><stop offset="55%" stop-color="#45b9bd"/><stop offset="100%" stop-color="#8053dc"/></linearGradient></defs><path d="${routePath}" fill="none" stroke="url(#roadmap-track-gradient)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return shell(renderPageTemplate('roadmap', [pageTitle('Learning roadmap','A study sequence prioritized by your topic accuracy.',`<div class="roadmap-header-actions">${select}${btn('Regenerate roadmap','update-roadmap','secondary')}</div>`,'roadmap-page-title'),dateLabel(today()),items.length,done,items.length,100 * done / items.length,items.length,routeSvg,routeRowHeight,itemMarkup], 'plan'));
}
