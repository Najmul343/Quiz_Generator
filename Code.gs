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
    .createMenu('Magic Quiz Generator')
    // --- Daily use ---
    .addItem('🎓 Open Quiz Maker', 'openQuizSidebar')
    .addItem('📊 View Results', 'viewResults')
    .addItem('📋 View Quiz Log', 'viewLog')
    .addItem('📈 Assessment Dashboard', 'openDashboard')
    .addItem('🏫 Principal Dashboard', 'openPrincipalDashboard')
    .addSeparator()
    // --- Question tools ---
    .addItem('📥 Import MCQs from PDF', 'openMcqParser')
    .addItem('🌐 Add Bilingual Translation to Sheet', 'openTranslator')
    .addItem('📤 Upload Image to Selected Cell', 'showImageUploader')
    .addSeparator()
    // --- Settings ---
    .addItem('🔑 Save Groq API Key', 'promptSaveGroqKey')
    .addItem('🔑 Open Gemini MCQ Parser', 'openGeminiPdfSidebar')
    .addItem('🏫 First Time Sheet Setup', 'openSetupWizard')
    .addItem('⚙️ Set Web App URL', 'promptSetWebAppUrl')
    .addItem('📖 Sheet Setup Guide', 'showSetupGuide')
    .addItem('🔧 Fix Results Sheet Columns', 'fixResultsHeaders')
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
  var ui = SpreadsheetApp.getUi();

  // ---- AUTO SETUP: Create system sheets silently if they don't exist yet ----
  var configSheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  if (!configSheet) {
    setupAllSheets();
    ui.alert(
      '✅ First-time setup complete!\n\n' +
      'System sheets have been created automatically.\n\n' +
      'ONE more step needed before creating tests:\n' +
      '1. Go to Extensions → Apps Script\n' +
      '2. Click Deploy → Manage Deployments\n' +
      '3. Create a New Deployment → Web App\n' +
      '   • Execute as: Me\n' +
      '   • Who has access: Anyone\n' +
      '4. Copy the Web App URL\n' +
      '5. Come back and go to: ITI Quiz System → ⚙️ Set Web App URL\n\n' +
      '(This is a one-time step. You will not see this message again.)'
    );
    return;
  }

  // ---- CHECK WEB APP URL — guide teacher if not set yet ----
  var webAppUrl = getWebAppUrl();
  if (!webAppUrl) {
    var result = ui.prompt(
      '⚙️ One-Time Setup — Web App URL Needed',
      'To create student test links, paste your Web App URL below.\n\n' +
      'How to get it (one time only):\n' +
      '1. Go to Extensions → Apps Script\n' +
      '2. Click Deploy → Manage Deployments\n' +
      '3. Copy the Web App URL (starts with https://script.google.com/macros/s/...)\n\n' +
      'Paste URL below:',
      ui.ButtonSet.OK_CANCEL
    );
    if (result.getSelectedButton() !== ui.Button.OK) return;
    var url = result.getResponseText().trim();
    if (!url || !url.startsWith('https://script.google.com')) {
      ui.alert('Invalid URL. Please try again from ITI Quiz System → ⚙️ Set Web App URL.');
      return;
    }
    saveWebAppUrl(url);
    ui.alert('✅ URL saved! Opening Quiz Maker now...');
  }

  var allSheets = spreadsheet.getSheets().map(s => s.getName());

  // Filter out system sheets
  var systemSheets = [LOG_SHEET, TESTS_SHEET, CONFIG_SHEET, RESULTS_SHEET, 'TEST_DATA'];
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
        explanation: row[14] ? row[14].toString() : '',
        // Bilingual columns (added by Translator.gs — cols P–T, indices 15–19)
        questionTr: row[15] ? row[15].toString() : '',
        optATr: row[16] ? row[16].toString() : '',
        optBTr: row[17] ? row[17].toString() : '',
        optCTr: row[18] ? row[18].toString() : '',
        optDTr: row[19] ? row[19].toString() : '',
        // Col U (index 20) — Explanation Image URL
        explanationImage: row[20] ? row[20].toString() : ''
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
      </div>
      <label>Instructions (one per line)</label>
      <textarea id="instructions" rows="4" placeholder="Read all questions carefully.&#10;No negative marking.&#10;..."></textarea>
      <div style="margin-top:12px;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;background:#fafafa;" id="fsBox">
        <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="toggleFs()">
          <input type="checkbox" id="forceFullscreen" style="width:16px;height:16px;accent-color:#1a56db;cursor:pointer;flex-shrink:0;" onclick="event.stopPropagation();toggleFs()">
          <div>
            <div style="font-size:12px;font-weight:700;color:#374151;">🔒 Force Fullscreen Mode</div>
            <div style="font-size:10.5px;color:#9ca3af;margin-top:1px;">Students must stay fullscreen. Exits are detected and logged as violations.</div>
          </div>
        </div>
      </div>
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

function toggleFs() {
  var chk = document.getElementById('forceFullscreen');
  chk.checked = !chk.checked;
  var box = document.getElementById('fsBox');
  box.style.borderColor = chk.checked ? '#1a56db' : '#e2e8f0';
  box.style.background  = chk.checked ? '#ebf2ff' : '#fafafa';
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
  var forceFullscreen = document.getElementById('forceFullscreen').checked;
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
      passingMarks, shuffle, shuffleOpts, forceFullscreen, instructions, questions
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
    forceFullscreen: params.forceFullscreen || false,
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

  // ── PRINCIPAL DASHBOARD ──
  if (params.view === 'principal') {
    var payload = getPrincipalDashboardData();
    var html = buildPrincipalDashboardHtml(payload);
    return HtmlService.createHtmlOutput(html)
      .setTitle('Principal Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

// ── PRACTICE MODE ──
if (params.mode === 'practice' && params.testId) {
  var testData = getTestData(params.testId);
  if (!testData) return HtmlService.createHtmlOutput('<h2>Test not found.</h2>');
  var html = buildPracticeTestHtml(testData, params.testId);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Practice: ' + testData.title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

//-------------------------------------------------------------------------------

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
    resultsSheet.appendRow(['Submission ID','Test ID','Test Title','Student Name','Roll No','Class','Trade','Submitted At','Score','Total Marks','Percentage','Status','FS Violations','Tab Switches','Answers (JSON)']);
    resultsSheet.getRange(1,1,1,15).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
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
    data.fsViolations || 0,
    data.tabViolations || 0,
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
  var headers = ['Submission ID','Test ID','Test Title','Student Name','Roll No','Class','Trade','Submitted At','Score','Total Marks','Percentage','Status','FS Violations','Tab Switches','Answers (JSON)'];
  s.appendRow(headers);
  s.getRange(1,1,1,headers.length).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');
  s.setFrozenRows(1);
}

// ---- ONE-TIME FIX: adds missing columns to existing RESULTS sheet without losing data ----
function fixResultsHeaders() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var s = spreadsheet.getSheetByName(RESULTS_SHEET);
  if (!s) { SpreadsheetApp.getUi().alert('RESULTS sheet not found.'); return; }

  var header = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];

  // Check if already fixed
  if (header.indexOf('FS Violations') !== -1) {
    SpreadsheetApp.getUi().alert('✅ RESULTS sheet already has the new columns. Nothing to fix!');
    return;
  }

  // Find where "Answers (JSON)" currently is — insert 2 cols before it
  var ansCol = header.indexOf('Answers (JSON)') + 1; // 1-based
  if (ansCol === 0) { SpreadsheetApp.getUi().alert('Could not find "Answers (JSON)" column.'); return; }

  s.insertColumnsBefore(ansCol, 2);
  s.getRange(1, ansCol).setValue('FS Violations');
  s.getRange(1, ansCol + 1).setValue('Tab Switches');
  s.getRange(1, 1, 1, s.getLastColumn()).setBackground('#1a56db').setFontColor('white').setFontWeight('bold');

  SpreadsheetApp.getUi().alert('✅ Done! "FS Violations" and "Tab Switches" columns added to RESULTS sheet.\n\nExisting data is untouched. New submissions will now populate these columns.');
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


// ── ACTIVE TESTS TAB — Toggle Status ──────────────────────
function toggleTestStatus(testId) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ACTIVE TESTS');
  if (!sheet) return { ok: false, error: 'ACTIVE TESTS sheet not found' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString() === testId) {
      var cur       = data[i][8] ? data[i][8].toString() : 'Active';
      var newStatus = cur === 'Active' ? 'Inactive' : 'Active';
      sheet.getRange(i + 1, 9).setValue(newStatus);
      // Update in-memory DB.tests array too (for dashboard refresh)
      return { ok: true, testId: testId, newStatus: newStatus };
    }
  }
  return { ok: false, error: 'Test not found' };
}




// ============ ADD THIS FUNCTION TO Code.gs ============
// Lightweight practice log — called ONCE at end of practice session only.
// No answers stored, just summary data. Zero server calls during practice.

function logPracticeResult(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PRACTICE LOG');

  if (!sheet) {
    sheet = ss.insertSheet('PRACTICE LOG');
    sheet.appendRow([
      'Submitted At', 'Test ID', 'Test Title', 'Student Name',
      'Roll No', 'Class', 'Trade',
      'Score', 'Total Marks', 'Percentage', 'Result', 'Attempted'
    ]);
    sheet.getRange(1, 1, 1, 12)
      .setBackground('#059669')
      .setFontColor('white')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    data.testId      || '',
    data.testTitle   || '',
    data.name        || '',
    data.rollNo      || '',
    '',
    '',
    data.score,
    data.totalMarks,
    data.percent     + '%',
    data.passed ? 'PASS' : 'FAIL',
    data.attempted   || 0
  ]);

  return { success: true };
}

//add practice test results to sheet as log

























// ============ STUDENT PRACTICE HTML ============
// This function handles the "Practice Mode" interface.
// Triggered via doGet when ?mode=practice is in the URL.

