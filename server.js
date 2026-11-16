const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');
require('dotenv').config();
const app = express();
const port = Number(process.env.PORT || 3000);
const uploadDirectory = path.join(__dirname, 'uploads');
const allowedExtensions = new Set(['.pdf', '.docx', '.pptx']);
const diskStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const receiveFiles = multer({
  storage: diskStorage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
      return callback(new Error('Only PDF, DOCX, and PPTX files are supported.'));
    }
    callback(null, true);
  },
});
fsSync.mkdirSync(uploadDirectory, { recursive: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'hims_database_updated',
  waitForConnections: true,
  connectionLimit: 10,
});
const slideXmlParser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });
const quizTopics = [
  'Learning systems and adaptation',
  'Study materials and topic extraction',
  'Assessment and performance',
  'Knowledge gaps and mastery',
  'Personalized learning roadmap',
];
const practiceQuestions = [
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

function localXmlName(name) { return name.split(':').pop(); }
function collectRunText(node, output = []) {
  if (Array.isArray(node)) {
    node.forEach(child => collectRunText(child, output));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '#text') output.push(String(value));
      else collectRunText(value, output);
    }
  } else if (typeof node === 'string') output.push(node);
  return output;
}
function collectSlideParagraphs(node, paragraphs = []) {
  if (Array.isArray(node)) {
    node.forEach(child => collectSlideParagraphs(child, paragraphs));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (localXmlName(key) === 'p') {
        const text = collectRunText(value).join('').trim();
        if (text) paragraphs.push(text);
      } else {
        collectSlideParagraphs(value, paragraphs);
      }
    }
  }
  return paragraphs;
}
function extractPptxText(filePath) {
  const zip = new AdmZip(filePath);
  const slides = zip.getEntries()
    .map(entry => ({ entry, match: entry.entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter(item => item.match)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));
  const text = slides.map(({ entry }, index) => {
    const xml = zip.readAsText(entry);
    const parsed = slideXmlParser.parse(xml);
    const paragraphs = collectSlideParagraphs(parsed);
    return paragraphs.length ? `Slide ${index + 1}\n${paragraphs.join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
  if (!text) throw new Error('No readable text was found in the PowerPoint slides.');
  if (text.length > 500000) throw new Error('Extracted slide text is too large to process.');
  return text;
}

async function ensurePracticeQuiz(connection, materialId) {
  const title = 'PacePath Practice Quiz';
  const [existing] = await connection.execute(
    'SELECT quiz_id FROM quiz WHERE material_id = ? AND title = ? ORDER BY quiz_id LIMIT 1',
    [materialId, title]
  );
  let quizId;
  if (existing.length) {
    quizId = existing[0].quiz_id;
  } else {
    const [quizResult] = await connection.execute(
      'INSERT INTO quiz (material_id, title, total_points) VALUES (?, ?, ?)',
      [materialId, title, 20]
    );
    quizId = quizResult.insertId;
    const topicIds = [];
    for (let i = 0; i < quizTopics.length; i++) {
      const [topicResult] = await connection.execute(
        'INSERT INTO topic (topic_name, description) VALUES (?, ?)',
        [`Topic ${i + 1}: ${quizTopics[i]}`, 'Practice quiz topic assessment.']
      );
      topicIds.push(topicResult.insertId);
      await connection.execute('INSERT INTO topic_material (topic_id, material_id) VALUES (?, ?)', [topicResult.insertId, materialId]);
    }
    for (const item of practiceQuestions) {
      const [questionResult] = await connection.execute(
        'INSERT INTO question (quiz_id, topic_id, question_text, question_type, points) VALUES (?, ?, ?, ?, ?)',
        [quizId, topicIds[item.topic - 1], item.text, 'multiple_choice', 2]
      );
      for (let i = 0; i < item.options.length; i++) {
        await connection.execute(
          'INSERT INTO `option` (question_id, option_text, is_correct) VALUES (?, ?, ?)',
          [questionResult.insertId, item.options[i], i === item.answer]
        );
      }
    }
  }

  const [rows] = await connection.execute(
    'SELECT q.question_id, q.topic_id, q.points, o.option_id, o.is_correct FROM question q JOIN `option` o ON o.question_id = q.question_id WHERE q.quiz_id = ? ORDER BY q.question_id, o.option_id',
    [quizId]
  );
  const questions = [];
  for (const row of rows) {
    let question = questions[questions.length - 1];
    if (!question || question.id !== row.question_id) {
      question = { id: row.question_id, topicId: row.topic_id, points: Number(row.points), options: [] };
      questions.push(question);
    }
    question.options.push({ id: row.option_id, correct: Boolean(row.is_correct) });
  }
  if (questions.length !== practiceQuestions.length) throw new Error('The quiz question set is incomplete.');
  return { quizId, questions };
}

function candidatesFromReviewer(content) {
  const blocks = String(content).split(/(?=^Slide \d+\s*$)/m).filter(Boolean);
  const slides = blocks.map(block => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const slideNumber = Number(lines[0]?.match(/^Slide (\d+)/)?.[1] || 1);
    const paragraphs = lines.slice(1);
    const title = (paragraphs[0] || `Slide ${slideNumber}`).slice(0, 180);
    return { slideNumber, title, paragraphs };
  });
  const candidates = [];
  const seen = new Set();
  for (const slide of slides) {
    for (const paragraph of slide.paragraphs) {
      for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
        const text = sentence.replace(/^[-•*\s]+/, '').trim();
        const key = text.toLowerCase();
        if (text.length < 16 || text.length > 300 || text.split(/\s+/).length < 3 || seen.has(key)) continue;
        seen.add(key);
        candidates.push({ text, slideNumber: slide.slideNumber, title: slide.title });
      }
    }
  }
  return { slides, candidates };
}

async function loadMaterialQuiz(connection, quizId) {
  const [rows] = await connection.execute(
    `SELECT q.question_id, q.topic_id, t.topic_name, q.question_text, q.points,
            o.option_id, o.option_text, o.is_correct
     FROM question q
     JOIN topic t ON t.topic_id = q.topic_id
     JOIN \`option\` o ON o.question_id = q.question_id
     WHERE q.quiz_id = ? ORDER BY q.question_id, o.option_id`,
    [quizId]
  );
  const questions = [];
  for (const row of rows) {
    let question = questions[questions.length - 1];
    if (!question || question.id !== String(row.question_id)) {
      question = {
        id: String(row.question_id),
        topicId: String(row.topic_id),
        topicName: row.topic_name,
        topic: Number(row.topic_name.match(/^(?:Topic|Slide) (\d+)/)?.[1] || 1),
        text: row.question_text,
        points: Number(row.points),
        options: [],
        answer: null,
      };
      questions.push(question);
    }
    const optionIndex = question.options.length;
    question.options.push({ id: String(row.option_id), text: row.option_text, correct: Boolean(row.is_correct) });
    if (row.is_correct) question.answer = optionIndex;
  }
  return questions;
}

async function createMaterialQuiz(connection, materialId, extractedText) {
  const { slides, candidates } = candidatesFromReviewer(extractedText);
  const available = candidates.filter(candidate => candidates.filter(other => other.slideNumber !== candidate.slideNumber && other.text !== candidate.text).length >= 3);
  if (available.length < 4 || candidates.length < 4) {
    throw new Error('This PowerPoint needs at least four distinct readable statements across its slides to make a quiz.');
  }
  const selected = available.slice(0, 10);
  const topicIds = new Map();
  for (const slide of slides) {
    const title = `Slide ${slide.slideNumber}: ${slide.title}`.slice(0, 200);
    const [topicResult] = await connection.execute(
      'INSERT INTO topic (topic_name, description) VALUES (?, ?)',
      [title, `Topic extracted from slide ${slide.slideNumber}.`]
    );
    topicIds.set(slide.slideNumber, topicResult.insertId);
    await connection.execute('INSERT INTO topic_material (topic_id, material_id) VALUES (?, ?)', [topicResult.insertId, materialId]);
  }
  const totalPoints = selected.length * 2;
  const [quizResult] = await connection.execute(
    'INSERT INTO quiz (material_id, title, total_points) VALUES (?, ?, ?)',
    [materialId, 'Material Quiz', totalPoints]
  );
  for (const candidate of selected) {
    const [questionResult] = await connection.execute(
      'INSERT INTO question (quiz_id, topic_id, question_text, question_type, points) VALUES (?, ?, ?, ?, ?)',
      [quizResult.insertId, topicIds.get(candidate.slideNumber), `Which statement appears on slide ${candidate.slideNumber}?`, 'multiple_choice', 2]
    );
    const distractors = candidates
      .filter(item => item.slideNumber !== candidate.slideNumber && item.text !== candidate.text)
      .slice(0, 3)
      .map(item => item.text);
    const choices = [candidate.text, ...distractors];
    if (choices.length !== 4) throw new Error('There are not enough statements on other slides to create answer choices.');
    choices.sort(() => Math.random() - 0.5);
    for (const choice of choices) {
      await connection.execute(
        'INSERT INTO `option` (question_id, option_text, is_correct) VALUES (?, ?, ?)',
        [questionResult.insertId, choice, choice === candidate.text]
      );
    }
  }
  return quizResult.insertId;
}

function durationSeconds(value) {
  const match = String(value || '').match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return 0;
  return Math.min(Number(match[1]) * 60 + Number(match[2]), 24 * 60 * 60);
}
function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function roadmapStatusToDb(status) {
  return ({ 'Not started': 'not_started', 'In progress': 'in_progress', Done: 'completed' })[status] || 'not_started';
}
function roadmapStatusFromDb(status) {
  return ({ not_started: 'Not started', in_progress: 'In progress', completed: 'Done' })[status] || 'Not started';
}
async function readRoadmapStatuses(userId) {
  const [rows] = await pool.execute(
    `SELECT m.material_id, t.topic_name, ri.completion_status
     FROM roadmap r
     JOIN roadmap_item ri ON ri.roadmap_id = r.roadmap_id
     JOIN topic t ON t.topic_id = ri.topic_id
     JOIN topic_material tm ON tm.topic_id = t.topic_id
     JOIN material m ON m.material_id = tm.material_id
     WHERE r.user_id = ? AND r.title = 'PacePath Learning Roadmap' AND r.status = 'active' AND m.user_id = ?`,
    [userId, userId]
  );
  const statuses = {};
  rows.forEach(row => { statuses[`${row.material_id}:${row.topic_name}`] = roadmapStatusFromDb(row.completion_status); });
  return statuses;
}

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false },
}));

