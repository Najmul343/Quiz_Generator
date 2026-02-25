// ============================================
// ITI QUIZ SYSTEM - COMPLETE APPSCRIPT
// ============================================

// ============ CONSTANTS ============
var LOG_SHEET    = 'QUIZ LOG';
var TESTS_SHEET  = 'ACTIVE TESTS';
var CONFIG_SHEET = 'CONFIG';
var RESULTS_SHEET = 'RESULTS';

// ============ MENU ============
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ITI Quiz System')
    .addItem('Open Quiz Maker', 'openQuizSidebar')
    .addSeparator()
    .addItem('View Results', 'viewResults')
    .addItem('View Quiz Log', 'viewLog')
    .addSeparator()
    .addItem('Setup Sheets (Do First!)', 'setupAllSheets')
    .addItem('Set Web App URL (Do Second!)', 'promptSetWebAppUrl')
    .addItem('Sheet Setup Guide', 'showSetupGuide')
    .addSeparator()
    .addItem('📤 Upload Image to Selected Cell', 'showImageUploader') // Minimal change: added this
    .addToUi();
}
// ============ GET / SAVE WEB APP URL ============
function getWebAppUrl() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  if (!configSheet) return null;
  var data = configSheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() === 'webAppUrl') {
      var url = data[i][1] ? data[i][1].toString().trim() : '';
      if (url && url.startsWith('https://script.google.com')) return url;
    }
  }
  return null;
}

function saveWebAppUrl(url) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  if (!configSheet) return false;
  var data = configSheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() === 'webAppUrl') {
      configSheet.getRange(i + 1, 2).setValue(url);
      return true;
    }
  }
  configSheet.appendRow(['webAppUrl', url, 'DO NOT EDIT - Web App deployment URL']);
  return true;
}

function promptSetWebAppUrl() {
  var ui = SpreadsheetApp.getUi();
  var current = getWebAppUrl() || '';
  var result = ui.prompt(
    'Set Web App URL',
    'Paste your Web App deployment URL here.\n\n' +
    'How to get it:\n' +
    '1. Go to Extensions > Apps Script\n' +
    '2. Click Deploy > Manage Deployments\n' +
    '3. Copy the Web App URL shown there\n' +
    '   (starts with https://script.google.com/macros/s/...)\n\n' +
    (current ? 'Currently saved: ' + current + '\n\n' : 'Nothing saved yet.\n\n') +
    'Paste URL below:',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;
  var url = result.getResponseText().trim();
  if (!url) { ui.alert('No URL entered.'); return; }
  if (!url.startsWith('https://script.google.com')) {
    ui.alert('Invalid URL. Must start with https://script.google.com/macros/s/...\n\nCopy it from Deploy > Manage Deployments.');
    return;
  }
  saveWebAppUrl(url);
  ui.alert('SUCCESS! Web App URL saved.\n\nNow you can create tests from the sidebar and students will be able to open the links.\n\nSaved: ' + url);
}

// ============ SIDEBAR ============
function openQuizSidebar() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = spreadsheet.getSheets().map(s => s.getName());

  // Filter out system sheets
  var systemSheets = [LOG_SHEET, TESTS_SHEET, CONFIG_SHEET, RESULTS_SHEET];
  var subjectSheets = allSheets.filter(name => !systemSheets.includes(name));

  // Load questions from all subject sheets
  var chaptersData = {};
  subjectSheets.forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows = data.slice(1).filter(row => row[0]);

    chaptersData[sheetName] = rows.map(function(row, i) {
      return {
        index: i,
        question: row[0] ? row[0].toString() : '',
        questionImage: row[1] ? row[1].toString() : '',  // Drive image URL for question
        optA: row[2] ? row[2].toString() : '',
        optAImage: row[3] ? row[3].toString() : '',
        optB: row[4] ? row[4].toString() : '',
        optBImage: row[5] ? row[5].toString() : '',
        optC: row[6] ? row[6].toString() : '',
        optCImage: row[7] ? row[7].toString() : '',
        optD: row[8] ? row[8].toString() : '',
        optDImage: row[9] ? row[9].toString() : '',
        answer: row[10] ? row[10].toString().trim().toUpperCase() : 'A',
        difficulty: row[11] ? row[11].toString().toLowerCase() : 'medium',
        points: parseInt(row[12]) || 1,
        negativeMarks: parseFloat(row[13]) || 0,
        explanation: row[14] ? row[14].toString() : ''
      };
    });
  });

  // Get config
  var config = getConfig();

  var html = buildSidebarHtml(subjectSheets, chaptersData, config);
  var htmlOutput = HtmlService.createHtmlOutput(html)
    .setTitle('🎓 ITI Quiz Maker')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

function getConfig() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  var config = {
    instituteName: 'Government ITI',
    instituteSubtitle: 'Industrial Training Institute',
    logoUrl: '',
    defaultDuration: 60,
    passingMarks: 40
  };

  if (configSheet) {
    var data = configSheet.getDataRange().getValues();
    data.forEach(function(row) {
      if (row[0] && row[1] !== undefined) {
        var key = row[0].toString().trim();
        var val = row[1].toString().trim();
        if (key === 'instituteName') config.instituteName = val;
        if (key === 'instituteSubtitle') config.instituteSubtitle = val;
        if (key === 'logoUrl') config.logoUrl = val;
        if (key === 'defaultDuration') config.defaultDuration = parseInt(val) || 60;
        if (key === 'passingMarks') config.passingMarks = parseInt(val) || 40;
      }
    });
  }
  return config;
}

