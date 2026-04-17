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