function publicUser(row) {
  return { id: row.user_id, fullName: row.full_name, email: row.email };
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in to use materials.' });
  next();
}

function publicMaterial(row) {
  const extension = path.extname(row.file_name).slice(1).toUpperCase();
  const status = ['completed', 'ready'].includes(String(row.processing_status).toLowerCase())
    ? 'Ready'
    : String(row.processing_status).toLowerCase() === 'failed' ? 'Failed' : 'Processing';
  return {
    id: String(row.material_id),
    name: row.file_name,
    type: extension || row.file_type,
    uploaded: new Date(row.upload_date).toISOString().slice(0, 10),
    status,
    topics: 0,
  };
}

app.get('/api/materials', requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT material_id, file_name, file_type, upload_date, processing_status FROM material WHERE user_id = ? ORDER BY upload_date DESC, material_id DESC',
      [req.session.user.id]
    );
    res.json({ materials: rows.map(publicMaterial) });
  } catch (error) {
    console.error('Loading materials failed:', error.message);
    res.status(500).json({ error: 'Could not load your materials.' });
  }
});

app.get('/api/materials/:id/reviewer', requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT r.title, r.content FROM reviewer r JOIN material m ON m.material_id = r.material_id WHERE m.material_id = ? AND m.user_id = ? ORDER BY r.generated_date DESC LIMIT 1',
      [req.params.id, req.session.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No extracted slide text is available for this material yet.' });
    res.json({ title: rows[0].title, content: rows[0].content });
  } catch (error) {
    console.error('Loading reviewer text failed:', error.message);
    res.status(500).json({ error: 'Could not load the extracted slide text.' });
  }
});

