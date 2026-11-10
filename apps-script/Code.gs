/**
 * 미래과학교육원 AI·디지털 역량진단 — 응답 저장 서버 (Google Apps Script)
 *
 * 설치 순서는 README.md 참고.
 * 1) 새 구글 시트 → 확장 프로그램 → Apps Script → 이 파일 내용 붙여넣기
 * 2) 아래 setAdminKey() 안의 '여기에-관리자-비밀번호' 를 바꾸고 한 번 실행
 * 3) 배포 → 새 배포 → 웹 앱 (실행: 나 / 액세스: 모든 사용자) → URL 복사
 */

const SHEET_NAME = 'responses';
const HEAD = ['id', 'submitted_at', 'day', 'school', 'interest', 'preferred', 'recommended',
  'overall', 'd1_안전윤리', 'd2_리터러시', 'd3_에듀테크', 'd4_데이터', 'd5_컴퓨팅사고', 'd6_AI',
  'answers_json', 'version', 'deleted'];
const SCHOOLS = ['유치원', '초등', '중등', '특수', '기타'];
const QUESTION_COUNT = 61;

/** 관리자 비밀번호를 스크립트 속성에 저장합니다. 값을 바꾼 뒤 한 번만 실행하세요. */
function setAdminKey() {
  const key = '여기에-관리자-비밀번호';
  if (key.indexOf('여기에') === 0 || key.length < 8) throw new Error('8자 이상 비밀번호로 바꾼 뒤 실행하세요.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', key);
  sheet_();
  Logger.log('관리자 비밀번호를 저장했습니다.');
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return out_({ ok: true, service: 'migwa-ai-diagnosis', message: '응답 저장 서버가 동작 중입니다.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'list') return out_(list_(body));
    if (body.action === 'delete') return out_(remove_(body));
    if (body.action === 'restore') return out_(restore_(body));
    return out_(submit_(body));
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* ignore */ }
  }
}

function checkKey_(body) {
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key) throw new Error('관리자 비밀번호가 설정되지 않았습니다. setAdminKey()를 먼저 실행하세요.');
  if (String(body.key || '') !== key) throw new Error('관리자 비밀번호가 맞지 않습니다.');
}

function submit_(b) {
  if (!b.consent) throw new Error('익명 활용 동의가 필요합니다.');
  const id = String(b.id || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new Error('응답 번호가 올바르지 않습니다.');
  if (SCHOOLS.indexOf(b.school) < 0) throw new Error('학교급이 올바르지 않습니다.');
  const answers = b.answers || {};
  const keys = Object.keys(answers);
  if (keys.length !== QUESTION_COUNT) throw new Error('모든 문항에 응답해야 제출할 수 있습니다.');
  const sums = [0, 0, 0, 0, 0, 0], counts = [0, 0, 0, 0, 0, 0];
  const clean = {};
  keys.forEach(function (k) {
    if (!/^[1-6]-[1-4]-[1-9]$/.test(k)) throw new Error('문항 번호가 올바르지 않습니다.');
    const v = Number(answers[k]);
    if (!(v >= 1 && v <= 5 && Math.floor(v) === v)) throw new Error('응답 값이 올바르지 않습니다.');
    const d = Number(k.charAt(0)) - 1;
    sums[d] += v; counts[d]++; clean[k] = v;
  });
  const ds = sums.map(function (s, i) { return Math.round(s / counts[i] * 1000) / 1000; });
  const overall = Math.round(ds.reduce(function (a, c) { return a + c; }, 0) / 6 * 1000) / 1000;

  const sh = sheet_();
  const found = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).createTextFinder(id).matchEntireCell(true).findNext();
  if (found) return { ok: true, duplicate: true };

  const now = new Date();
  const short = function (s, n) { return String(s || '').replace(/[^\w가-힣·\- ]/g, '').slice(0, n); };
  sh.appendRow([
    id, now.toISOString(), Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd'),
    b.school, short(b.interest, 30), short(b.preferred, 40),
    (b.recommended || []).slice(0, 3).map(function (x) { return short(x, 40); }).join(','),
    overall].concat(ds).concat([JSON.stringify(clean), short(b.version, 10), false]));
  return { ok: true };
}

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, HEAD.length).getValues();
  return vals.map(function (r, i) {
    let answers = {};
    try { answers = JSON.parse(r[14] || '{}'); } catch (x) { /* ignore */ }
    return {
      row: i + 2, seq: i + 1, id: r[0], submitted_at: r[1], day: String(r[2]).slice(0, 10),
      school: r[3], interest: r[4], preferred: r[5],
      recommended: String(r[6] || '').split(',').filter(String),
      overall: Number(r[7]), ds: [r[8], r[9], r[10], r[11], r[12], r[13]].map(Number),
      answers: answers, version: r[15], deleted: r[16] === true || r[16] === 'TRUE'
    };
  });
}

function list_(b) {
  checkKey_(b);
  const all = rows_();
  return { ok: true, items: all.filter(function (x) { return !x.deleted; }), deletedCount: all.filter(function (x) { return x.deleted; }).length };
}

function setDeleted_(b, flag) {
  checkKey_(b);
  const ids = (b.ids || []).map(String);
  if (!ids.length) throw new Error('선택한 응답이 없습니다.');
  const sh = sheet_();
  let n = 0;
  rows_().forEach(function (r) {
    if (ids.indexOf(String(r.id)) >= 0 && r.deleted !== flag) {
      sh.getRange(r.row, HEAD.length).setValue(flag);
      n++;
    }
  });
  return { ok: true, changed: n };
}
function remove_(b) { return setDeleted_(b, true); }
function restore_(b) { return setDeleted_(b, false); }