//  (WITH RESUME) ============ //
function buildPracticeTestHtml(testData, testId) {
  var questionsJson = JSON.stringify(testData.questions);
  var testInfoJson = JSON.stringify({
    testId: testId,
    title: testData.title,
    teacher: testData.teacher,
    tradeClass: testData.tradeClass || '',
    instituteName: testData.instituteName || 'ITI',
    instituteSubtitle: testData.instituteSubtitle || '',
    duration: testData.duration || 60,
    passingMarks: testData.passingMarks || 40,
    shuffle: testData.shuffle || false,
    shuffleOpts: testData.shuffleOpts || false,
    forceFullscreen: testData.forceFullscreen || false,
    instructions: testData.instructions || []
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>ITI Practice Test</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<style>
/* ===== CSS STYLES (SAME AS BEFORE) ===== */
/* (Omitting full CSS for brevity - assume it is identical to the previous version provided) */
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: 'Segoe UI', Arial, sans-serif; background: #eef2f7; color: #1a202c; }
button { cursor: pointer; font-family: inherit; }
.screen { display: none; min-height: 100vh; }
.screen.active { display: flex; flex-direction: column; }
#welcomeScreen { background: linear-gradient(135deg, #0d2f7e 0%, #1a56db 50%, #2563eb 100%); align-items: center; justify-content: center; padding: 20px; }
.welcome-card { background: white; border-radius: 20px; padding: 36px 40px; max-width: 580px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: fadeUp 0.5s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
.inst-header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
.inst-name { font-size: 22px; font-weight: 800; color: #1a56db; line-height: 1.2; }
.inst-sub { font-size: 13px; color: #718096; margin-top: 4px; }
.test-title-display { font-size: 18px; font-weight: 700; color: #1a202c; margin-top: 14px; }
.test-meta { display: flex; justify-content: center; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
.meta-chip { display: flex; align-items: center; gap: 5px; background: #f0f5ff; color: #1a56db; border-radius: 20px; padding: 5px 12px; font-size: 12px; font-weight: 600; }
.instructions-box { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
.instructions-box h3 { font-size: 13px; font-weight: 700; color: #92400e; margin-bottom: 8px; }
.instructions-box ol { padding-left: 18px; }
.instructions-box li { font-size: 12px; color: #78350f; margin-bottom: 5px; line-height: 1.5; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group.full { grid-column: 1 / -1; }
.form-group label { font-size: 11px; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.4px; }
.form-group input { padding: 9px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; transition: border 0.15s; }
.form-group input:focus { border-color: #1a56db; outline: none; }
.start-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #1a56db, #0d3b9e); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 10px; }
.resume-btn { width: 100%; padding: 15px; background: #22c55e; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 10px; }
.resume-btn:hover { background: #16a34a; }
.clear-data-btn { background: none; border: none; color: #ef4444; font-size: 11px; text-decoration: underline; margin-top: 8px; cursor: pointer; display: none; }
/* Test Screen Styles (Same as before) */
#testScreen { display: none; flex-direction: row; height: 100vh; overflow: hidden; }
#testScreen.active { display: flex; }
.top-bar { position: fixed; top: 0; left: 0; right: 0; background: #1a56db; color: white; height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 200; }
.tb-title { font-size: 14px; font-weight: 700; }
.tb-subtitle { font-size: 11px; opacity: 0.8; }
.timer-display { background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 5px 14px; font-size: 18px; font-weight: 800; min-width: 100px; text-align: center; }
.submit-btn-top { background: #22c55e; color: white; border: none; border-radius: 8px; padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
.test-body { display: flex; width: 100%; margin-top: 54px; height: calc(100vh - 54px); overflow: hidden; }
.question-area { flex: 1; overflow-y: auto; padding: 20px 24px 100px 24px; background: #f5f7fa; }
.q-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.q-number { font-size: 13px; color: #718096; font-weight: 600; }
.q-diff-badge { font-size: 10px; padding: 2px 10px; border-radius: 10px; font-weight: 700; text-transform: uppercase; }
.b-easy { background: #def7ec; color: #03543f; }
.b-medium { background: #fef3c7; color: #92400e; }
.b-hard { background: #fde8e8; color: #9b1c1c; }
.question-card { background: white; border-radius: 12px; padding: 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 16px; }
.q-text { font-size: 15px; line-height: 1.7; color: #1a202c; font-weight: 500; margin-bottom: 6px; }
.q-image { max-width: 100%; max-height: 300px; border-radius: 8px; margin: 12px 0; border: 1px solid #e2e8f0; display: block; }
.options-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.option-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer; background: white; transition: all 0.15s; }
.option-item:hover { border-color: #1a56db; background: #f0f5ff; }
.option-item.selected { border-color: #1a56db; background: #ebf2ff; }
.option-item.correct-ans { background: #def7ec !important; border-color: #22c55e !important; color: #03543f; }
.option-item.wrong-ans { background: #fde8e8 !important; border-color: #ef4444 !important; color: #9b1c1c; }
.option-item.disabled { cursor: default; }
.opt-letter { width: 32px; height: 32px; border: 2px solid #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #4a5568; flex-shrink: 0; }
.option-item.selected .opt-letter { background: #1a56db; border-color: #1a56db; color: white; }
.option-item.correct-ans .opt-letter { background: #22c55e; border-color: #22c55e; color: white; }
.option-item.wrong-ans .opt-letter { background: #ef4444; border-color: #ef4444; color: white; }
.opt-content { flex: 1; }
.opt-text { font-size: 14px; line-height: 1.5; color: #2d3748; }
.opt-image { max-width: 100%; max-height: 150px; border-radius: 6px; margin-top: 8px; border: 1px solid #e2e8f0; display: block; }
.practice-explanation { font-size: 13px; color: #4a5568; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 16px; margin-top: 20px; line-height: 1.6; display: none; animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.q-nav { position: fixed; bottom: 0; left: 0; right: 320px; background: white; border-top: 1px solid #e2e8f0; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 100; }
.nav-btn { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border: 2px solid transparent; transition: all 0.15s; }
.nav-prev { background: white; border-color: #e2e8f0; color: #4a5568; }
.nav-next { background: #1a56db; color: white; }
.nav-review { background: white; border-color: #9f7aea; color: #9f7aea; font-size: 12px; padding: 9px 14px; }
.nav-review.marked { background: #9f7aea; color: white; }
.nav-clear { background: white; border-color: #fc8181; color: #e53e3e; }
.center-nav { display: flex; gap: 8px; }
.side-panel { width: 320px; background: white; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
.side-header { background: #f7f9fc; border-bottom: 1px solid #e2e8f0; padding: 14px 16px; }
.palette-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }
.section-label { font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 6px 0; }
.q-palette { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.q-btn { width: 36px; height: 36px; border: none; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.1s; position: relative; }
.q-btn.not-visited { background: #e2e8f0; color: #4a5568; border: 1px solid #cbd5e0; }
.q-btn.not-answered { background: #fc8181; color: white; }
.q-btn.answered { background: #48bb78; color: white; }
.q-btn.marked { background: #9f7aea; color: white; border-radius: 50%; }
.q-btn.answered-marked { background: linear-gradient(135deg, #48bb78, #9f7aea); color: white; border-radius: 50%; }
.q-btn.current { box-shadow: 0 0 0 3px #1a56db, 0 0 0 5px rgba(26,86,219,0.3); z-index: 1; }
.stat-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #f7f9fc; }
.stat-box { text-align: center; }
.stat-num { font-size: 18px; font-weight: 800; }
.stat-lbl { font-size: 10px; color: #718096; text-transform: uppercase; font-weight: 600; }
.s-green { color: #22c55e; }
.s-red { color: #ef4444; }
.s-gray { color: #6b7280; }
/* Result Screen */
#resultScreen { background: #f0f4f8; align-items: center; justify-content: flex-start; padding: 30px 20px; overflow-y: auto; }
.result-card { background: white; border-radius: 20px; max-width: 700px; width: 100%; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); animation: fadeUp 0.5s ease; }
.result-header { background: linear-gradient(135deg, #1a56db, #0d3b9e); color: white; padding: 30px; text-align: center; }
.result-title { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
.result-subtitle { font-size: 13px; opacity: 0.8; }
.score-circle-wrap { margin: 24px 0; display: flex; justify-content: center; }
.score-circle { width: 140px; height: 140px; border-radius: 50%; border: 8px solid rgba(255,255,255,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.sc-pct { font-size: 34px; font-weight: 900; }
.sc-label { font-size: 12px; opacity: 0.8; font-weight: 600; }
.pass-badge { display: inline-block; padding: 6px 24px; border-radius: 20px; font-size: 15px; font-weight: 800; letter-spacing: 1px; }
.pass-badge.pass { background: #22c55e; }
.pass-badge.fail { background: #ef4444; }
.score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e2e8f0; margin: 0; }
.score-box { background: white; padding: 18px 12px; text-align: center; }
.sb-num { font-size: 22px; font-weight: 800; color: #1a56db; }
.sb-lbl { font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; margin-top: 3px; }
.done-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #1a56db, #0d3b9e); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; margin: 16px 0; cursor: pointer; }
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 500; align-items: center; justify-content: center; }
.modal-overlay.show { display: flex; }
.modal { background: white; border-radius: 16px; padding: 28px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: fadeUp 0.3s ease; }
.modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.modal p { font-size: 14px; color: #4a5568; margin-bottom: 6px; line-height: 1.6; }
.modal-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
.modal-stat { text-align: center; background: #f7f9fc; border-radius: 8px; padding: 10px; }
.modal-stat .n { font-size: 20px; font-weight: 800; }
.modal-stat .l { font-size: 11px; color: #718096; }
.modal-btns { display: flex; gap: 10px; margin-top: 16px; }
.modal-cancel { flex: 1; padding: 12px; background: white; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 600; color: #4a5568; cursor: pointer; }
.modal-confirm { flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; color: white; cursor: pointer; }
@media (max-width: 768px) {
  .welcome-card { padding: 20px 16px; }
  .form-grid { grid-template-columns: 1fr; }
  .top-bar { height: 48px; }
  .test-body { margin-top: 48px; }
  .side-panel { display: none; }
  .q-nav { right: 0; }
  .score-grid { grid-template-columns: 1fr 1fr; }
}
</style>
</head>
<body>
<!-- WELCOME SCREEN -->
<div id="welcomeScreen" class="screen active">
  <div class="welcome-card">
    <div class="inst-header">
      <div class="inst-name" id="instName">ITI</div>
      <div class="inst-sub" id="instSub"></div>
      <div class="test-title-display" id="testTitleDisplay">Loading...</div>
      <div class="test-meta" id="testMeta"></div>
    </div>
    <div class="instructions-box">
      <h3>💡 Practice Mode Rules</h3>
      <ol id="instructionsList">
        <li>This is a Practice Test. You get <b>instant feedback</b> after every answer.</li>
        <li>Once an option is selected, it is locked.</li>
        <li>Read the explanation provided immediately after answering.</li>
        <li>Click "Finish Practice" at the end to see your summary.</li>
      </ol>
    </div>
    
    <!-- Resume Section -->
    <div id="resumeSection" style="display:none; margin-bottom: 20px; text-align: center;">
        <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; border-radius: 10px;">
            <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 5px;">🟢 Previous Session Found</div>
            <div style="font-size: 12px; color: #15803d; margin-bottom: 10px;">You have an unfinished practice session.</div>
            <button class="resume-btn" onclick="resumeTest()">▶ Resume Previous Test</button>
            <br>
            <button class="clear-data-btn" id="clearDataBtn" onclick="clearSavedProgress()">Start Fresh (Clear Data)</button>
        </div>
    </div>

    <div id="startSection">
        <div class="form-grid">
            <div class="form-group full">
            <label>Full Name *</label>
            <input type="text" id="studentName" placeholder="Enter your full name" />
            </div>
            <div class="form-group">
            <label>Roll Number *</label>
            <input type="text" id="rollNo" placeholder="e.g. 2024001" />
            </div>
            <div class="form-group">
            <label>Class / Semester</label>
            <input type="text" id="className" placeholder="e.g. Sem 1" />
            </div>
            <div class="form-group full">
            <label>Trade</label>
            <input type="text" id="tradeName" placeholder="e.g. Electrician" />
            </div>
        </div>
        <button class="start-btn" onclick="startTest()">▶ Start Practice</button>
    </div>
  </div>
</div>

<!-- TEST SCREEN (Same as before) -->
<div id="testScreen" class="screen">
    <div class="top-bar">
      <div class="top-bar-left">
        <div class="tb-title" id="topTestTitle">ITI Practice Test</div>
        <div class="tb-subtitle" id="topStudentName">Student</div>
      </div>
      <div class="top-bar-center">
        <span style="font-size:13px;opacity:0.8;">⏱</span>
        <div class="timer-display" id="timerDisplay">60:00</div>
      </div>
      <div class="top-bar-right">
        <button class="submit-btn-top" onclick="confirmSubmit()">Finish Practice ✓</button>
      </div>
    </div>
    <div class="test-body">
      <div class="question-area" id="questionArea">
        <div class="q-header">
          <div class="q-number" id="qNumber">Question 1 of 25</div>
          <div class="q-diff-badge b-medium" id="qDiffBadge">Medium</div>
        </div>
        <div class="question-card">
          <div class="q-text" id="qText"></div>
          <img class="q-image" id="qImage" src="" style="display:none;" alt="Question Image" />
          <div class="options-grid" id="optionsGrid"></div>
          <div class="practice-explanation" id="practiceExp"></div>
        </div>
        <div class="q-nav">
          <button class="nav-btn nav-prev" onclick="navigate(-1)">◀ Previous</button>
          <div class="center-nav">
            <button class="nav-btn nav-clear" id="clearBtn" onclick="clearAnswer()">✕ Clear</button>
            <button class="nav-btn nav-review" id="reviewBtn" onclick="toggleReview()">⚑ Mark Review</button>
          </div>
          <button class="nav-btn nav-next" onclick="navigate(1)">Next ▶</button>
        </div>
      </div>
      <div class="side-panel">
        <div class="side-header"><h3>📊 Question Palette</h3></div>
        <div class="palette-scroll" id="paletteScroll"></div>
        <div class="stat-row">
            <div class="stat-box"><div class="stat-num s-green" id="statAnswered">0</div><div class="stat-lbl">Answered</div></div>
            <div class="stat-box"><div class="stat-num s-red" id="statNotAnswered">0</div><div class="stat-lbl">Not Ans.</div></div>
            <div class="stat-box"><div class="stat-num s-gray" id="statMarked">0</div><div class="stat-lbl">Review</div></div>
        </div>
      </div>
    </div>
</div>

<!-- RESULT SCREEN -->
<div id="resultScreen" class="screen">
  <div class="result-card">
    <div class="result-header">
      <div class="result-title" id="resTestTitle">Practice Results</div>
      <div class="result-subtitle" id="resStudentInfo">Student Name</div>
      <div class="score-circle-wrap">
        <div class="score-circle">
          <div class="sc-pct" id="resPercent">0%</div>
          <div class="sc-label">Score</div>
        </div>
      </div>
      <div id="resPassBadge" class="pass-badge pass">PASS</div>
    </div>
    <div class="score-grid">
      <div class="score-box"><div class="sb-num" id="resScore">0</div><div class="sb-lbl">Score</div></div>
      <div class="score-box"><div class="sb-num" id="resTotal">0</div><div class="sb-lbl">Total Marks</div></div>
      <div class="score-box"><div class="sb-num s-green" id="resCorrect">0</div><div class="sb-lbl">Correct</div></div>
      <div class="score-box"><div class="sb-num s-red" id="resWrong">0</div><div class="sb-lbl">Wrong</div></div>
    </div>
    <div class="review-section">
      <button class="done-btn" id="doneBtn" onclick="window.close()">✓ Done — Close Window</button>
      <button class="done-btn" onclick="window.print()" style="background:linear-gradient(135deg,#059669,#047857);margin-top:10px;">🖨️ Print / Save as PDF</button>
      <div class="review-title">📝 Answer Review</div>
      <div id="answerReview"></div>
    </div>
  </div>
</div>

<!-- MODAL -->
<div class="modal-overlay" id="confirmModal">
    <div class="modal">
      <h3>📤 Finish Practice?</h3>
      <p>Are you sure you want to end your session?</p>
      <div class="modal-stats">
        <div class="modal-stat"><div class="n s-green" id="mAnswered">0</div><div class="l">Answered</div></div>
        <div class="modal-stat"><div class="n s-red" id="mNotAnswered">0</div><div class="l">Not Answered</div></div>
        <div class="modal-stat"><div class="n s-gray" id="mMarked">0</div><div class="l">Marked</div></div>
        <div class="modal-stat"><div class="n" id="mTotal">0</div><div class="l">Total</div></div>
      </div>
      <div class="modal-btns">
        <button class="modal-cancel" onclick="closeModal()">◀ Continue</button>
        <button class="modal-confirm" onclick="submitTest()">Finish ✓</button>
      </div>
    </div>
</div>

<script>
var questions = ${questionsJson};
var testInfo = ${testInfoJson};
// UNIQUE KEY FOR LOCAL STORAGE
var STORAGE_KEY = 'iti_practice_' + testInfo.testId;

var studentInfo = {};
var currentQ = 0;
var answers = {};
var visited = {};
var markedReview = {};
var timerInterval = null;
var timeLeft = testInfo.duration * 60;
var testStarted = false;
var testSubmitted = false;

function initWelcomeScreen() {
    document.getElementById('instName').textContent = testInfo.instituteName || 'ITI';
    document.getElementById('instSub').textContent = testInfo.instituteSubtitle || '';
    document.getElementById('testTitleDisplay').textContent = testInfo.title || 'Practice Test';
    var meta = document.getElementById('testMeta');
    meta.innerHTML = '<div class="meta-chip">⏱ ' + testInfo.duration + ' min</div>' + '<div class="meta-chip">📝 ' + questions.length + ' Questions</div>';
    
    // CHECK FOR SAVED PROGRESS
    checkSavedProgress();
}

function checkSavedProgress() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            var data = JSON.parse(saved);
            // If we have answers, show resume section
            if (data.answers && Object.keys(data.answers).length > 0) {
                document.getElementById('resumeSection').style.display = 'block';
                document.getElementById('startSection').style.display = 'none';
                document.getElementById('clearDataBtn').style.display = 'inline-block';
            } else {
                // Empty save, just clear it
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch(e) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

function clearSavedProgress() {
    if(confirm("Are you sure? This will delete your saved answers.")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

function saveProgress() {
    var data = {
        answers: answers,
        currentQ: currentQ,
        visited: visited,
        markedReview: markedReview,
        studentInfo: studentInfo,
        timeLeft: timeLeft,
        // Save questions to ensure exact shuffle/order is restored
        questions: questions 
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resumeTest() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    
    try {
        var data = JSON.parse(saved);
        
        // Restore basic state
        answers = data.answers || {};
        visited = data.visited || {};
        markedReview = data.markedReview || {};
        currentQ = data.currentQ || 0;
        studentInfo = data.studentInfo || {};
        timeLeft = data.timeLeft || (testInfo.duration * 60);
        
        // Restore questions array (CRITICAL for shuffle consistency)
        if (data.questions) {
            questions = data.questions;
        }
        
        // Fill form fields
        document.getElementById('studentName').value = studentInfo.name || '';
        document.getElementById('rollNo').value = studentInfo.rollNo || '';
        document.getElementById('className').value = studentInfo.className || '';
        document.getElementById('tradeName').value = studentInfo.trade || '';
        
        // Start the test UI
        startTestFromState();
        
    } catch (e) {
        console.error("Resume failed", e);
        alert("Error resuming test. Starting fresh.");
        localStorage.removeItem(STORAGE_KEY);
    }
}

function startTest() {
    var name = document.getElementById('studentName').value.trim();
    var roll = document.getElementById('rollNo').value.trim();
    if (!name || !roll) { alert('Please enter Name and Roll Number!'); return; }
    
    studentInfo = { name: name, rollNo: roll, className: document.getElementById('className').value.trim(), trade: document.getElementById('tradeName').value.trim() };
    
    // Standard shuffle logic
    var chapMap = {}; var chapOrder = [];
    questions.forEach(function(q) { var chap = q.chapter || 'Questions'; if (!chapMap[chap]) { chapMap[chap] = []; chapOrder.push(chap); } chapMap[chap].push(q); });
    if (testInfo.shuffle) { chapOrder.forEach(function(chap) { chapMap[chap].sort(() => Math.random() - 0.5); }); }
    questions = []; chapOrder.forEach(function(chap) { chapMap[chap].forEach(q => questions.push(q)); });
    questions.forEach((q, i) => { q._origIdx = i; });
    
    startTestFromState();
}

function startTestFromState() {
    showScreen('testScreen');
    document.getElementById('topTestTitle').textContent = testInfo.title + ' (Practice)';
    document.getElementById('topStudentName').textContent = studentInfo.name + ' | Roll: ' + studentInfo.rollNo;
    
    buildPalette();
    showQuestion(currentQ);
    startTimer();
    testStarted = true;
    
    // Initial Save
    saveProgress();
}

// TIMER & NAV (Same as before, added saveProgress calls)
function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(function() {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) { clearInterval(timerInterval); autoSubmit(); }
    }, 1000);
}
function updateTimerDisplay() {
    var m = Math.floor(timeLeft / 60); var s = timeLeft % 60;
    document.getElementById('timerDisplay').textContent = (m<10?'0'+m:m) + ':' + (s<10?'0'+s:s);
}
function autoSubmit() { alert('Time is up!'); submitTest(); }

function showQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    currentQ = index;
    visited[index] = true;
    var q = questions[index];
    var origIdx = q._origIdx;
    
    document.getElementById('qNumber').textContent = 'Question ' + (index + 1) + ' of ' + questions.length;
    var badge = document.getElementById('qDiffBadge');
    badge.textContent = capitalize(q.difficulty || 'medium');
    badge.className = 'q-diff-badge b-' + (q.difficulty || 'medium');
    
    document.getElementById('qText').textContent = q.question;
    var qImg = document.getElementById('qImage');
    if (q.questionImage) { qImg.src = convertDriveUrl(q.questionImage); qImg.style.display = 'block'; } 
    else { qImg.style.display = 'none'; }
    
    var grid = document.getElementById('optionsGrid');
    grid.innerHTML = '';
    var opts = [
        { letter: 'A', text: q.optA, img: q.optAImage },
        { letter: 'B', text: q.optB, img: q.optBImage },
        { letter: 'C', text: q.optC, img: q.optCImage },
        { letter: 'D', text: q.optD, img: q.optDImage }
    ];
    
    if (testInfo.shuffleOpts) {
        if (!q._so) q._so = [0,1,2,3].sort(() => Math.random() - 0.5);
        opts = q._so.map(i => opts[i]);
    }
    
    var userAns = answers[origIdx];
    opts.forEach(function(opt, displayPos) {
        if (!opt.text && !opt.img) return;
        var item = document.createElement('div');
        item.className = 'option-item';
        if (userAns) {
            item.classList.add('disabled');
            if (opt.letter === q.answer) item.classList.add('correct-ans');
            if (opt.letter === userAns && userAns !== q.answer) item.classList.add('wrong-ans');
            if (opt.letter === userAns) item.classList.add('selected');
        } else {
            item.onclick = (function(idx, lettr) { return function() { selectAnswer(idx, lettr); }; })(index, opt.letter);
        }
        var label = testInfo.shuffleOpts ? String.fromCharCode(65 + displayPos) : opt.letter;
        item.innerHTML = '<div class="opt-letter">' + label + '</div><div class="opt-content"><div class="opt-text">' + escHtml(opt.text || '') + '</div>' + (opt.img ? '<img class="opt-image" src="'+convertDriveUrl(opt.img)+'" />' : '') + '</div>';
        grid.appendChild(item);
    });
    
    var expBox = document.getElementById('practiceExp');
    if (userAns) {
        expBox.innerHTML = '<b>💡 Explanation:</b> ' + escHtml(q.explanation || 'No explanation provided.');
        expBox.style.display = 'block';
        document.getElementById('clearBtn').style.display = 'block';
    } else {
        expBox.style.display = 'none';
        document.getElementById('clearBtn').style.display = 'none';
    }
    document.getElementById('reviewBtn').classList.toggle('marked', !!markedReview[index]);
    updatePalette();
    updateStats();
}

function selectAnswer(qIndex, letter) {
    var origIdx = questions[qIndex]._origIdx;
    answers[origIdx] = letter;
    showQuestion(qIndex);
    saveProgress(); // SAVE AFTER ANSWER
}

function clearAnswer() {
    var origIdx = questions[currentQ]._origIdx;
    delete answers[origIdx];
    showQuestion(currentQ);
    saveProgress();
}

function toggleReview() {
    if (markedReview[currentQ]) delete markedReview[currentQ];
    else markedReview[currentQ] = true;
    document.getElementById('reviewBtn').classList.toggle('marked', !!markedReview[currentQ]);
    updatePalette();
    updateStats();
    saveProgress(); // SAVE AFTER REVIEW
}

function navigate(dir) {
    var currentChap = questions[currentQ].chapter || 'Questions';
    var chapIndices = [];
    questions.forEach((q, i) => { if ((q.chapter || 'Questions') === currentChap) chapIndices.push(i); });
    var pos = chapIndices.indexOf(currentQ);
    var next = pos + dir;
    if (next >= 0 && next < chapIndices.length) showQuestion(chapIndices[next]);
    else if (dir === 1 && currentQ < questions.length - 1) showQuestion(currentQ + 1);
    else if (dir === -1 && currentQ > 0) showQuestion(currentQ - 1);
    
    saveProgress(); // SAVE AFTER NAVIGATION
}

function buildPalette() {
    var scroll = document.getElementById('paletteScroll');
    scroll.innerHTML = '';
    var chapters = {}; var chapOrder = [];
    questions.forEach((q, i) => { var chap = q.chapter || 'Questions'; if (!chapters[chap]) { chapters[chap] = []; chapOrder.push(chap); } chapters[chap].push(i); });
    chapOrder.forEach(chap => {
        var label = document.createElement('div'); label.className = 'section-label'; label.textContent = chap; scroll.appendChild(label);
        var palette = document.createElement('div'); palette.className = 'q-palette';
        chapters[chap].forEach((qi, pos) => {
            var btn = document.createElement('button');
            btn.className = 'q-btn not-visited'; btn.id = 'qbtn_' + qi; btn.textContent = pos + 1;
            btn.onclick = () => { showQuestion(qi); saveProgress(); }; // SAVE ON PALETTE CLICK
            palette.appendChild(btn);
        });
        scroll.appendChild(palette);
    });
}

function updatePalette() {
    questions.forEach((q, i) => {
        var btn = document.getElementById('qbtn_' + i);
        if (!btn) return;
        btn.className = 'q-btn';
        var ans = answers[q._origIdx];
        var mark = markedReview[i];
        var vis = visited[i];
        if (ans && mark) btn.classList.add('answered-marked');
        else if (ans) btn.classList.add('answered');
        else if (mark) btn.classList.add('marked');
        else if (vis) btn.classList.add('not-answered');
        else btn.classList.add('not-visited');
        if (i === currentQ) btn.classList.add('current');
    });
}

function updateStats() {
    var ans = Object.keys(answers).length;
    var mark = Object.keys(markedReview).length;
    var nAns = questions.filter((q, i) => visited[i] && !answers[q._origIdx]).length;
    document.getElementById('statAnswered').textContent = ans;
    document.getElementById('statNotAnswered').textContent = nAns;
    document.getElementById('statMarked').textContent = mark;
}

function confirmSubmit() {
    var ans = Object.keys(answers).length;
    document.getElementById('mAnswered').textContent = ans;
    document.getElementById('mNotAnswered').textContent = questions.length - ans;
    document.getElementById('mMarked').textContent = Object.keys(markedReview).length;
    document.getElementById('mTotal').textContent = questions.length;
    document.getElementById('confirmModal').classList.add('show');
}
function closeModal() { document.getElementById('confirmModal').classList.remove('show'); }

function submitTest() {
    if (testSubmitted) return;
    testSubmitted = true;
    clearInterval(timerInterval);
    closeModal();
    
    // CLEAR SAVED PROGRESS ON SUBMIT
    localStorage.removeItem(STORAGE_KEY);

    var score = 0; var totalMarks = 0; var correct = 0; var wrong = 0;
    questions.forEach(q => {
        var pts = q.points || 1; var neg = q.negativeMarks || 0;
        totalMarks += pts;
        var userAns = answers[q._origIdx];
        if (userAns) {
            if (userAns === q.answer) { score += pts; correct++; }
            else { score -= neg; wrong++; }
        }
    });
    if (score < 0) score = 0;
    var pct = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
    var passed = pct >= testInfo.passingMarks;

    var practiceData = {
        testId: testInfo.testId, testTitle: testInfo.title,
        name: studentInfo.name, rollNo: studentInfo.rollNo,
        score: score, totalMarks: totalMarks, percent: pct.toFixed(1),
        passed: passed, attempted: Object.keys(answers).length
    };
    google.script.run.logPracticeResult(practiceData);
    showResultScreen(score, totalMarks, pct, passed, correct, wrong);
}

function showResultScreen(score, totalMarks, pct, passed, correct, wrong) {
    showScreen('resultScreen');
    document.getElementById('resTestTitle').textContent = testInfo.title + ' (Practice)';
    document.getElementById('resStudentInfo').textContent = studentInfo.name + ' | Roll: ' + studentInfo.rollNo;
    document.getElementById('resPercent').textContent = pct.toFixed(1) + '%';
    document.getElementById('resScore').textContent = score.toFixed(1);
    document.getElementById('resTotal').textContent = totalMarks;
    document.getElementById('resCorrect').textContent = correct;
    document.getElementById('resWrong').textContent = wrong;
    var badge = document.getElementById('resPassBadge');
    badge.textContent = passed ? '✓ PASS' : '✗ FAIL';
    badge.className = 'pass-badge ' + (passed ? 'pass' : 'fail');
    
    // Simple review generation (omitted for brevity - same as previous version)
    var review = document.getElementById('answerReview');
    review.innerHTML = '<div style="text-align:center; color:#718096;">Review complete. Great job!</div>';
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    var el = document.getElementById(id);
    el.style.display = 'flex'; el.classList.add('active');
    if (id === 'testScreen') el.style.flexDirection = 'column';
}
function escHtml(str) { return str ? str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }
function convertDriveUrl(url) { if (!url) return ''; var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/); return match ? 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w800' : url; }

initWelcomeScreen();
<\/script>
</body>
</html>`;
}

the above is code.gs
// ============ STUDENT TEST HTML ============
// This function is appended to Code.gs
// Add this to the same Apps Script project

function buildStudentTestHtml(testData, testId) {
  var questionsJson = JSON.stringify(testData.questions);
  var testInfoJson = JSON.stringify({
    testId: testId,
    title: testData.title,
    teacher: testData.teacher,
    tradeClass: testData.tradeClass || '',
    instituteName: testData.instituteName || 'ITI',
    instituteSubtitle: testData.instituteSubtitle || '',
    duration: testData.duration || 60,
    passingMarks: testData.passingMarks || 40,
    shuffle: testData.shuffle || false,
    shuffleOpts: testData.shuffleOpts || false,
    forceFullscreen: testData.forceFullscreen || false,
    instructions: testData.instructions || []
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>ITI Mock Test</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
/* ===== RESET & BASE ===== */
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: 'Segoe UI', Arial, sans-serif; background: #eef2f7; color: #1a202c; }
button { cursor: pointer; font-family: inherit; }

/* ===== FULLSCREEN WARNING OVERLAY ===== */
#fsWarning {
  display: none;
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.92);
  align-items: center; justify-content: center;
  flex-direction: column; text-align: center; padding: 30px;
}
#fsWarning.show { display: flex; }
.fs-warn-icon { font-size: 64px; margin-bottom: 16px; }
.fs-warn-title { font-size: 22px; font-weight: 800; color: #f87171; margin-bottom: 10px; }
.fs-warn-msg { font-size: 14px; color: #e5e7eb; line-height: 1.7; margin-bottom: 8px; max-width: 420px; }
.fs-warn-count { font-size: 12px; color: #fbbf24; margin-bottom: 24px; }
.fs-warn-btn {
  padding: 14px 36px; background: #1a56db; color: white;
  border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer;
}
.fs-warn-btn:hover { background: #0d3b9e; }

/* ===== SCREENS ===== */
.screen { display: none; min-height: 100vh; }
.screen.active { display: flex; flex-direction: column; }

/* ===== WELCOME SCREEN ===== */
#welcomeScreen {
  background: linear-gradient(135deg, #0d2f7e 0%, #1a56db 50%, #2563eb 100%);
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.welcome-card {
  background: white;
  border-radius: 20px;
  padding: 36px 40px;
  max-width: 580px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: fadeUp 0.5s ease;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.inst-header {
  text-align: center;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 20px;
  margin-bottom: 24px;
}
.inst-name { font-size: 22px; font-weight: 800; color: #1a56db; line-height: 1.2; }
.inst-sub { font-size: 13px; color: #718096; margin-top: 4px; }
.test-title-display { font-size: 18px; font-weight: 700; color: #1a202c; margin-top: 14px; }
.test-meta { display: flex; justify-content: center; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
.meta-chip {
  display: flex; align-items: center; gap: 5px;
  background: #f0f5ff; color: #1a56db;
  border-radius: 20px; padding: 5px 12px;
  font-size: 12px; font-weight: 600;
}

.instructions-box {
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
}
.instructions-box h3 { font-size: 13px; font-weight: 700; color: #92400e; margin-bottom: 8px; }
.instructions-box ol { padding-left: 18px; }
.instructions-box li { font-size: 12px; color: #78350f; margin-bottom: 5px; line-height: 1.5; }

.legend-box {
  background: #f8faff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 20px;
}
.legend-box h3 { font-size: 12px; font-weight: 700; color: #4a5568; margin-bottom: 10px; }
.legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #4a5568; }
.legend-num {
  width: 24px; height: 24px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.ln-gray { background: #e2e8f0; color: #4a5568; }
.ln-red { background: #fc8181; color: white; }
.ln-green { background: #48bb78; color: white; }
.ln-purple { background: #9f7aea; color: white; border-radius: 50%; }
.ln-purple-green { background: linear-gradient(135deg, #9f7aea, #48bb78); color: white; border-radius: 50%; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group.full { grid-column: 1 / -1; }
.form-group label { font-size: 11px; font-weight: 700; color: #4a5568; text-transform: uppercase; letter-spacing: 0.4px; }
.form-group input, .form-group select {
  padding: 9px 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  transition: border 0.15s;
}
.form-group input:focus, .form-group select:focus { border-color: #1a56db; outline: none; }

.start-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #1a56db, #0d3b9e);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.3px;
  transition: all 0.2s;
}
.start-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(26,86,219,0.35); }

/* ===== TEST SCREEN ===== */
#testScreen { display: none; flex-direction: row; height: 100vh; overflow: hidden; }
#testScreen.active { display: flex; }

/* Top Bar */
.top-bar {
  position: fixed; top: 0; left: 0; right: 0;
  background: #1a56db;
  color: white;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 200;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}
.top-bar-left { display: flex; flex-direction: column; }
.tb-title { font-size: 14px; font-weight: 700; }
.tb-subtitle { font-size: 11px; opacity: 0.8; }
.top-bar-center { display: flex; align-items: center; gap: 8px; }
.timer-display {
  background: rgba(255,255,255,0.15);
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  padding: 5px 14px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 2px;
  min-width: 100px;
  text-align: center;
}
.timer-display.warning { background: rgba(252, 129, 74, 0.3); border-color: #fc814a; color: #ffd4b8; }
.timer-display.danger { background: rgba(252, 100, 100, 0.3); border-color: #fc6464; color: #ffb8b8; animation: blink 1s infinite; }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

.top-bar-right { display: flex; align-items: center; gap: 8px; }
.submit-btn-top {
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.15s;
}
.submit-btn-top:hover { background: #16a34a; }

/* Main layout */
.test-body {
  display: flex;
  width: 100%;
  margin-top: 54px;
  height: calc(100vh - 54px);
  overflow: hidden;
}

/* Question area */
.question-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 100px 24px;
  background: #f5f7fa;
}

.q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.q-number { font-size: 13px; color: #718096; font-weight: 600; }
.q-diff-badge { font-size: 10px; padding: 2px 10px; border-radius: 10px; font-weight: 700; text-transform: uppercase; }
.b-easy { background: #def7ec; color: #03543f; }
.b-medium { background: #fef3c7; color: #92400e; }
.b-hard { background: #fde8e8; color: #9b1c1c; }

.question-card {
  background: white;
  border-radius: 12px;
  padding: 22px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 16px;
}

.q-text {
  font-size: 15px;
  line-height: 1.7;
  color: #1a202c;
  font-weight: 500;
  margin-bottom: 6px;
}
.q-text-tr {
  font-size: 13px;
  line-height: 1.6;
  color: #2563eb;
  font-weight: 400;
  margin-top: 4px;
  margin-bottom: 4px;
  padding: 4px 0 4px 10px;
  border-left: 3px solid #93c5fd;
  display: none;
}
.opt-text-tr {
  font-size: 11px;
  color: #2563eb;
  margin-top: 2px;
  font-style: italic;
}
.q-image {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  margin: 12px 0;
  border: 1px solid #e2e8f0;
  display: block;
}

.options-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
}
.option-item:hover { border-color: #1a56db; background: #f0f5ff; }
.option-item.selected { border-color: #1a56db; background: #ebf2ff; }

.opt-letter {
  width: 32px; height: 32px;
  border: 2px solid #e2e8f0;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #4a5568;
  flex-shrink: 0;
  transition: all 0.15s;
}
.option-item.selected .opt-letter { background: #1a56db; border-color: #1a56db; color: white; }

.opt-content { flex: 1; }
.opt-text { font-size: 14px; line-height: 1.5; color: #2d3748; }
.opt-image { max-width: 100%; max-height: 150px; border-radius: 6px; margin-top: 8px; border: 1px solid #e2e8f0; display: block; }

/* Nav buttons */
.q-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 320px;
  background: white;
  border-top: 1px solid #e2e8f0;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}
.nav-btn {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 2px solid transparent;
  transition: all 0.15s;
}
.nav-prev { background: white; border-color: #e2e8f0; color: #4a5568; }
.nav-prev:hover { border-color: #4a5568; }
.nav-next { background: #1a56db; color: white; }
.nav-next:hover { background: #0d3b9e; }
.nav-review {
  background: white;
  border-color: #9f7aea;
  color: #9f7aea;
  font-size: 12px;
  padding: 9px 14px;
}
.nav-review:hover { background: #9f7aea; color: white; }
.nav-review.marked { background: #9f7aea; color: white; }
.nav-clear { background: white; border-color: #fc8181; color: #e53e3e; }
.nav-clear:hover { background: #fff5f5; }
.center-nav { display: flex; gap: 8px; }

/* Sidebar panel */
.side-panel {
  width: 320px;
  background: white;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.side-header {
  background: #f7f9fc;
  border-bottom: 1px solid #e2e8f0;
  padding: 14px 16px;
}
.side-header h3 { font-size: 13px; font-weight: 700; color: #1a202c; }

.legend-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f7f9fc;
}
.leg-item { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #4a5568; }

/* Question palette */
.palette-scroll { flex: 1; overflow-y: auto; padding: 12px 16px; }
.section-label { font-size: 11px; font-weight: 700; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 6px 0; }

.q-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.q-btn {
  width: 36px; height: 36px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.1s;
  position: relative;
}
.q-btn:hover { transform: scale(1.1); }
.q-btn.not-visited { background: #e2e8f0; color: #4a5568; border: 1px solid #cbd5e0; }
.q-btn.not-answered { background: #fc8181; color: white; }
.q-btn.answered { background: #48bb78; color: white; }
.q-btn.marked { background: #9f7aea; color: white; border-radius: 50%; }
.q-btn.answered-marked { background: linear-gradient(135deg, #48bb78, #9f7aea); color: white; border-radius: 50%; }
.q-btn.current { box-shadow: 0 0 0 3px #1a56db, 0 0 0 5px rgba(26,86,219,0.3); z-index: 1; }

/* Stats summary */
.stat-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  background: #f7f9fc;
}
.stat-box { text-align: center; }
.stat-num { font-size: 18px; font-weight: 800; }
.stat-lbl { font-size: 10px; color: #718096; text-transform: uppercase; font-weight: 600; }
.s-green { color: #22c55e; }
.s-red { color: #ef4444; }
.s-gray { color: #6b7280; }

/* ===== RESULT SCREEN ===== */
#resultScreen {
  background: #f0f4f8;
  align-items: center;
  justify-content: flex-start;
  padding: 30px 20px;
  overflow-y: auto;
}

.result-card {
  background: white;
  border-radius: 20px;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  animation: fadeUp 0.5s ease;
}

.result-header {
  background: linear-gradient(135deg, #1a56db, #0d3b9e);
  color: white;
  padding: 30px;
  text-align: center;
}
.result-title { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
.result-subtitle { font-size: 13px; opacity: 0.8; }

.score-circle-wrap { margin: 24px 0; display: flex; justify-content: center; }
.score-circle {
  width: 140px; height: 140px;
  border-radius: 50%;
  border: 8px solid rgba(255,255,255,0.3);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.sc-pct { font-size: 34px; font-weight: 900; }
.sc-label { font-size: 12px; opacity: 0.8; font-weight: 600; }

.pass-badge {
  display: inline-block;
  padding: 6px 24px;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 1px;
}
.pass-badge.pass { background: #22c55e; }
.pass-badge.fail { background: #ef4444; }

.score-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: #e2e8f0;
  margin: 0;
}
.score-box {
  background: white;
  padding: 18px 12px;
  text-align: center;
}
.sb-num { font-size: 22px; font-weight: 800; color: #1a56db; }
.sb-lbl { font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; margin-top: 3px; }

.review-section { padding: 24px; }
.review-title { font-size: 15px; font-weight: 700; color: #1a202c; margin-bottom: 16px; }
.review-q {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 12px;
  overflow: hidden;
}
.review-q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f7f9fc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  font-weight: 600;
}
.rv-correct { color: #22c55e; }
.rv-wrong { color: #ef4444; }
.rv-skipped { color: #6b7280; }
.review-q-body { padding: 12px 14px; }
.rv-q-text { font-size: 13px; color: #2d3748; line-height: 1.6; margin-bottom: 10px; }
.rv-options { display: flex; flex-direction: column; gap: 6px; }
.rv-opt {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 7px;
  font-size: 12px; line-height: 1.4;
}
.rv-opt.correct-ans { background: #def7ec; color: #03543f; }
.rv-opt.wrong-ans { background: #fde8e8; color: #9b1c1c; }
.rv-opt.plain { background: #f7f9fc; color: #4a5568; }
.rv-opt-mark { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
.mark-correct { background: #22c55e; color: white; }
.mark-wrong { background: #ef4444; color: white; }
.rv-explanation { font-size: 11px; color: #4a5568; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; padding: 8px 10px; margin-top: 8px; line-height: 1.5; }

.done-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #1a56db, #0d3b9e);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  margin: 16px 0;
  transition: all 0.2s;
}
.done-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(26,86,219,0.35); }

/* Confirm modal */
.modal-overlay {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 500;
  align-items: center;
  justify-content: center;
}
.modal-overlay.show { display: flex; }
.modal {
  background: white;
  border-radius: 16px;
  padding: 28px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: fadeUp 0.3s ease;
}
.modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.modal p { font-size: 14px; color: #4a5568; margin-bottom: 6px; line-height: 1.6; }
.modal-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
.modal-stat { text-align: center; background: #f7f9fc; border-radius: 8px; padding: 10px; }
.modal-stat .n { font-size: 20px; font-weight: 800; }
.modal-stat .l { font-size: 11px; color: #718096; }
.modal-btns { display: flex; gap: 10px; margin-top: 16px; }
.modal-cancel { flex: 1; padding: 12px; background: white; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 600; color: #4a5568; }
.modal-cancel:hover { border-color: #4a5568; }
.modal-confirm { flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; color: white; }
.modal-confirm:hover { background: #16a34a; }

/* Responsive - Mobile */
@media (max-width: 768px) {
  button, .option-item, .q-btn, input, select, textarea { touch-action: manipulation; }
  .welcome-card { padding: 20px 16px; border-radius: 12px; }
  .inst-name { font-size: 18px; }
  .test-title-display { font-size: 15px; }
  .form-grid { grid-template-columns: 1fr; }
  .test-meta { gap: 8px; }
  .meta-chip { font-size: 11px; padding: 4px 10px; }
  .top-bar { height: 48px; padding: 0 10px; }
  .tb-title { font-size: 12px; }
  .tb-subtitle { font-size: 10px; }
  .timer-display { font-size: 15px; min-width: 76px; padding: 4px 8px; letter-spacing: 1px; }
  .submit-btn-top { font-size: 11px; padding: 6px 10px; }
  .test-body { margin-top: 48px; height: calc(100vh - 48px); }
  .side-panel { display: none; width: 0; overflow: hidden; }
  .question-area { padding: 14px 12px 90px 12px; }
  .question-card { padding: 14px; }
  .q-text { font-size: 14px; }
  .q-image { max-height: 200px; }
  .q-diff-badge { font-size: 9px; }
  .option-item { padding: 11px 12px; gap: 10px; }
  .opt-letter { width: 28px; height: 28px; font-size: 12px; }
  .opt-text { font-size: 13px; }
  .opt-image { max-height: 120px; }
  .q-nav { right: 0; padding: 8px 10px; }
  .nav-btn { padding: 8px 12px; font-size: 12px; }
  .nav-review { padding: 8px 10px; font-size: 11px; }
  .score-grid { grid-template-columns: 1fr 1fr; }
  .result-header { padding: 20px; }
  .score-circle { width: 110px; height: 110px; }
  .sc-pct { font-size: 26px; }
  .review-section { padding: 16px; }
  .rv-opt { font-size: 11px; }
}

@media (max-width: 900px) and (orientation: landscape) {
  .top-bar { height: 42px; }
  .test-body { margin-top: 42px; height: calc(100vh - 42px); }
  .question-area { padding: 10px 12px 70px 12px; }
  .q-nav { padding: 6px 10px; }
  .nav-btn { padding: 6px 12px; }
  .question-card { padding: 10px 14px; }
  .q-image { max-height: 140px; }
  .welcome-card { padding: 12px 16px; }
  .score-circle-wrap { margin: 12px 0; }
  .side-panel { display: none; width: 0; overflow: hidden; }
  .q-nav { right: 0; }
}

/* ===== MOBILE FLOATING PALETTE ===== */
#mobilePaletteBtn {
  display: none;
  position: fixed;
  bottom: 72px;
  right: 14px;
  z-index: 300;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a56db, #0d3b9e);
  color: white;
  border: none;
  font-size: 22px;
  box-shadow: 0 4px 16px rgba(26,86,219,0.45);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}
#mobilePaletteBtn:active { transform: scale(0.92); }
#mobilePaletteBtn .mob-pal-count {
  position: absolute;
  top: -4px; right: -4px;
  background: #22c55e;
  color: white;
  font-size: 10px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

#mobilePaletteDrawer {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 400;
  background: white;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -4px 30px rgba(0,0,0,0.18);
  max-height: 70vh;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
#mobilePaletteDrawer.open { transform: translateY(0); }
#mobPalOverlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 399;
  background: rgba(0,0,0,0.35);
}
#mobPalOverlay.show { display: block; }
.mob-pal-handle {
  width: 36px; height: 4px;
  background: #cbd5e1;
  border-radius: 2px;
  margin: 10px auto 0 auto;
  flex-shrink: 0;
}
.mob-pal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 8px 16px;
  flex-shrink: 0;
}
.mob-pal-title { font-size: 14px; font-weight: 700; color: #1a202c; }
.mob-pal-close { background: none; border: none; font-size: 18px; color: #718096; padding: 4px; }
.mob-pal-stats {
  display: flex;
  gap: 8px;
  padding: 0 16px 10px 16px;
  flex-shrink: 0;
}
.mob-stat {
  flex: 1; text-align: center;
  padding: 8px 4px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
}
.msn { display: block; font-size: 20px; font-weight: 800; }
.mob-stat.ms-green { background: #f0fdf4; color: #166534; }
.mob-stat.ms-red   { background: #fef2f2; color: #991b1b; }
.mob-stat.ms-gray  { background: #f8fafc; color: #475569; }
.mob-pal-scroll {
  overflow-y: auto;
  padding: 10px 16px 20px 16px;
  flex: 1;
}

@media (max-width: 768px) {
  #mobilePaletteBtn { display: flex; }
  #mobilePaletteDrawer { display: flex; }
}

/* ===== PRINT / PDF ===== */
@media print {
  body { background: white !important; }
  #welcomeScreen, #testScreen, .modal-overlay,
  #fsWarning, #mobilePaletteBtn, #mobilePaletteDrawer,
  #mobPalOverlay, #doneBtn, button { display: none !important; }
  #resultScreen { display: block !important; min-height: unset !important; padding: 0 !important; background: white !important; }
  .result-card { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
  .result-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rv-opt.correct-ans, .rv-opt.wrong-ans, .rv-opt.plain { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rv-explanation { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pass-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .review-q { break-inside: avoid; page-break-inside: avoid; }
}
</style>
</head>
<body>

<!-- ===== WELCOME SCREEN ===== -->
<div id="welcomeScreen" class="screen active">
  <div class="welcome-card">
    <div class="inst-header">
      <div class="inst-name" id="instName">ITI</div>
      <div class="inst-sub" id="instSub"></div>
      <div class="test-title-display" id="testTitleDisplay">Loading...</div>
      <div class="test-meta" id="testMeta"></div>
    </div>

    <div class="instructions-box">
      <h3>📋 Instructions & Rules</h3>
      <ol id="instructionsList">
        <li>Read each question carefully before answering.</li>
        <li>You can navigate between questions using Next/Previous buttons.</li>
        <li>Mark questions for review if you want to revisit them.</li>
        <li>The timer starts as soon as you click "Start Test".</li>
        <li>Do not refresh or close the page during the test.</li>
        <li>Click "Submit Test" when you are done.</li>
      </ol>
    </div>

    <div class="legend-box">
      <h3>🎨 Question Status Guide</h3>
      <div class="legend-grid">
        <div class="legend-item"><div class="legend-num ln-gray">1</div> Not Visited</div>
        <div class="legend-item"><div class="legend-num ln-red">2</div> Not Answered</div>
        <div class="legend-item"><div class="legend-num ln-green">3</div> Answered</div>
        <div class="legend-item"><div class="legend-num ln-purple">4</div> Marked for Review</div>
        <div class="legend-item"><div class="legend-num ln-purple-green">5</div> Answered + Marked</div>
      </div>
    </div>

    <div class="form-grid">
      <div class="form-group full">
        <label>Full Name *</label>
        <input type="text" id="studentName" placeholder="Enter your full name" />
      </div>
      <div class="form-group">
        <label>Roll Number *</label>
        <input type="text" id="rollNo" placeholder="e.g. 2024001" />
      </div>
      <div class="form-group">
        <label>Class / Semester</label>
        <input type="text" id="className" placeholder="e.g. Sem 1" />
      </div>
      <div class="form-group full">
        <label>Trade</label>
        <input type="text" id="tradeName" placeholder="e.g. Electrician" />
      </div>
    </div>

    <button class="start-btn" onclick="startTest()">▶ Start Test</button>
  </div>
</div>

<!-- ===== TEST SCREEN ===== -->
<div id="testScreen" class="screen">
  <div class="top-bar">
    <div class="top-bar-left">
      <div class="tb-title" id="topTestTitle">ITI Mock Test</div>
      <div class="tb-subtitle" id="topStudentName">Student</div>
    </div>
    <div class="top-bar-center">
      <span style="font-size:13px;opacity:0.8;">⏱</span>
      <div class="timer-display" id="timerDisplay">60:00</div>
    </div>
    <div class="top-bar-right">
      <button class="submit-btn-top" onclick="confirmSubmit()">Submit Test ✓</button>
    </div>
  </div>

  <div class="test-body">
    <div class="question-area" id="questionArea">
      <div class="q-header">
        <div class="q-number" id="qNumber">Question 1 of 25</div>
        <div class="q-diff-badge b-medium" id="qDiffBadge">Medium</div>
      </div>
      <div class="question-card">
        <div class="q-text" id="qText"></div>
        <div class="q-text-tr" id="qTextTr"></div>
        <img class="q-image" id="qImage" src="" style="display:none;" alt="Question Image" />
        <div class="options-grid" id="optionsGrid"></div>
      </div>
      <div class="q-nav">
        <button class="nav-btn nav-prev" onclick="navigate(-1)">◀ Previous</button>
        <div class="center-nav">
          <button class="nav-btn nav-clear" onclick="clearAnswer()">✕ Clear</button>
          <button class="nav-btn nav-review" id="reviewBtn" onclick="toggleReview()">⚑ Mark Review</button>
        </div>
        <button class="nav-btn nav-next" onclick="navigate(1)">Next ▶</button>
      </div>
    </div>

    <div class="side-panel">
      <div class="side-header">
        <h3>📊 Question Palette</h3>
      </div>
      <div class="legend-row">
        <div class="leg-item"><div class="legend-num ln-gray" style="width:18px;height:18px;font-size:10px;">N</div>&nbsp;Not Visited</div>
        <div class="leg-item"><div class="legend-num ln-red" style="width:18px;height:18px;font-size:10px;">A</div>&nbsp;Not Answered</div>
        <div class="leg-item"><div class="legend-num ln-green" style="width:18px;height:18px;font-size:10px;">A</div>&nbsp;Answered</div>
        <div class="leg-item"><div class="legend-num ln-purple" style="width:18px;height:18px;border-radius:50%;font-size:10px;">A</div>&nbsp;Review</div>
      </div>
      <div class="palette-scroll" id="paletteScroll"></div>
      <div class="stat-row">
        <div class="stat-box"><div class="stat-num s-green" id="statAnswered">0</div><div class="stat-lbl">Answered</div></div>
        <div class="stat-box"><div class="stat-num s-red" id="statNotAnswered">0</div><div class="stat-lbl">Not Ans.</div></div>
        <div class="stat-box"><div class="stat-num s-gray" id="statMarked">0</div><div class="stat-lbl">Review</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ===== RESULT SCREEN ===== -->
<div id="resultScreen" class="screen">
  <div class="result-card">
    <div class="result-header">
      <div class="result-title" id="resTestTitle">Test Results</div>
      <div class="result-subtitle" id="resStudentInfo">Student Name</div>
      <div class="score-circle-wrap">
        <div class="score-circle">
          <div class="sc-pct" id="resPercent">0%</div>
          <div class="sc-label">Score</div>
        </div>
      </div>
      <div id="resPassBadge" class="pass-badge pass">PASS</div>
    </div>

    <div class="score-grid">
      <div class="score-box"><div class="sb-num" id="resScore">0</div><div class="sb-lbl">Score</div></div>
      <div class="score-box"><div class="sb-num" id="resTotal">0</div><div class="sb-lbl">Total Marks</div></div>
      <div class="score-box"><div class="sb-num s-green" id="resCorrect">0</div><div class="sb-lbl">Correct</div></div>
      <div class="score-box"><div class="sb-num s-red" id="resWrong">0</div><div class="sb-lbl">Wrong</div></div>
    </div>

    <div class="review-section">
      <div style="text-align:center;margin-bottom:16px;">
        <button class="done-btn" id="doneBtn" onclick="window.close()">✓ Done — Close Window</button>
        <button class="done-btn" onclick="window.print()" style="background:linear-gradient(135deg,#059669,#047857);margin-top:10px;">🖨️ Print / Save as PDF</button>
      </div>
      <div class="review-title">📝 Answer Review</div>
      <div id="answerReview"></div>
    </div>
  </div>
</div>

<!-- Submit Confirm Modal -->
<div class="modal-overlay" id="confirmModal">
  <div class="modal">
    <h3>📤 Submit Test?</h3>
    <p>Are you sure you want to submit?</p>
    <div class="modal-stats">
      <div class="modal-stat"><div class="n s-green" id="mAnswered">0</div><div class="l">Answered</div></div>
      <div class="modal-stat"><div class="n s-red" id="mNotAnswered">0</div><div class="l">Not Answered</div></div>
      <div class="modal-stat"><div class="n s-gray" id="mMarked">0</div><div class="l">Marked</div></div>
      <div class="modal-stat"><div class="n" id="mTotal">0</div><div class="l">Total</div></div>
    </div>
    <p style="color:#ef4444;font-size:12px;">⚠️ You cannot change answers after submitting.</p>
    <div class="modal-btns">
      <button class="modal-cancel" onclick="closeModal()">◀ Go Back</button>
      <button class="modal-confirm" onclick="submitTest()">Submit ✓</button>
    </div>
  </div>
</div>

<!-- Fullscreen Warning -->
<div id="fsWarning">
  <div class="fs-warn-icon">⚠️</div>
  <div class="fs-warn-title">Fullscreen Required!</div>
  <div class="fs-warn-msg">You have exited fullscreen mode. Please return to fullscreen to continue the test.</div>
  <div class="fs-warn-count">Violation #<span id="fsViolationCount">1</span> | Tab switches: <span id="fsTabCount">0</span></div>
  <button class="fs-warn-btn" onclick="returnToFullscreen()">↩ Return to Fullscreen</button>
</div>

<script>
// ===== DATA =====
var questions = ${questionsJson};
var testInfo  = ${testInfoJson};

// ===== STATE =====
var studentInfo    = {};
var currentQ       = 0;
var answers        = {};
var visited        = {};
var markedReview   = {};
var timerInterval  = null;
var timeLeft       = testInfo.duration * 60;
var testStarted    = false;
var testSubmitted  = false;

// ===== INIT =====
function initWelcomeScreen() {
  document.getElementById('instName').textContent   = testInfo.instituteName  || 'ITI';
  document.getElementById('instSub').textContent    = testInfo.instituteSubtitle || '';
  document.getElementById('testTitleDisplay').textContent = testInfo.title || 'Mock Test';

  var meta = document.getElementById('testMeta');
  meta.innerHTML =
    '<div class="meta-chip">⏱ ' + testInfo.duration + ' min</div>' +
    '<div class="meta-chip">📝 ' + questions.length + ' Questions</div>' +
    (testInfo.teacher   ? '<div class="meta-chip">👨‍🏫 ' + escHtml(testInfo.teacher)   + '</div>' : '') +
    (testInfo.tradeClass ? '<div class="meta-chip">🏫 ' + escHtml(testInfo.tradeClass) + '</div>' : '');

  var instList = document.getElementById('instructionsList');
  if (testInfo.instructions && testInfo.instructions.length > 0) {
    instList.innerHTML = '';
    testInfo.instructions.forEach(function(ins) {
      var li = document.createElement('li');
      li.textContent = ins;
      instList.appendChild(li);
    });
  }
}

// ===== START TEST =====
function startTest() {
  var name = document.getElementById('studentName').value.trim();
  var roll = document.getElementById('rollNo').value.trim();
  if (!name) { alert('Please enter your name!'); return; }
  if (!roll) { alert('Please enter your Roll Number!'); return; }

  studentInfo = {
    name:      name,
    rollNo:    roll,
    className: document.getElementById('className').value.trim(),
    trade:     document.getElementById('tradeName').value.trim()
  };

  showScreen('testScreen');
  document.getElementById('topTestTitle').textContent  = testInfo.title;
  document.getElementById('topStudentName').textContent = name + ' | Roll: ' + roll;

  if (testInfo.forceFullscreen) enterFullscreen();
  requestWakeLock();

  // =====================================================================
  // STEP 1: Group by chapter first, preserving original chapter order
  // STEP 2: Shuffle within each chapter only (never across chapters)
  // STEP 3: Rebuild questions array chapter by chapter
  // STEP 4: Stamp _origIdx AFTER final order is decided
  // =====================================================================
  var chapMap = {};
  var chapOrder = [];
  questions.forEach(function(q) {
    var chap = q.chapter || 'Questions';
    if (!chapMap[chap]) { chapMap[chap] = []; chapOrder.push(chap); }
    chapMap[chap].push(q);
  });

  if (testInfo.shuffle) {
    chapOrder.forEach(function(chap) {
      chapMap[chap].sort(function() { return Math.random() - 0.5; });
    });
  }

  questions = [];
  chapOrder.forEach(function(chap) {
    chapMap[chap].forEach(function(q) { questions.push(q); });
  });

  // Stamp origIdx after final order
  questions.forEach(function(q, i) { q._origIdx = i; });

  buildPalette();
  showQuestion(0);
  startTimer();
  testStarted = true;
}

// ===== TIMER =====
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(function() {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoSubmit();
    }
  }, 1000);
}

function updateTimerDisplay() {
  var m = Math.floor(timeLeft / 60);
  var s = timeLeft % 60;
  var display = document.getElementById('timerDisplay');
  display.textContent = pad(m) + ':' + pad(s);
  display.className = 'timer-display';
  if (timeLeft <= 300)      display.classList.add('danger');
  else if (timeLeft <= 600) display.classList.add('warning');
}

function pad(n) { return n < 10 ? '0' + n : n; }

function autoSubmit() {
  alert('⏰ Time is up! Your test is being submitted automatically.');
  submitTest();
}

// ===== QUESTION DISPLAY =====
function showQuestion(index) {
  if (index < 0 || index >= questions.length) return;
  currentQ = index;
  visited[index] = true;

  var q       = questions[index];
  var origIdx = q._origIdx;

  document.getElementById('qNumber').textContent = 'Question ' + (index + 1) + ' of ' + questions.length;
  var diffClass = q.difficulty || 'medium';
  var badge = document.getElementById('qDiffBadge');
  badge.textContent = capitalize(diffClass);
  badge.className   = 'q-diff-badge b-' + diffClass;

  document.getElementById('qText').textContent = q.question;

  var qTrEl = document.getElementById('qTextTr');
  if (q.questionTr) {
    qTrEl.textContent  = q.questionTr;
    qTrEl.style.display = 'block';
  } else {
    qTrEl.style.display = 'none';
  }

  var qImg = document.getElementById('qImage');
  if (q.questionImage) {
    qImg.src          = convertDriveUrl(q.questionImage);
    qImg.style.display = 'block';
  } else {
    qImg.style.display = 'none';
  }

  var grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  var opts = [
    { letter: 'A', text: q.optA, img: q.optAImage, tr: q.optATr || '' },
    { letter: 'B', text: q.optB, img: q.optBImage, tr: q.optBTr || '' },
    { letter: 'C', text: q.optC, img: q.optCImage, tr: q.optCTr || '' },
    { letter: 'D', text: q.optD, img: q.optDImage, tr: q.optDTr || '' }
  ];

  if (testInfo.shuffleOpts) {
    if (!q._so) q._so = [0,1,2,3].sort(function(){ return Math.random() - 0.5; });
    opts = q._so.map(function(i) { return opts[i]; });
  }

  opts.forEach(function(opt, displayPos) {
    if (!opt.text && !opt.img) return;

    var item = document.createElement('div');
    item.className = 'option-item' + (answers[origIdx] === opt.letter ? ' selected' : '');
    item.onclick = (function(capturedIndex, capturedLetter) {
      return function() { selectAnswer(capturedIndex, capturedLetter); };
    })(index, opt.letter);

    var displayLabel = testInfo.shuffleOpts ? String.fromCharCode(65 + displayPos) : opt.letter;
    var imgHtml = opt.img ? '<img class="opt-image" src="' + convertDriveUrl(opt.img) + '" alt="Option ' + opt.letter + '" />' : '';
    var trHtml  = opt.tr  ? '<div class="opt-text-tr">' + escHtml(opt.tr) + '</div>' : '';

    item.innerHTML =
      '<div class="opt-letter">' + displayLabel + '</div>' +
      '<div class="opt-content">' +
        '<div class="opt-text">' + escHtml(opt.text || '') + '</div>' +
        trHtml + imgHtml +
      '</div>';

    grid.appendChild(item);
  });

  var revBtn = document.getElementById('reviewBtn');
  revBtn.classList.toggle('marked', !!markedReview[index]);

  updatePalette();
  updateStats();
}

function selectAnswer(qIndex, letter) {
  var origIdx = questions[qIndex]._origIdx;
  answers[origIdx] = letter;
  showQuestion(qIndex);
}

function clearAnswer() {
  var origIdx = questions[currentQ]._origIdx;
  delete answers[origIdx];
  showQuestion(currentQ);
}

function toggleReview() {
  if (markedReview[currentQ]) {
    delete markedReview[currentQ];
  } else {
    markedReview[currentQ] = true;
  }
  document.getElementById('reviewBtn').classList.toggle('marked', !!markedReview[currentQ]);
  updatePalette();
  updateStats();
}

// =====================================================================
// FIX: navigate() stays within same chapter only
// =====================================================================
function navigate(dir) {
  var currentChap = questions[currentQ].chapter || 'Questions';
  var chapIndices = [];
  questions.forEach(function(q, i) {
    if ((q.chapter || 'Questions') === currentChap) chapIndices.push(i);
  });
  var posInChap = chapIndices.indexOf(currentQ);
  var nextPos   = posInChap + dir;

  if (nextPos >= 0 && nextPos < chapIndices.length) {
    // Within same chapter
    showQuestion(chapIndices[nextPos]);
  } else if (dir === 1 && currentQ < questions.length - 1) {
    // Last question of chapter + Next → go to first question of next chapter
    showQuestion(currentQ + 1);
  } else if (dir === -1 && currentQ > 0) {
    // First question of chapter + Previous → go to last question of previous chapter
    showQuestion(currentQ - 1);
  }
}

// ===== PALETTE =====
function buildPalette() {
  var scroll = document.getElementById('paletteScroll');
  scroll.innerHTML = '';

  var chapters = {};
  var chapOrder = [];
  questions.forEach(function(q, i) {
    var chap = q.chapter || 'Questions';
    if (!chapters[chap]) { chapters[chap] = []; chapOrder.push(chap); }
    chapters[chap].push(i);
  });

  chapOrder.forEach(function(chap) {
    var label = document.createElement('div');
    label.className   = 'section-label';
    label.textContent = chap;
    scroll.appendChild(label);

    var palette = document.createElement('div');
    palette.className = 'q-palette';

    chapters[chap].forEach(function(qi, posInChap) {
      var btn = document.createElement('button');
      btn.className   = 'q-btn not-visited';
      btn.id          = 'qbtn_' + qi;
      btn.textContent = posInChap + 1;
      btn.onclick     = function() { showQuestion(qi); };
      palette.appendChild(btn);
    });

    scroll.appendChild(palette);
  });
}

function updatePalette() {
  questions.forEach(function(q, i) {
    var btn = document.getElementById('qbtn_' + i);
    if (!btn) return;
    btn.className = 'q-btn';

    var origIdx = q._origIdx;
    var ans     = answers[origIdx];
    var marked  = markedReview[i];
    var vis     = visited[i];

    if (ans && marked) btn.classList.add('answered-marked');
    else if (ans)      btn.classList.add('answered');
    else if (marked)   btn.classList.add('marked');
    else if (vis)      btn.classList.add('not-answered');
    else               btn.classList.add('not-visited');

    if (i === currentQ) btn.classList.add('current');
  });
}

function updateStats() {
  var answered    = Object.keys(answers).length;
  var marked      = Object.keys(markedReview).length;
  var notAnswered = questions.filter(function(q, i) {
    return visited[i] && !answers[q._origIdx];
  }).length;
  document.getElementById('statAnswered').textContent    = answered;
  document.getElementById('statNotAnswered').textContent = notAnswered;
  document.getElementById('statMarked').textContent      = marked;
  updateMobilePaletteStats();
}

// ===== SUBMIT =====
function confirmSubmit() {
  var answered = Object.keys(answers).length;
  var marked   = Object.keys(markedReview).length;
  document.getElementById('mAnswered').textContent    = answered;
  document.getElementById('mNotAnswered').textContent = questions.length - answered;
  document.getElementById('mMarked').textContent      = marked;
  document.getElementById('mTotal').textContent       = questions.length;
  document.getElementById('confirmModal').classList.add('show');
}

function closeModal() {
  document.getElementById('confirmModal').classList.remove('show');
}

function submitTest() {
  if (testSubmitted) return;
  testSubmitted = true;
  clearInterval(timerInterval);
  releaseWakeLock();
  closeModal();

  var score      = 0;
  var totalMarks = 0;
  var correct    = 0;
  var wrong      = 0;

  questions.forEach(function(q) {
    var origIdx    = q._origIdx;
    var pts        = q.points       || 1;
    var neg        = q.negativeMarks || 0;
    totalMarks += pts;

    var studentAns = answers[origIdx];
    if (studentAns) {
      if (studentAns === q.answer) { score += pts; correct++; }
      else { score -= neg; wrong++; }
    }
  });

  if (score < 0) score = 0;
  var pct    = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
  var passed = pct >= testInfo.passingMarks;

  var submitData = {
    testId:       testInfo.testId,
    testTitle:    testInfo.title,
    studentName:  studentInfo.name,
    rollNo:       studentInfo.rollNo,
    className:    studentInfo.className,
    trade:        studentInfo.trade,
    score:        score,
    totalMarks:   totalMarks,
    percentage:   pct,
    passingMarks: testInfo.passingMarks,
    fsViolations: fsViolations,
    tabViolations: tabViolations,
    answers:      answers
  };

  google.script.run
    .withSuccessHandler(function() {})
    .withFailureHandler(function() {})
    .submitTestResult(submitData);

  showResultScreen(score, totalMarks, pct, passed, correct, wrong);
}

function showResultScreen(score, totalMarks, pct, passed, correct, wrong) {
  showScreen('resultScreen');

  document.getElementById('resTestTitle').textContent   = testInfo.title;
  document.getElementById('resStudentInfo').textContent =
    studentInfo.name + ' | Roll: ' + studentInfo.rollNo +
    (studentInfo.className ? ' | ' + studentInfo.className : '');
  document.getElementById('resPercent').textContent = pct.toFixed(1) + '%';
  document.getElementById('resScore').textContent   = score.toFixed(1);
  document.getElementById('resTotal').textContent   = totalMarks;
  document.getElementById('resCorrect').textContent = correct;
  document.getElementById('resWrong').textContent   = wrong;

  var badge = document.getElementById('resPassBadge');
  badge.textContent = passed ? '✓ PASS' : '✗ FAIL';
  badge.className   = 'pass-badge ' + (passed ? 'pass' : 'fail');

  var review = document.getElementById('answerReview');
  review.innerHTML = '';

  questions.forEach(function(q, i) {
    var origIdx   = q._origIdx;
    var userAns   = answers[origIdx];
    var isCorrect = userAns === q.answer;
    var isSkipped = !userAns;

    var rv = document.createElement('div');
    rv.className = 'review-q';

    var statusClass = isSkipped ? 'rv-skipped' : (isCorrect ? 'rv-correct' : 'rv-wrong');
    var statusText  = isSkipped
      ? '— Skipped'
      : isCorrect
        ? '✓ Correct (+' + (q.points || 1) + ')'
        : '✗ Wrong (' + (q.negativeMarks > 0 ? '-' + q.negativeMarks : '0') + ')';

    var optsHtml = ['A','B','C','D'].map(function(l) {
      var txt = q['opt' + l] || '';
      if (!txt && !q['opt' + l + 'Image']) return '';
      var cls  = 'plain';
      var mark = '';
      if (l === q.answer)                   { cls = 'correct-ans'; mark = '<div class="rv-opt-mark mark-correct">✓</div>'; }
      else if (l === userAns && !isCorrect) { cls = 'wrong-ans';   mark = '<div class="rv-opt-mark mark-wrong">✗</div>'; }
      else                                  { mark = '<div class="rv-opt-mark" style="width:18px;height:18px;"></div>'; }
      var optImg = q['opt' + l + 'Image'] ? '<img src="' + convertDriveUrl(q['opt' + l + 'Image']) + '" style="max-width:100%;max-height:160px;display:block;margin-top:6px;border-radius:6px;">' : '';
      return '<div class="rv-opt ' + cls + '">' + mark + '<b>' + l + '.</b>&nbsp;' + escHtml(txt) + optImg + '</div>';
    }).join('');

    var explanationHtml = q.explanation
      ? '<div class="rv-explanation">💡 <b>Explanation:</b> ' + escHtml(q.explanation) +
        (q.explanationImage ? '<br><img src="' + convertDriveUrl(q.explanationImage) + '" style="max-width:100%;max-height:200px;display:block;margin-top:8px;border-radius:6px;">' : '') +
        '</div>'
      : '';

    rv.innerHTML =
      '<div class="review-q-header">' +
        '<span>Q' + (i + 1) + '. ' + escHtml(q.chapter || '') + '</span>' +
        '<span class="' + statusClass + '">' + statusText + '</span>' +
      '</div>' +
      '<div class="review-q-body">' +
        '<div class="rv-q-text">' + escHtml(q.question) + '</div>' +
        (q.questionImage ? '<img src="' + convertDriveUrl(q.questionImage) + '" style="max-width:100%;max-height:220px;display:block;margin:8px 0 12px 0;border-radius:8px;">' : '') +
        '<div class="rv-options">' + optsHtml + '</div>' +
        explanationHtml +
      '</div>';

    review.appendChild(rv);
  });
}

// ===== UTILS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  var el = document.getElementById(id);
  el.style.display = 'flex';
  el.classList.add('active');
  if (id === 'testScreen') el.style.flexDirection = 'column';
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function convertDriveUrl(url) {
  if (!url) return '';
  var match = url.match(/\\/d\\/([a-zA-Z0-9_-]+)/);
  if (!match) match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w800';
  return url;
}

// ===== FULLSCREEN =====
var fsViolations  = 0;
var tabViolations = 0;

function enterFullscreen() {
  var el = document.documentElement;
  if      (el.requestFullscreen)       el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.mozRequestFullScreen)    el.mozRequestFullScreen();
  else if (el.msRequestFullscreen)     el.msRequestFullscreen();
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);
}

function showFsWarning() {
  fsViolations++;
  document.getElementById('fsViolationCount').textContent = fsViolations;
  document.getElementById('fsWarning').classList.add('show');
}

function hideFsWarning() {
  document.getElementById('fsWarning').classList.remove('show');
}

function returnToFullscreen() {
  enterFullscreen();
  hideFsWarning();
}

function setupFullscreenGuard() {
  if (!testInfo.forceFullscreen) return;
  ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(function(evt) {
    document.addEventListener(evt, function() {
      if (testStarted && !testSubmitted && !isFullscreen()) showFsWarning();
    });
  });
  document.addEventListener('visibilitychange', function() {
    if (testStarted && !testSubmitted && document.hidden) {
      tabViolations++;
      document.getElementById('fsTabCount').textContent = tabViolations;
    }
  });
}

// ===== MOBILE PALETTE =====
function openMobilePalette() {
  var src = document.getElementById('paletteScroll');
  var dst = document.getElementById('mobPaletteScroll');
  dst.innerHTML = src.innerHTML;
  dst.querySelectorAll('.q-btn').forEach(function(btn) {
    var qi = parseInt(btn.dataset.qi);
    btn.onclick = function() { showQuestion(qi); closeMobilePalette(); };
  });
  document.getElementById('mobilePaletteDrawer').classList.add('open');
  document.getElementById('mobPalOverlay').classList.add('show');
}

function closeMobilePalette() {
  document.getElementById('mobilePaletteDrawer').classList.remove('open');
  document.getElementById('mobPalOverlay').classList.remove('show');
}

function updateMobilePaletteStats() {
  var answered    = Object.keys(answers).length;
  var marked      = Object.keys(markedReview).length;
  var notAnswered = questions.filter(function(q, i) {
    return visited[i] && !answers[q._origIdx];
  }).length;
  document.getElementById('mobPalCount').textContent      = answered;
  document.getElementById('mobStatAnswered').textContent  = answered;
  document.getElementById('mobStatNotAns').textContent    = notAnswered;
  document.getElementById('mobStatReview').textContent    = marked;
}

// ===== WAKE LOCK =====
var wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', async function() {
        if (wakeLock !== null && document.visibilityState === 'visible' && testStarted && !testSubmitted) {
          try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
        }
      });
    }
  } catch(e) { console.log('Wake Lock not supported:', e.message); }
}

function releaseWakeLock() {
  if (wakeLock !== null) { wakeLock.release().catch(function() {}); wakeLock = null; }
}

// ===== PAGE CLOSE PROTECTION =====
window.addEventListener('beforeunload', function(e) {
  if (testStarted && !testSubmitted) {
    e.preventDefault();
    e.returnValue = 'Test chal raha hai! Bahar jaane se aapka test kho jayega.';
    return e.returnValue;
  }
});

// ===== BOOT =====
initWelcomeScreen();
setupFullscreenGuard();
</script>

<!-- MOBILE PALETTE OVERLAY -->
<div id="mobPalOverlay" onclick="closeMobilePalette()"></div>

<!-- MOBILE FLOATING PALETTE BUTTON -->
<button id="mobilePaletteBtn" onclick="openMobilePalette()">
  📋
  <span class="mob-pal-count" id="mobPalCount">0</span>
</button>

<!-- MOBILE PALETTE DRAWER -->
<div id="mobilePaletteDrawer">
  <div class="mob-pal-handle"></div>
  <div class="mob-pal-header">
    <span class="mob-pal-title">📊 Question Palette</span>
    <button class="mob-pal-close" onclick="closeMobilePalette()">✕</button>
  </div>
  <div class="mob-pal-stats">
    <div class="mob-stat ms-green"><span class="msn" id="mobStatAnswered">0</span>Answered</div>
    <div class="mob-stat ms-red"><span class="msn" id="mobStatNotAns">0</span>Not Ans.</div>
    <div class="mob-stat ms-gray"><span class="msn" id="mobStatReview">0</span>Review</div>
  </div>
  <div class="mob-pal-scroll" id="mobPaletteScroll"></div>
</div>

</body>
</html>`;
}

the above is studentTEst.gs....

why both files have html