app.get('/api/materials/:id/quiz', requireLogin, async (req, res) => {
  let connection;
  try {
    const [materials] = await pool.execute(
      "SELECT material_id FROM material WHERE material_id = ? AND user_id = ? AND processing_status = 'completed' LIMIT 1",
      [req.params.id, req.session.user.id]
    );
    if (!materials.length) return res.status(404).json({ error: 'This material is not ready for a quiz.' });
    const materialId = materials[0].material_id;
    const [existing] = await pool.execute(
      "SELECT quiz_id FROM quiz WHERE material_id = ? AND title = 'Material Quiz' ORDER BY quiz_id LIMIT 1",
      [materialId]
    );
    let quizId = existing[0]?.quiz_id;
    if (!quizId) {
      const [reviewers] = await pool.execute(
        'SELECT content FROM reviewer WHERE material_id = ? ORDER BY generated_date DESC LIMIT 1',
        [materialId]
      );
      if (!reviewers.length) return res.status(404).json({ error: 'Extract the material text before creating a quiz.' });
      connection = await pool.getConnection();
      await connection.beginTransaction();
      quizId = await createMaterialQuiz(connection, materialId, reviewers[0].content);
      await connection.commit();
    }
    const questions = await loadMaterialQuiz(connection || pool, quizId);
    if (!questions.length) return res.status(422).json({ error: 'The quiz has no readable questions.' });
    res.json({
      quizId: String(quizId),
      questions: questions.map(question => ({
        id: question.id,
        topicId: question.topicId,
        topicName: question.topicName,
        topic: question.topic,
        text: question.text,
        points: question.points,
        options: question.options.map(option => option.text),
      })),
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Creating material quiz failed:', error.message);
    res.status(422).json({ error: error.message || 'Could not create a quiz from this material.' });
  } finally { connection?.release(); }
});

app.post('/api/materials/:id/process', requireLogin, async (req, res) => {
  let connection;
  try {
    const [rows] = await pool.execute(
      'SELECT material_id, file_name, file_path, file_type, upload_date FROM material WHERE material_id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.session.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found.' });
    const material = rows[0];
    if (path.extname(material.file_name).toLowerCase() !== '.pptx') {
      return res.status(400).json({ error: 'Text extraction is currently available for PowerPoint files (.pptx).' });
    }
    const storedName = path.basename(material.file_path);
    const filePath = path.join(uploadDirectory, storedName);
    const content = extractPptxText(filePath);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute('DELETE FROM reviewer WHERE material_id = ?', [material.material_id]);
    await connection.execute(
      'INSERT INTO reviewer (material_id, title, content) VALUES (?, ?, ?)',
      [material.material_id, `Extracted text: ${material.file_name}`, content]
    );
    await connection.execute("UPDATE material SET processing_status = 'completed' WHERE material_id = ?", [material.material_id]);
    await connection.commit();
    res.json({ material: publicMaterial({ ...material, processing_status: 'completed' }) });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Processing material failed:', error.message);
    res.status(422).json({ error: error.message || 'Could not extract text from this PowerPoint.' });
  } finally {
    connection?.release();
  }
});

app.post('/api/materials', requireLogin, (req, res, next) => {
  receiveFiles.array('files', 10)(req, res, error => {
    if (error) return res.status(400).json({ error: error.message });
    next();
  });
}, async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Choose at least one file to upload.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const created = [];
    for (const file of req.files) {
      const [result] = await connection.execute(
        'INSERT INTO material (user_id, file_name, file_path, file_type, processing_status) VALUES (?, ?, ?, ?, ?)',
        [req.session.user.id, file.originalname, `uploads/${file.filename}`, file.mimetype || path.extname(file.originalname).slice(1), 'pending']
      );
      const row = {
        material_id: result.insertId,
        file_name: file.originalname,
        file_type: file.mimetype || path.extname(file.originalname).slice(1),
        upload_date: new Date(),
        processing_status: 'pending',
      };
      if (path.extname(file.originalname).toLowerCase() === '.pptx') {
        const content = extractPptxText(file.path);
        await connection.execute(
          'INSERT INTO reviewer (material_id, title, content) VALUES (?, ?, ?)',
          [result.insertId, `Extracted text: ${file.originalname}`, content]
        );
        await connection.execute("UPDATE material SET processing_status = 'completed' WHERE material_id = ?", [result.insertId]);
        row.processing_status = 'completed';
      }
      created.push(row);
    }
    await connection.commit();
    res.status(201).json({ materials: created.map(publicMaterial) });
  } catch (error) {
    await connection.rollback();
    await Promise.all(req.files.map(file => fs.unlink(file.path).catch(() => {})));
    console.error('Saving uploaded materials failed:', error.message);
    res.status(500).json({ error: 'Could not save the uploaded files.' });
  } finally {
    connection.release();
  }
});