// ============ BUILD SIDEBAR HTML ============
function buildSidebarHtml(chapters, chaptersData, config) {
  var chaptersJson = JSON.stringify(chaptersData);
  var chaptersListJson = JSON.stringify(chapters);
  var configJson = JSON.stringify(config);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; background: #f0f4f8; color: #2d3748; }

.header {
  background: linear-gradient(135deg, #1a56db 0%, #0d3b9e 100%);
  color: white;
  padding: 14px 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.header h1 { font-size: 15px; font-weight: 700; }
.header p { font-size: 11px; opacity: 0.8; margin-top: 2px; }

.step-card {
  background: white;
  margin: 10px 8px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.step-header {
  background: #f7faff;
  border-bottom: 1px solid #e2e8f0;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-num {
  background: #1a56db;
  color: white;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
  flex-shrink: 0;
}
.step-title { font-weight: 600; font-size: 12px; color: #1a202c; text-transform: uppercase; letter-spacing: 0.5px; }

.step-body { padding: 12px 14px; }

/* Chapter list */
.chapter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.chapter-item:hover { border-color: #1a56db; background: #f0f5ff; }
.chapter-item.selected { border-color: #1a56db; background: #ebf2ff; }
.chapter-left { display: flex; align-items: center; gap: 8px; }
.chapter-left input { width: 16px; height: 16px; cursor: pointer; accent-color: #1a56db; }
.chapter-name { font-size: 12px; font-weight: 500; }
.count-badge { background: #1a56db; color: white; border-radius: 10px; padding: 1px 8px; font-size: 10px; }

/* Difficulty pills */
.pill-group { display: flex; gap: 6px; flex-wrap: wrap; }
.pill {
  padding: 6px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  user-select: none;
}
.pill:hover { border-color: #1a56db; }
.pill.on { border-color: #1a56db; background: #1a56db; color: white; font-weight: 600; }

/* Mode buttons */
.mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mode-card {
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
}
.mode-card:hover { border-color: #1a56db; }
.mode-card.on { border-color: #1a56db; background: #ebf2ff; }
.mode-card .icon { font-size: 22px; display: block; margin-bottom: 4px; }
.mode-card .label { font-size: 12px; font-weight: 600; color: #1a202c; }
.mode-card .desc { font-size: 10px; color: #718096; margin-top: 2px; }

/* Inputs */
input[type=number], input[type=text], select, textarea {
  width: 100%;
  padding: 8px 10px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  transition: border 0.15s;
  background: white;
}
input:focus, select:focus, textarea:focus { border-color: #1a56db; outline: none; }
label { font-size: 11px; color: #718096; font-weight: 600; display: block; margin-bottom: 4px; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
.input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* Question list */
.q-chapter-header {
  background: #1a56db;
  color: white;
  padding: 7px 12px;
  border-radius: 6px;
  margin: 10px 0 6px 0;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sel-all-btn {
  font-size: 10px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.4);
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.sel-all-btn:hover { background: rgba(255,255,255,0.35); }

.q-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid #f0f4f8;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.1s;
}
.q-item:hover { background: #f7faff; }
.q-item.on { background: #ebf2ff; border-color: #1a56db; }
.q-item input { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; accent-color: #1a56db; cursor: pointer; }
.q-text { font-size: 11.5px; line-height: 1.4; color: #2d3748; }
.q-meta { display: flex; gap: 6px; margin-top: 3px; align-items: center; }
.diff-pill { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px; text-transform: uppercase; }
.easy { background: #def7ec; color: #03543f; }
.medium { background: #fef3c7; color: #92400e; }
.hard { background: #fde8e8; color: #9b1c1c; }
.pts { font-size: 9px; color: #718096; }

/* Action button */
#createBtn {
  width: calc(100% - 16px);
  margin: 10px 8px 8px 8px;
  padding: 14px;
  background: linear-gradient(135deg, #1a56db, #0d3b9e);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.3px;
}
#createBtn:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(26,86,219,0.4); }
#createBtn:disabled { background: #a0aec0; cursor: not-allowed; transform: none; box-shadow: none; }

/* Status */
#status {
  margin: 0 8px 10px 8px;
  padding: 12px;
  border-radius: 8px;
  display: none;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}
.s-success { background: #def7ec; color: #03543f; border: 1px solid #84e1bc; }
.s-error { background: #fde8e8; color: #9b1c1c; border: 1px solid #f8b4b4; }
.s-loading { background: #ebf5fb; color: #1a56db; border: 1px solid #bfdbfe; }

.hidden { display: none !important; }
.spacer { height: 6px; }

/* Tabs */
.tab-row { display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 12px; }
.tab { padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; color: #718096; transition: all 0.15s; }
.tab.on { color: #1a56db; border-bottom-color: #1a56db; }

.sel-count { background: #1a56db; color: white; border-radius: 10px; padding: 1px 8px; font-size: 10px; margin-left: 6px; }
</style>
</head>
<body>

<div class="header">
  <h1>🎓 ITI Quiz Maker</h1>
  <p>Create professional mock tests in minutes</p>
</div>

<!-- STEP 1: CHAPTERS -->
<div class="step-card">
  <div class="step-header">
    <div class="step-num">1</div>
    <div class="step-title">📚 Select Subjects / Chapters</div>
  </div>
  <div class="step-body" id="chapterList"></div>
</div>

<!-- STEP 2: DIFFICULTY -->
<div class="step-card">
  <div class="step-header">
    <div class="step-num">2</div>
    <div class="step-title">🎯 Difficulty Filter</div>
  </div>
  <div class="step-body">
    <div class="pill-group">
      <div class="pill on" data-val="all" onclick="setPill(this,'diff')">All</div>
      <div class="pill" data-val="easy" onclick="setPill(this,'diff')">🟢 Easy</div>
      <div class="pill" data-val="medium" onclick="setPill(this,'diff')">🟡 Medium</div>
      <div class="pill" data-val="hard" onclick="setPill(this,'diff')">🔴 Hard</div>
    </div>
  </div>
</div>

<!-- STEP 3: SELECTION MODE -->
<div class="step-card">
  <div class="step-header">
    <div class="step-num">3</div>
    <div class="step-title">⚙️ Question Selection Mode</div>
  </div>
  <div class="step-body">
    <div class="mode-grid">
      <div class="mode-card on" id="modeRandom" onclick="setMode('random')">
        <span class="icon">🎲</span>
        <div class="label">Random</div>
        <div class="desc">Auto-pick questions</div>
      </div>
      <div class="mode-card" id="modeCustom" onclick="setMode('custom')">
        <span class="icon">☑️</span>
        <div class="label">Custom</div>
        <div class="desc">Hand-pick each question</div>
      </div>
    </div>

    <div id="randomSection" style="margin-top:12px;">
      <label>Number of Questions (0 = all)</label>
      <input type="number" id="randomCount" placeholder="e.g. 25" min="1" />
    </div>
  </div>
</div>

<!-- CUSTOM QUESTION LIST -->
<div class="step-card hidden" id="questionListSection">
  <div class="step-header">
    <div class="step-num">✅</div>
    <div class="step-title">Pick Questions <span class="sel-count" id="selectedCount">0</span></div>
  </div>
  <div class="step-body" id="questionList"></div>
</div>

<!-- STEP 4: TEST DETAILS -->
<div class="step-card">
  <div class="step-header">
    <div class="step-num">4</div>
    <div class="step-title">📝 Test Details</div>
  </div>
  <div class="step-body">
    <div class="tab-row">
      <div class="tab on" onclick="showTab('basic')">Basic</div>
      <div class="tab" onclick="showTab('advanced')">Advanced</div>
    </div>

    <div id="tabBasic">
      <label>Test Title *</label>
      <input type="text" id="quizTitle" placeholder="e.g. Trade Theory — Chapter 1 Test" />
      <label>Teacher Name *</label>
      <input type="text" id="teacherName" placeholder="Enter your name" />
      <label>Trade / Class</label>
      <input type="text" id="tradeClass" placeholder="e.g. Electrician — Sem 1" />
      <label>Duration (minutes)</label>
      <input type="number" id="duration" value="60" min="5" />
    </div>

    <div id="tabAdvanced" class="hidden">
      <label>Institute Name</label>
      <input type="text" id="instituteName" value="${config.instituteName}" />
      <label>Institute Subtitle / Address</label>
      <input type="text" id="instituteSubtitle" value="${config.instituteSubtitle}" />
      <div class="input-row">
        <div>
          <label>Passing Marks %</label>
          <input type="number" id="passingMarks" value="${config.passingMarks}" min="0" max="100" />
        </div>
        <div>
          <label>Shuffle Questions?</label>
          <select id="shuffleQ">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <label>Shuffle Options?</label>
          <select id="shuffleOpts">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div>
          <label>Marathi Translation?</label>
          <select id="enableMarathi">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
      </div>
      <label>Instructions (one per line)</label>
      <textarea id="instructions" rows="4" placeholder="Read all questions carefully.&#10;No negative marking.&#10;..."></textarea>
    </div>
  </div>
</div>

<div id="status"></div>
<button id="createBtn" onclick="createTest()">🚀 Create Test & Get Student Link</button>
<div class="spacer"></div>

<script>
var allData = ${chaptersJson};
var chapterNames = ${chaptersListJson};
var config = ${configJson};
var currentMode = 'random';
var selectedQuestions = {};
var currentDiff = 'all';
var currentTab = 'basic';

// ---- INIT ----
function init() {
  buildChapterList();
  setMode('random');
  document.getElementById('instituteName').value = config.instituteName || '';
  document.getElementById('instituteSubtitle').value = config.instituteSubtitle || '';
}

// ---- CHAPTER LIST ----
function buildChapterList() {
  var container = document.getElementById('chapterList');
  container.innerHTML = '';
  if (chapterNames.length === 0) {
    container.innerHTML = '<div style="color:#718096; text-align:center; padding:10px;">No subject sheets found.<br>Create sheets named like "Trade Theory", "WCS", etc.</div>';
    return;
  }
  chapterNames.forEach(function(name) {
    var count = allData[name] ? allData[name].length : 0;
    var div = document.createElement('div');
    div.className = 'chapter-item';
    div.innerHTML =
      '<div class="chapter-left">' +
        '<input type="checkbox" class="chap-cb" value="' + name + '" id="chk_' + name + '" onchange="onChapterChange()">' +
        '<label for="chk_' + name + '" class="chapter-name" style="cursor:pointer;margin:0;">' + name + '</label>' +
      '</div>' +
      '<span class="count-badge">' + count + ' Q</span>';
    div.onclick = function(e) {
      if (e.target.tagName !== 'INPUT') {
        var cb = this.querySelector('input');
        cb.checked = !cb.checked;
        onChapterChange();
      }
      updateChapterStyle(div, div.querySelector('input').checked);
    };
    div.querySelector('input').addEventListener('change', function() {
      updateChapterStyle(div, this.checked);
    });
    container.appendChild(div);
  });
}

function updateChapterStyle(div, checked) {
  div.classList.toggle('selected', checked);
}

function onChapterChange() {
  if (currentMode === 'custom') refreshQuestionList();
}

// ---- DIFFICULTY ----
function setPill(el, group) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  currentDiff = el.dataset.val;
  if (currentMode === 'custom') refreshQuestionList();
}

// ---- MODE ----
function setMode(mode) {
  currentMode = mode;
  document.getElementById('modeRandom').classList.toggle('on', mode === 'random');
  document.getElementById('modeCustom').classList.toggle('on', mode === 'custom');
  document.getElementById('randomSection').classList.toggle('hidden', mode !== 'random');
  document.getElementById('questionListSection').classList.toggle('hidden', mode !== 'custom');
  if (mode === 'custom') refreshQuestionList();
}

// ---- QUESTION LIST (CUSTOM) ----
function refreshQuestionList() {
  var selectedChapters = getSelectedChapters();
  var container = document.getElementById('questionList');
  container.innerHTML = '';
  selectedQuestions = {};
  updateSelCount();

  if (selectedChapters.length === 0) {
    container.innerHTML = '<div style="color:#718096; text-align:center; padding:16px;">← Select subjects above first</div>';
    return;
  }

  selectedChapters.forEach(function(chap) {
    var questions = allData[chap] || [];
    var filtered = questions.filter(q => currentDiff === 'all' || q.difficulty === currentDiff);
    if (filtered.length === 0) return;

    var header = document.createElement('div');
    header.className = 'q-chapter-header';
    header.innerHTML = '📖 ' + chap + ' <button class="sel-all-btn" onclick="selectAllInChap(event, \\'' + chap + '\\')">Select All</button>';
    container.appendChild(header);

    filtered.forEach(function(q, i) {
      var id = chap + '|||' + q.index;
      var item = document.createElement('div');
      item.className = 'q-item';
      item.id = 'qi_' + id;
      var hasImg = q.questionImage ? '🖼 ' : '';
      var diffClass = q.difficulty || 'medium';
      item.innerHTML =
        '<input type="checkbox" id="cb_' + id.replace(/\\|/g,'_') + '" onchange="toggleQ(\\'' + id + '\\', \\'' + chap + '\\', this.checked)" onclick="event.stopPropagation()">' +
        '<div style="flex:1">' +
          '<div class="q-text">' + hasImg + 'Q' + (i+1) + '. ' + truncate(q.question, 80) + '</div>' +
          '<div class="q-meta">' +
            '<span class="diff-pill ' + diffClass + '">' + diffClass + '</span>' +
            '<span class="pts">+' + q.points + ' pts' + (q.negativeMarks > 0 ? ' / -' + q.negativeMarks : '') + '</span>' +
          '</div>' +
        '</div>';
      item.onclick = function(e) {
        if (e.target.tagName !== 'INPUT') {
          var cb = this.querySelector('input');
          cb.checked = !cb.checked;
          toggleQ(id, chap, cb.checked);
        }
      };
      item.querySelector('input')._qdata = { chap, q };
      container.appendChild(item);
    });
  });
}

function toggleQ(id, chap, checked) {
  var cbId = 'cb_' + id.replace(/\\|/g,'_');
  var cb = document.getElementById(cbId);
  var q = cb ? cb._qdata.q : null;
  var item = document.getElementById('qi_' + id);
  if (checked && q) {
    selectedQuestions[id] = { chapter: chap, ...q };
    if (item) item.classList.add('on');
  } else {
    delete selectedQuestions[id];
    if (item) item.classList.remove('on');
  }
  if (cb) cb.checked = checked;
  updateSelCount();
}

function selectAllInChap(e, chap) {
  e.stopPropagation();
  var questions = allData[chap] || [];
  questions.filter(q => currentDiff === 'all' || q.difficulty === currentDiff).forEach(function(q) {
    var id = chap + '|||' + q.index;
    selectedQuestions[id] = { chapter: chap, ...q };
    var cbId = 'cb_' + id.replace(/\\|/g,'_');
    var cb = document.getElementById(cbId);
    if (cb) { cb.checked = true; cb._qdata = { chap, q }; }
    var item = document.getElementById('qi_' + id);
    if (item) item.classList.add('on');
  });
  updateSelCount();
}

function updateSelCount() {
  var count = Object.keys(selectedQuestions).length;
  document.getElementById('selectedCount').textContent = count;
}

function truncate(str, len) {
  return str && str.length > len ? str.substring(0, len) + '...' : str;
}

function getSelectedChapters() {
  return Array.from(document.querySelectorAll('.chap-cb:checked')).map(cb => cb.value);
}

// ---- TABS ----
function showTab(tab) {
  currentTab = tab;
  document.getElementById('tabBasic').classList.toggle('hidden', tab !== 'basic');
  document.getElementById('tabAdvanced').classList.toggle('hidden', tab !== 'advanced');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(function(t) {
    if ((tab === 'basic' && t.textContent === 'Basic') || (tab === 'advanced' && t.textContent === 'Advanced'))
      t.classList.add('on');
  });
}

// ---- CREATE TEST ----
function createTest() {
  var chapters = getSelectedChapters();
  if (chapters.length === 0) { showStatus('❌ Please select at least one subject/chapter!', 'error'); return; }

  var title = document.getElementById('quizTitle').value.trim();
  if (!title) { showStatus('❌ Please enter a test title!', 'error'); return; }

  var teacher = document.getElementById('teacherName').value.trim() || 'Unknown';
  var tradeClass = document.getElementById('tradeClass').value.trim() || '';
  var duration = parseInt(document.getElementById('duration').value) || 60;
  var instituteName = document.getElementById('instituteName').value.trim() || config.instituteName;
  var instituteSubtitle = document.getElementById('instituteSubtitle').value.trim() || config.instituteSubtitle;
  var passingMarks = parseInt(document.getElementById('passingMarks').value) || 40;
  var shuffle = document.getElementById('shuffleQ').value === 'yes';
  var shuffleOpts = document.getElementById('shuffleOpts').value === 'yes';
  var enableMarathi = document.getElementById('enableMarathi').value === 'yes';
  var instructionsRaw = document.getElementById('instructions').value.trim();
  var instructions = instructionsRaw ? instructionsRaw.split('\\n').filter(Boolean) : [];

  var questions = [];

  if (currentMode === 'custom') {
    questions = Object.values(selectedQuestions);
    if (questions.length === 0) { showStatus('❌ Please select at least one question!', 'error'); return; }
  } else {
    chapters.forEach(function(chap) {
      var qs = (allData[chap] || []).filter(q => currentDiff === 'all' || q.difficulty === currentDiff);
      qs.forEach(q => questions.push({ chapter: chap, ...q }));
    });
    if (shuffle) questions = questions.sort(() => Math.random() - 0.5);
    var limit = parseInt(document.getElementById('randomCount').value) || 0;
    if (limit > 0) questions = questions.slice(0, limit);
    if (questions.length === 0) { showStatus('❌ No questions found with these filters!', 'error'); return; }
  }

  showStatus('⏳ Creating your test... Please wait...', 'loading');
  document.getElementById('createBtn').disabled = true;

  google.script.run
    .withSuccessHandler(function(result) {
      showStatus(
        '✅ Test Created Successfully!\\n\\n' +
        '📋 ' + questions.length + ' questions | ⏱ ' + duration + ' min\\n\\n' +
        '🔗 Student Link (share this):\\n' + result.studentUrl + '\\n\\n' +
        'Students open this link to take the test. You can share via WhatsApp or print the QR code.',
        'success'
      );
      document.getElementById('createBtn').disabled = false;
    })
    .withFailureHandler(function(err) {
      showStatus('❌ Error: ' + err.message, 'error');
      document.getElementById('createBtn').disabled = false;
    })
    .createTestFromSidebar({
      title, teacher, tradeClass, chapters,
      mode: currentMode, difficulty: currentDiff,
      duration, instituteName, instituteSubtitle,
      passingMarks, shuffle, shuffleOpts, enableMarathi, instructions, questions
    });
}

function showStatus(msg, type) {
  var el = document.getElementById('status');
  el.style.display = 'block';
  el.className = 'status s-' + type;
  el.innerText = msg;
  el.scrollIntoView({ behavior: 'smooth' });
}

// INIT
init();
</script>
</body>
</html>`;
}

// ============ CREATE TEST (called from sidebar) ============
function createTestFromSidebar(params) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // ---- CHECK WEB APP URL IS SET ----
  var webAppUrl = getWebAppUrl();
  if (!webAppUrl) {
    throw new Error(
      'Web App URL not set yet!\n\n' +
      'Please do this ONCE:\n' +
      '1. Go to Extensions → Apps Script\n' +
      '2. Click Deploy → Manage Deployments\n' +
      '3. Copy the Web App URL (starts with https://script.google.com/macros/s/...)\n' +
      '4. In your spreadsheet go to menu: ITI Quiz System → ⚙️ Set Web App URL\n' +
      '5. Paste the URL and click OK\n\n' +
      'Then try creating the test again.'
    );
  }

  // Ensure TESTS sheet exists
  var testsSheet = spreadsheet.getSheetByName(TESTS_SHEET);
  if (!testsSheet) {
    testsSheet = spreadsheet.insertSheet(TESTS_SHEET);
    testsSheet.appendRow(['Test ID','Title','Teacher','Trade','Created','Duration','Questions','Student URL','Status']);
    testsSheet.getRange(1,1,1,9).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
    testsSheet.setFrozenRows(1);
  }

  // Generate unique test ID
  var testId = 'TEST_' + Date.now();

  // Store test data in spreadsheet sheet
  var testData = {
    testId: testId,
    title: params.title,
    teacher: params.teacher,
    tradeClass: params.tradeClass || '',
    instituteName: params.instituteName,
    instituteSubtitle: params.instituteSubtitle,
    duration: params.duration,
    passingMarks: params.passingMarks,
    shuffle: params.shuffle,
    shuffleOpts: params.shuffleOpts || false,
    enableMarathi: params.enableMarathi || false,
    instructions: params.instructions || [],
    questions: params.questions,
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  // Store test JSON directly in the spreadsheet (hidden sheet).
  // This works reliably from both the sidebar AND doGet() Web App context.
  // PropertiesService was intentionally avoided — it fails cross-context.
  var testJson = JSON.stringify(testData);
  var dataSheet = spreadsheet.getSheetByName('TEST_DATA');
  if (!dataSheet) {
    dataSheet = spreadsheet.insertSheet('TEST_DATA');
    dataSheet.hideSheet();
    dataSheet.appendRow(['Test ID', 'JSON Data', 'Created At']);
    dataSheet.getRange(1,1,1,3).setFontWeight('bold');
  }
  dataSheet.appendRow([testId, testJson, new Date().toISOString()]);

  // Build student URL using the saved Web App URL
  // Strip any trailing slash, then add the testId param
  var baseUrl = webAppUrl.replace(/\/$/, '');
  var studentUrl = baseUrl + '?testId=' + testId;

  // Log to ACTIVE TESTS sheet
  var now = new Date();
  testsSheet.appendRow([
    testId,
    params.title,
    params.teacher,
    params.tradeClass || '',
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    params.duration + ' min',
    params.questions.length,
    studentUrl,
    'Active'
  ]);

  // Also log to quiz log
  logTestCreation(testId, params, studentUrl);

  return { studentUrl: studentUrl, testId: testId };
}

function getTestData(testId) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var dataSheet = spreadsheet.getSheetByName('TEST_DATA');
    if (!dataSheet) return null;

    var data = dataSheet.getDataRange().getValues();
    // Row 0 is header. Search from row 1 downward. Use last match (newest version).
    var testJson = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === testId) {
        testJson = data[i][1].toString();
      }
    }
    if (!testJson) return null;
    var testData = JSON.parse(testJson);
    // Check live status from ACTIVE TESTS sheet (so teacher can deactivate anytime)
    var testsSheet = spreadsheet.getSheetByName('ACTIVE TESTS');
    if (testsSheet) {
      var rows = testsSheet.getDataRange().getValues();
      for (var j = 1; j < rows.length; j++) {
        if (rows[j][0] && rows[j][0].toString() === testId) {
          testData.status = rows[j][8] ? rows[j][8].toString() : 'Active';
          break;
        }
      }
    }
    return testData;
  } catch(e) {
    return null;
  }
}

// ============ WEB APP (Student Interface) ============
function doGet(e) {
  var params = e ? e.parameter : {};
  var testId = params.testId;

  if (!testId) {
    return HtmlService.createHtmlOutput('<h2 style="font-family:Arial;text-align:center;margin-top:50px;color:#e53e3e;">❌ No test ID provided. Please use the link given by your teacher.</h2>');
  }

  var testData = getTestData(testId);
  if (!testData) {
    return HtmlService.createHtmlOutput('<h2 style="font-family:Arial;text-align:center;margin-top:50px;color:#e53e3e;">❌ Test not found or expired. Please contact your teacher.</h2>');
  }

  if (testData.status === 'Inactive') {
    return HtmlService.createHtmlOutput('<h2 style="font-family:Arial;text-align:center;margin-top:50px;color:#e53e3e;">🚫 This test has been deactivated by your teacher.</h2>');
  }

  var html = buildStudentTestHtml(testData, testId);
  return HtmlService.createHtmlOutput(html)
    .setTitle(testData.title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============ SUBMIT RESULT ============
function submitTestResult(data) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var resultsSheet = spreadsheet.getSheetByName(RESULTS_SHEET);

  if (!resultsSheet) {
    resultsSheet = spreadsheet.insertSheet(RESULTS_SHEET);
    resultsSheet.appendRow(['Submission ID','Test ID','Test Title','Student Name','Roll No','Class','Trade','Submitted At','Score','Total Marks','Percentage','Status','Answers (JSON)']);
    resultsSheet.getRange(1,1,1,13).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
    resultsSheet.setFrozenRows(1);
  }

  var now = new Date();
  var submissionId = 'SUB_' + Date.now();

  resultsSheet.appendRow([
    submissionId,
    data.testId,
    data.testTitle,
    data.studentName,
    data.rollNo,
    data.className,
    data.trade,
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    data.score,
    data.totalMarks,
    data.percentage.toFixed(1) + '%',
    data.percentage >= data.passingMarks ? 'PASS' : 'FAIL',
    JSON.stringify(data.answers)
  ]);

  return { success: true, submissionId: submissionId };
}

// ============ UTILITY ============
function logTestCreation(testId, params, studentUrl) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = spreadsheet.getSheetByName(LOG_SHEET);
  if (!logSheet) {
    logSheet = spreadsheet.insertSheet(LOG_SHEET);
    logSheet.appendRow(['Date','Time','Teacher','Test Title','Trade','Chapters','Mode','Difficulty','Questions','Duration','Student URL']);
    logSheet.getRange(1,1,1,11).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }
  var now = new Date();
  logSheet.appendRow([
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss'),
    params.teacher, params.title, params.tradeClass,
    params.chapters.join(', '), params.mode, params.difficulty,
    params.questions.length, params.duration + ' min', studentUrl
  ]);
}

function viewLog() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = spreadsheet.getSheetByName(LOG_SHEET);
  if (!logSheet) { SpreadsheetApp.getUi().alert('No log found yet. Create a test first!'); return; }
  spreadsheet.setActiveSheet(logSheet);
}

function viewResults() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var resultsSheet = spreadsheet.getSheetByName(RESULTS_SHEET);
  if (!resultsSheet) { SpreadsheetApp.getUi().alert('No results found yet.'); return; }
  spreadsheet.setActiveSheet(resultsSheet);
}



function setupAllSheets() {
  setupLogSheet();
  setupTestsSheet();
  setupResultsSheet();
  setupConfigSheet();
  setupSampleSubjectSheet();
  SpreadsheetApp.getUi().alert(
    'All sheets set up!\n\n' +
    'NEXT STEPS (do in order):\n\n' +
    'STEP 1 - Deploy as Web App (if not done yet):\n' +
    '  Extensions > Apps Script > Deploy > New Deployment\n' +
    '  Type: Web App\n' +
    '  Execute as: Me\n' +
    '  Access: Anyone\n' +
    '  Copy the Web App URL shown\n\n' +
    'STEP 2 - Save the URL:\n' +
    '  In this spreadsheet menu:\n' +
    '  ITI Quiz System > Set Web App URL\n' +
    '  Paste the URL you copied\n\n' +
    'STEP 3 - Add your questions:\n' +
    '  Open the "Trade Theory" sheet to see the column format\n' +
    '  Create more sheets for other subjects\n\n' +
    'STEP 4 - Create a test:\n' +
    '  ITI Quiz System > Open Quiz Maker\n\n' +
    'Sheets created:\n' +
    '  CONFIG, Trade Theory (sample), QUIZ LOG, ACTIVE TESTS, RESULTS'
  );
}

function setupLogSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var s = spreadsheet.getSheetByName(LOG_SHEET);
  if (!s) s = spreadsheet.insertSheet(LOG_SHEET);
  s.clearContents();
  var headers = ['Date','Time','Teacher','Test Title','Trade','Chapters','Mode','Difficulty','Questions','Duration','Student URL'];
  s.appendRow(headers);
  s.getRange(1,1,1,headers.length).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
  s.setFrozenRows(1);
}

function setupTestsSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var s = spreadsheet.getSheetByName(TESTS_SHEET);
  if (!s) s = spreadsheet.insertSheet(TESTS_SHEET);
  s.clearContents();
  var headers = ['Test ID','Title','Teacher','Trade','Created','Duration','Questions','Student URL','Status'];
  s.appendRow(headers);
  s.getRange(1,1,1,headers.length).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
  s.setFrozenRows(1);
}

function setupResultsSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var s = spreadsheet.getSheetByName(RESULTS_SHEET);
  if (!s) s = spreadsheet.insertSheet(RESULTS_SHEET);
  s.clearContents();
  var headers = ['Submission ID','Test ID','Test Title','Student Name','Roll No','Class','Trade','Submitted At','Score','Total Marks','Percentage','Status','Answers (JSON)'];
  s.appendRow(headers);
  s.getRange(1,1,1,headers.length).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
  s.setFrozenRows(1);
}

function setupConfigSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var s = spreadsheet.getSheetByName(CONFIG_SHEET);
  if (!s) s = spreadsheet.insertSheet(CONFIG_SHEET);
  s.clearContents();
  s.appendRow(['Key','Value','Description']);
  s.getRange(1,1,1,3).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
  [
    ['instituteName', 'Government ITI', 'Name of your institute'],
    ['instituteSubtitle', 'Industrial Training Institute', 'City / Address / Subtitle'],
    ['logoUrl', '', 'Optional: Public Google Drive image URL for logo'],
    ['defaultDuration', '60', 'Default test duration in minutes'],
    ['passingMarks', '40', 'Passing percentage (0-100)'],
    ['webAppUrl', '', 'PASTE YOUR WEB APP URL HERE after deploying! Use menu: Set Web App URL'],
  ].forEach(row => s.appendRow(row));
  // Highlight the webAppUrl row so teacher notices it
  var lastRow = s.getLastRow();
  s.getRange(lastRow, 1, 1, 3).setBackground('#fff3cd').setFontWeight('bold');
  s.setFrozenRows(1);
  [150, 300, 300].forEach((w,i) => s.setColumnWidth(i+1, w));
}

function setupSampleSubjectSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var s = spreadsheet.getSheetByName('Trade Theory');
  if (s) return; // Don't overwrite existing
  s = spreadsheet.insertSheet('Trade Theory');

  var headers = [
    'Question Text',           // A - col 1
    'Question Image URL',      // B - col 2 (optional Drive URL)
    'Option A Text',           // C
    'Option A Image URL',      // D (optional)
    'Option B Text',           // E
    'Option B Image URL',      // F (optional)
    'Option C Text',           // G
    'Option C Image URL',      // H (optional)
    'Option D Text',           // I
    'Option D Image URL',      // J (optional)
    'Answer (A/B/C/D)',        // K
    'Difficulty (easy/medium/hard)', // L
    'Points',                  // M
    'Negative Marks',          // N
    'Explanation'              // O
  ];
  s.appendRow(headers);
  s.getRange(1,1,1,headers.length).setBackground('#1a56db').setFontColor('white').setFontWeight('bold').setWrap(true);
  s.setFrozenRows(1);

  // Sample questions
  s.appendRow([
    'What is the SI unit of electric current?', '',
    'Volt', '', 'Ampere', '', 'Ohm', '', 'Watt', '',
    'B', 'easy', 1, 0, 'Electric current is measured in Amperes (A). Named after André-Marie Ampère.'
  ]);
  s.appendRow([
    "Ohm's Law states that V = ?", '',
    'I/R', '', 'IR', '', 'I+R', '', 'I×R²', '',
    'B', 'medium', 1, 0.25, "Ohm's Law: V = IR, where V is voltage, I is current, R is resistance."
  ]);
  s.appendRow([
    'Which material is the best conductor of electricity?', '',
    'Iron', '', 'Copper', '', 'Aluminium', '', 'Silver', '',
    'D', 'medium', 2, 0.5, 'Silver is the best conductor but copper is most used due to cost.'
  ]);

  headers.forEach((h, i) => s.setColumnWidth(i+1, i === 0 || i === 2 || i === 4 || i === 6 || i === 8 ? 200 : 150));
}

function showSetupGuide() {
  var ui = SpreadsheetApp.getUi();
  ui.alert(
    '📋 SHEET SETUP GUIDE',
    'SUBJECT SHEETS (one per subject):\n' +
    'Name your sheets: Trade Theory, WCS, Employability Skills, Engineering Drawing\n\n' +
    'COLUMNS (in order):\n' +
    'A: Question Text\n' +
    'B: Question Image URL (Google Drive, optional)\n' +
    'C: Option A Text\n' +
    'D: Option A Image URL (optional)\n' +
    'E: Option B Text\n' +
    'F: Option B Image URL (optional)\n' +
    'G: Option C Text\n' +
    'H: Option C Image URL (optional)\n' +
    'I: Option D Text\n' +
    'J: Option D Image URL (optional)\n' +
    'K: Correct Answer (A, B, C, or D)\n' +
    'L: Difficulty (easy / medium / hard)\n' +
    'M: Points (e.g. 1 or 2)\n' +
    'N: Negative Marks (e.g. 0 or 0.25)\n' +
    'O: Explanation (shown after test)\n\n' +
    'For image questions, paste the Google Drive "Anyone with link" shareable URL.\n' +
    'The system auto-converts it to a direct image URL.\n\n' +
    'DEPLOYMENT:\n' +
    'Extensions → Apps Script → Deploy → New Deployment\n' +
    '→ Type: Web App\n' +
    '→ Execute as: Me\n' +
    '→ Who has access: Anyone\n' +
    'Then copy the Web App URL.',
    ui.ButtonSet.OK
  );
}













function showImageUploader() {
  var html = HtmlService.createHtmlOutput(
    '<form id="form">' +
    '<input type="file" name="file" accept="image/*" onchange="upload(this)">' +
    '<div id="status" style="margin-top:10px;font-family:sans-serif;font-size:12px;color:#1a56db;"></div>' +
    '</form>' +
    '<script>' +
    'function upload(el) {' +
    '  var file = el.files[0];' +
    '  var fr = new FileReader();' +
    '  document.getElementById("status").innerHTML = "⏳ Uploading image to Drive...";' +
    '  fr.onload = function(e) {' +
    '    var data = e.target.result.split(",")[1];' +
    '    google.script.run.withSuccessHandler(function(){google.script.host.close();}).handleFileUpload(data, file.name, file.type);' +
    '  };' +
    '  fr.readAsDataURL(file);' +
    '}' +
    '</script>'
  ).setWidth(300).setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(html, 'Upload Image');
}

function handleFileUpload(data, name, type) {
  var folderName = "QUIZ_IMAGES";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  var blob = Utilities.newBlob(Utilities.base64Decode(data), type, name);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Directly sets the direct-view link in your selected Excel cell
  var url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  SpreadsheetApp.getActiveRange().setValue(url);
}