app.post('/api/attempts', requireLogin, async (req, res) => {
  const materialId = String(req.body.materialId || '');
  const requestedQuizId = String(req.body.quizId || '');
  const selections = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  if (!/^\d+$/.test(materialId) || !/^\d+$/.test(requestedQuizId)) return res.status(400).json({ error: 'Choose a valid quiz for this material.' });
  for (const [index, choice] of Object.entries(selections)) {
    if (!/^\d+$/.test(index) || !Number.isInteger(Number(choice)) || Number(choice) < 0) {
      return res.status(400).json({ error: 'One or more quiz answers are invalid.' });
    }
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [quizRows] = await connection.execute(
      `SELECT qz.quiz_id, m.material_id, m.file_name
       FROM quiz qz JOIN material m ON m.material_id = qz.material_id
       WHERE qz.quiz_id = ? AND m.material_id = ? AND m.user_id = ? AND m.processing_status = 'completed' LIMIT 1`,
      [requestedQuizId, materialId, req.session.user.id]
    );
    if (!quizRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'This quiz is not available for your account.' });
    }
    const material = quizRows[0];
    const [questionRows] = await connection.execute(
      `SELECT q.question_id, q.topic_id, q.points, o.option_id, o.is_correct
       FROM question q JOIN \`option\` o ON o.question_id = q.question_id
       WHERE q.quiz_id = ? ORDER BY q.question_id, o.option_id`,
      [material.quiz_id]
    );
    const dbQuestions = [];
    for (const row of questionRows) {
      let question = dbQuestions[dbQuestions.length - 1];
      if (!question || question.id !== row.question_id) {
        question = { id: row.question_id, topicId: row.topic_id, points: Number(row.points), options: [] };
        dbQuestions.push(question);
      }
      question.options.push({ id: row.option_id, correct: Boolean(row.is_correct) });
    }
    if (!dbQuestions.length) throw new Error('This quiz does not contain any questions.');
    for (const [index, choice] of Object.entries(selections)) {
      if (Number(index) >= dbQuestions.length || Number(choice) >= dbQuestions[Number(index)].options.length) {
        await connection.rollback();
        return res.status(400).json({ error: 'One or more quiz answers are invalid.' });
      }
    }
    const grades = dbQuestions.map((question, index) => {
      const choice = Object.prototype.hasOwnProperty.call(selections, index) ? Number(selections[index]) : null;
      const option = choice === null ? null : question.options[choice];
      const correct = Boolean(option?.correct);
      return { question, choice, option, correct, earned: correct ? question.points : 0 };
    });
    const score = grades.reduce((sum, grade) => sum + grade.earned, 0);
    const totalPoints = dbQuestions.reduce((sum, question) => sum + question.points, 0);
    const percentage = totalPoints ? Math.round(score / totalPoints * 100) : 0;
    const seconds = durationSeconds(req.body.duration);
    const startedAt = new Date(Date.now() - seconds * 1000);
    const [attemptResult] = await connection.execute(
      'INSERT INTO attempt (quiz_id, user_id, start_time, completion_time, percentage, score) VALUES (?, ?, ?, NOW(), ?, ?)',
      [material.quiz_id, req.session.user.id, startedAt, percentage, score]
    );
    const topicTotals = new Map();
    for (const grade of grades) {
      const totals = topicTotals.get(grade.question.topicId) || { answered: 0, correct: 0 };
      totals.answered += 1;
      if (grade.correct) totals.correct += 1;
      topicTotals.set(grade.question.topicId, totals);
      await connection.execute(
        'INSERT INTO answer (attempt_id, question_id, option_id, earned_score, is_correct, response_text) VALUES (?, ?, ?, ?, ?, ?)',
        [attemptResult.insertId, grade.question.id, grade.option?.id ?? null, grade.earned, grade.correct, grade.choice === null ? null : String(grade.choice)]
      );
    }
    for (const [topicId, totals] of topicTotals) {
      const accuracy = totals.answered ? Math.round(totals.correct / totals.answered * 100) : 0;
      await connection.execute(
        `INSERT INTO user_topic_assessment (user_id, topic_id, total_answered, correct_count, accuracy_rate, last_assessed)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           accuracy_rate = ROUND((correct_count + VALUES(correct_count)) * 100 / (total_answered + VALUES(total_answered)), 2),
           total_answered = total_answered + VALUES(total_answered),
           correct_count = correct_count + VALUES(correct_count),
           last_assessed = NOW()`,
        [req.session.user.id, topicId, totals.answered, totals.correct, accuracy]
      );
    }
    await connection.commit();
    res.status(201).json({ attempt: {
      id: String(attemptResult.insertId),
      date: new Date().toISOString().slice(0, 10),
      materialId: String(material.material_id),
      materialName: material.file_name,
      score,
      total: totalPoints,
      percent: percentage,
      duration: formatDuration(seconds),
      answers: selections,
    } });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Saving quiz attempt failed:', error.message);
    res.status(500).json({ error: 'Could not save your quiz result.' });
  } finally {
    connection?.release();
  }
});

app.get('/api/progress', requireLogin, async (req, res) => {
  try {
    const [assessmentRows] = await pool.execute(
      `SELECT t.topic_name, tm.material_id, uta.total_answered, uta.correct_count, uta.accuracy_rate, uta.last_assessed
       FROM user_topic_assessment uta
       JOIN topic t ON t.topic_id = uta.topic_id
       JOIN topic_material tm ON tm.topic_id = t.topic_id
       JOIN material m ON m.material_id = tm.material_id
       WHERE uta.user_id = ? AND m.user_id = ?
       ORDER BY tm.material_id, t.topic_id`,
      [req.session.user.id, req.session.user.id]
    );
    const mastery = assessmentRows.map(row => ({
      topic: row.topic_name,
      topicNumber: Number(row.topic_name.match(/^(?:Topic|Slide) (\d+)/)?.[1] || 1),
      materialId: String(row.material_id),
      answered: Number(row.total_answered),
      correct: Number(row.correct_count),
      accuracy: Number(row.accuracy_rate),
      date: row.last_assessed ? new Date(row.last_assessed).toISOString().slice(0, 10) : null,
    }));

    const [attemptRows] = await pool.execute(
      `SELECT a.attempt_id, a.completion_time, a.start_time, a.percentage, a.score,
              qz.total_points, m.material_id, m.file_name, q.question_id, q.topic_id,
              t.topic_name, q.question_text, q.points, o.option_text, o.is_correct, ans.response_text,
              TIMESTAMPDIFF(SECOND, a.start_time, a.completion_time) AS duration_seconds
       FROM attempt a
       JOIN quiz qz ON qz.quiz_id = a.quiz_id
       JOIN material m ON m.material_id = qz.material_id
       JOIN question q ON q.quiz_id = qz.quiz_id
       JOIN topic t ON t.topic_id = q.topic_id
       JOIN \`option\` o ON o.question_id = q.question_id
       LEFT JOIN answer ans ON ans.attempt_id = a.attempt_id AND ans.question_id = q.question_id
       WHERE a.user_id = ? AND m.user_id = ?
       ORDER BY a.completion_time, a.attempt_id, q.question_id, o.option_id`,
      [req.session.user.id, req.session.user.id]
    );
    const attempts = [];
    const attemptById = new Map();
    for (const row of attemptRows) {
      const id = String(row.attempt_id);
      let attempt = attemptById.get(id);
      if (!attempt) {
        attempt = {
          id,
          date: row.completion_time ? new Date(row.completion_time).toISOString().slice(0, 10) : '',
          materialId: String(row.material_id),
          materialName: row.file_name,
          score: Number(row.score || 0),
          total: Number(row.total_points || 0),
          percent: Number(row.percentage || 0),
          duration: formatDuration(row.duration_seconds),
          answers: {},
          questions: [],
          questionMap: new Map(),
        };
        attemptById.set(id, attempt);
        attempts.push(attempt);
      }
      const questionId = String(row.question_id);
      let questionIndex = attempt.questionMap.get(questionId);
      if (questionIndex === undefined) {
        questionIndex = attempt.questions.length;
        attempt.questionMap.set(questionId, questionIndex);
        attempt.questions.push({
          id: questionId,
          topicId: String(row.topic_id),
          topicName: row.topic_name,
          topic: Number(row.topic_name.match(/^(?:Topic|Slide) (\d+)/)?.[1] || 1),
          text: row.question_text,
          points: Number(row.points),
          options: [],
          answer: null,
        });
        if (row.response_text !== null) attempt.answers[questionIndex] = Number(row.response_text);
      }
      const question = attempt.questions[questionIndex];
      const optionIndex = question.options.length;
      question.options.push(row.option_text);
      if (row.is_correct) question.answer = optionIndex;
    }
    attempts.forEach(attempt => delete attempt.questionMap);
    res.json({ mastery, attempts });
  } catch (error) {
    console.error('Loading learning progress failed:', error.message);
    res.status(500).json({ error: 'Could not load your learning progress.' });
  }
});

app.get('/api/roadmap', requireLogin, async (req, res) => {
  try { res.json({ statuses: await readRoadmapStatuses(req.session.user.id) }); }
  catch (error) {
    console.error('Loading roadmap failed:', error.message);
    res.status(500).json({ error: 'Could not load your roadmap.' });
  }
});

app.post('/api/roadmap/refresh', requireLogin, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [assessmentRows] = await connection.execute(
      `SELECT t.topic_id, t.topic_name, tm.material_id, uta.accuracy_rate
       FROM user_topic_assessment uta
       JOIN topic t ON t.topic_id = uta.topic_id
       JOIN topic_material tm ON tm.topic_id = t.topic_id
       JOIN material m ON m.material_id = tm.material_id
       WHERE uta.user_id = ? AND m.user_id = ? AND m.processing_status = 'completed'
       ORDER BY uta.accuracy_rate, t.topic_id LIMIT 4`,
      [req.session.user.id, req.session.user.id]
    );
    const [roadmaps] = await connection.execute(
      "SELECT roadmap_id FROM roadmap WHERE user_id = ? AND title = 'PacePath Learning Roadmap' AND status = 'active' ORDER BY roadmap_id LIMIT 1",
      [req.session.user.id]
    );
    let roadmapId = roadmaps[0]?.roadmap_id;
    if (!roadmapId && assessmentRows.length) {
      const [result] = await connection.execute(
        "INSERT INTO roadmap (user_id, title, status) VALUES (?, 'PacePath Learning Roadmap', 'active')",
        [req.session.user.id]
      );
      roadmapId = result.insertId;
    }
    if (roadmapId) {
      const [oldItems] = await connection.execute(
        `SELECT ri.topic_id, ri.completion_status
         FROM roadmap_item ri JOIN roadmap r ON r.roadmap_id = ri.roadmap_id
         WHERE r.roadmap_id = ?`,
        [roadmapId]
      );
      const oldStatuses = new Map(oldItems.map(item => [String(item.topic_id), item.completion_status]));
      await connection.execute('DELETE FROM roadmap_item WHERE roadmap_id = ?', [roadmapId]);
      for (let i = 0; i < assessmentRows.length; i++) {
        const row = assessmentRows[i];
        const accuracy = Number(row.accuracy_rate);
        const reason = accuracy < 50
          ? `Accuracy is ${accuracy}%, below the weak-topic threshold.`
          : accuracy < 80 ? `Accuracy is ${accuracy}%, so more practice may help.` : `Accuracy is ${accuracy}%; review to maintain mastery.`;
        await connection.execute(
          'INSERT INTO roadmap_item (roadmap_id, topic_id, sequence_number, priority_reason, completion_status) VALUES (?, ?, ?, ?, ?)',
          [roadmapId, row.topic_id, i + 1, reason, oldStatuses.get(String(row.topic_id)) || 'not_started']
        );
      }
    }
    await connection.commit();
    res.json({ statuses: await readRoadmapStatuses(req.session.user.id) });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Refreshing roadmap failed:', error.message);
    res.status(500).json({ error: 'Could not update your roadmap.' });
  } finally { connection?.release(); }
});

app.patch('/api/roadmap/item', requireLogin, async (req, res) => {
  const materialId = String(req.body.materialId || '');
  const topicName = String(req.body.topic || '');
  const completionStatus = roadmapStatusToDb(req.body.status);
  try {
    const [rows] = await pool.execute(
      `SELECT ri.item_id
       FROM roadmap_item ri
       JOIN roadmap r ON r.roadmap_id = ri.roadmap_id
       JOIN topic t ON t.topic_id = ri.topic_id
       JOIN topic_material tm ON tm.topic_id = t.topic_id
       JOIN material m ON m.material_id = tm.material_id
       WHERE r.user_id = ? AND r.title = 'PacePath Learning Roadmap' AND r.status = 'active'
         AND m.user_id = ? AND m.material_id = ? AND t.topic_name = ? LIMIT 1`,
      [req.session.user.id, req.session.user.id, materialId, topicName]
    );
    if (!rows.length) return res.status(404).json({ error: 'Roadmap item not found. Regenerate your roadmap and try again.' });
    await pool.execute('UPDATE roadmap_item SET completion_status = ? WHERE item_id = ?', [completionStatus, rows[0].item_id]);
    res.json({ statuses: await readRoadmapStatuses(req.session.user.id) });
  } catch (error) {
    console.error('Saving roadmap status failed:', error.message);
    res.status(500).json({ error: 'Could not save that roadmap status.' });
  }
});

app.post('/api/register', async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!fullName || !email || password.length < 8) {
    return res.status(400).json({ error: 'Enter your name, a valid email, and a password with at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO `user` (full_name, email, password_hash) VALUES (?, ?, ?)',
      [fullName, email, passwordHash]
    );
    const user = { id: result.insertId, fullName, email };
    req.session.user = user;
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error('Registration failed:', error.message);
    res.status(500).json({ error: 'Could not create the account. Check the server log.' });
  }
});

app.post('/api/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  try {
    const [rows] = await pool.execute(
      'SELECT user_id, full_name, email, password_hash FROM `user` WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const user = publicUser(rows[0]);
    req.session.regenerate(error => {
      if (error) return res.status(500).json({ error: 'Could not start a login session.' });
      req.session.user = user;
      req.session.save(saveError => {
        if (saveError) return res.status(500).json({ error: 'Could not save the login session.' });
        res.json({ user });
      });
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    res.status(500).json({ error: 'Could not log in. Check the server log.' });
  }
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ error: 'Could not log out.' });
    res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true });
  });
});

app.get('/api/db-check', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion');
    res.json({ connected: true, ...rows[0] });
  } catch (error) {
    console.error('MySQL connection check failed:', error.message);
    res.status(503).json({ connected: false, error: 'Could not connect to MySQL. Check the server settings.' });
  }
});

app.use(express.static(path.join(__dirname, '..')));

app.listen(port, () => {
  console.log(`PacePath is running at http://localhost:${port}`);
});
