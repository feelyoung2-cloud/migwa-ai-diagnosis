'use strict';
/* 미래과학교육원 AI·디지털 역량진단 — 응답자 화면 */
const M = window.MIGWA;
const CFG = window.MIGWA_CONFIG || {};
const LIVE = !!(CFG.supabaseUrl && CFG.supabaseKey);
const { QS, DOMAINS, DESC, PRACTICES, COURSES, TOPICS } = M;
const AREAS = ['태도', '이해', '적용', '설계'];
const SCALE = ['전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'];
const STORE = 'migwa.v2.progress';
const LOCAL_SUBMITS = 'migwa.v2.localSubmissions';
const N = QS.length;

const $ = id => document.getElementById(id);
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let S = fresh();
let report = null;
let advanceTimer = null;

function fresh() {
  return { v: 2, id: uuid(), school: '', interest: '', answers: {}, idx: 0, submitted: false, preferred: '', updated: 0 };
}
function save() {
  S.updated = Date.now();
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ }
}
function load() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (x && x.v === 2 && x.answers) return x;
  } catch (e) { /* ignore */ }
  return null;
}
function answered() { return QS.filter(q => S.answers[q.id]).length; }
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
function show(id) {
  ['intro', 'survey', 'result'].forEach(x => ($(x).hidden = x !== id));
  window.scrollTo(0, 0);
}

/* ───────── 시작 화면 ───────── */
function renderIntro() {
  $('domainStrip').innerHTML = DOMAINS.map((d, i) =>
    `<div><i style="--o:${0.35 + i * 0.13}"></i><b>${d}</b><span>${DESC[i]}</span></div>`).join('');
  const prev = load();
  if (prev && Object.keys(prev.answers).length && !prev.submitted) {
    const n = QS.filter(q => prev.answers[q.id]).length;
    $('resume').hidden = false;
    $('resumeInfo').textContent = `${prev.school} · ${n} / ${N} 응답 · ${new Date(prev.updated).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    $('resumeBtn').onclick = () => { S = prev; startSurvey(); };
    $('freshBtn').onclick = () => { localStorage.removeItem(STORE); $('resume').hidden = true; toast('새로 시작할 수 있어요. 학교급을 골라 주세요.'); };
  }
  $('schoolGrid').onclick = e => {
    const b = e.target.closest('[data-school]'); if (!b) return;
    const keep = load();
    S = (keep && !keep.submitted && Object.keys(keep.answers).length) ? keep : fresh();
    S.school = b.dataset.school;
    save();
    startSurvey();
  };
}

/* ───────── 진단 ───────── */
function startSurvey() {
  show('survey');
  const first = QS.findIndex(q => !S.answers[q.id]);
  if (first === -1) { renderResult(); return; }
  S.idx = Math.min(S.idx ?? first, N - 1);
  if (S.answers[QS[S.idx].id] && first >= 0) S.idx = first;
  renderQ('in');
}

function renderSegs() {
  const cur = QS[S.idx].d;
  $('segs').innerHTML = DOMAINS.map((d, i) => {
    const all = QS.filter(q => q.d === i), done = all.filter(q => S.answers[q.id]).length;
    return `<button class="seg ${i === cur ? 'on' : ''}" data-d="${i}" aria-label="${d} ${done}/${all.length}" ${i === cur ? 'aria-current="step"' : ''}>
      <span class="track"><span class="fill" style="transform:scaleX(${done / all.length})"></span></span>
      <span class="lab">${d}</span></button>`;
  }).join('');
  $('count').textContent = answered();
  $('toResultBtn').hidden = answered() < N;
  $('prevBtn').disabled = S.idx === 0;
}

function renderQ(dir) {
  const q = QS[S.idx];
  const firstOfDomain = QS.findIndex(x => x.d === q.d) === S.idx;
  const domainQs = QS.filter(x => x.d === q.d);
  const pos = domainQs.indexOf(q) + 1;
  const val = S.answers[q.id] || 0;
  const hint = q.a === 0 ? '평소 생각과 실천에 가까운 정도를 골라 주세요.' : '지금 실제로 할 수 있는 정도를 골라 주세요.';
  $('qcard').innerHTML = `
    ${firstOfDomain ? `<div class="domain-intro"><span class="di-n num">${q.d + 1}/6</span><div><b>${DOMAINS[q.d]}</b><span>${DESC[q.d]}</span></div></div>` : ''}
    <p class="q-label">${DOMAINS[q.d]} <span>· ${AREAS[q.a]} · ${pos}/${domainQs.length}</span></p>
    <h2 class="q-text" id="qText" tabindex="-1">${esc(q.text)}</h2>
    <p class="q-hint">${hint}</p>
    <div class="answers" role="radiogroup" aria-labelledby="qText">
      ${SCALE.map((t, i) => `<button class="ans" role="radio" aria-checked="${val === i + 1}" data-v="${i + 1}"><span class="dot">${i + 1}</span>${t}</button>`).join('')}
    </div>`;
  const card = $('qcard');
  card.classList.remove('q-enter', 'q-back');
  void card.offsetWidth;
  card.classList.add(dir === 'back' ? 'q-back' : 'q-enter');
  renderSegs();
  const focusEl = val ? card.querySelector('[aria-checked=true]') : card.querySelector('.ans');
  if (focusEl && document.activeElement && document.activeElement !== document.body) focusEl.focus({ preventScroll: true });
}

function choose(v) {
  const q = QS[S.idx];
  S.answers[q.id] = v;
  save();
  $('qcard').querySelectorAll('.ans').forEach(b => b.setAttribute('aria-checked', String(Number(b.dataset.v) === v)));
  renderSegs();
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(next, reduced ? 60 : 230);
}

function next() {
  if (S.idx < N - 1) {
    S.idx++;
    // 이미 답한 문항을 다시 보는 중이 아니라면 다음 빈 문항으로
    save();
    renderQ('in');
    return;
  }
  const missing = QS.findIndex(q => !S.answers[q.id]);
  if (missing >= 0) {
    S.idx = missing; save(); renderQ('in');
    toast(`답하지 않은 문항이 ${N - answered()}개 있어요.`);
  } else {
    renderResult();
  }
}
function prev() {
  if (S.idx > 0) { clearTimeout(advanceTimer); S.idx--; save(); renderQ('back'); }
}

$('qcard').addEventListener('click', e => {
  const b = e.target.closest('.ans'); if (b) choose(Number(b.dataset.v));
});
$('segs').addEventListener('click', e => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  const d = Number(b.dataset.d);
  const target = QS.findIndex(q => q.d === d && !S.answers[q.id]);
  S.idx = target >= 0 ? target : QS.findIndex(q => q.d === d);
  save(); renderQ('in');
});
$('prevBtn').onclick = prev;
$('homeBtn').onclick = () => { show('intro'); renderIntro(); };
$('toResultBtn').onclick = () => renderResult();
document.addEventListener('keydown', e => {
  if ($('survey').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
  if (/^[1-5]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key)); }
  else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); prev(); }
  else if (e.key === 'ArrowRight' && S.answers[QS[S.idx].id]) { e.preventDefault(); next(); }
});

/* ───────── 점수·추천 계산 ───────── */
function level(x) { return x < 2 ? '기초 탐색' : x < 3 ? '기초 다지기' : x < 4 ? '수업 적용' : '설계·확장'; }
const LEVEL_NOTE = {
  '기초 탐색': '처음 시작하는 단계예요. 원격·기초 과정으로 부담 없이 감을 잡아 보세요.',
  '기초 다지기': '익숙한 도구는 쓰고 있어요. 수업에 바로 옮길 수 있는 기초·기본 과정이 잘 맞아요.',
  '수업 적용': '수업에서 이미 실천하고 있어요. 데이터·평가까지 넓히는 기본·심화 과정을 권해요.',
  '설계·확장': '수업을 설계하고 나눌 수 있는 단계예요. 심화·전문가 과정으로 동료와 함께 확장해 보세요.'
};

function calculate(answers, school, interest) {
  const ds = DOMAINS.map((_, i) => mean(QS.filter(q => q.d === i).map(q => answers[q.id])));
  const ready = DOMAINS.map((_, i) => mean(QS.filter(q => q.d === i && q.a > 0).map(q => answers[q.id])));
  const areas = AREAS.map((_, i) => mean(QS.filter(q => q.a === i).map(q => answers[q.id])));
  const design = mean(QS.filter(q => [2, 3, 5].includes(q.d) && q.a === 3).map(q => answers[q.id]));
  const courses = COURSES.map((c, index) => {
    const w = c.w;
    const sum = w.reduce((x, y) => x + y, 0) || 1;
    const r = w.reduce((s, v, i) => s + v * ready[i], 0) / sum;
    const need = w.reduce((s, v, i) => s + v * (5 - ds[i]) / 4, 0) / sum;
    const why = [];
    if (school !== '기타' && !c.schools.includes(school)) why.push(`대상: ${c.schools.join('·')} 교원`);
    if (c.gate === 'adv' && r < 3) why.push('연계 역량 3점 미만 · 기초·기본 과정을 먼저 권해요');
    if (c.gate === 'expert' && (r < 4 || design < 3.5)) why.push('수업 설계 경험을 조금 더 쌓은 뒤 권해요');
    const fit = Math.max(0, 1 - Math.abs(r - c.target) / 2);
    const score = 70 * fit + 20 * need + (interest && c.topics.includes(interest) ? 14 : 0) + (cohortStatus(c).kind === 'open' ? 6 : 0);
    const linked = w.map((x, d) => ({ x, d, s: ds[d] })).filter(o => o.x > 0).sort((a, b) => a.s - b.s || b.x - a.x).slice(0, 2);
    return { ...c, r, need, score, why, linked, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return { ds, ready, areas, design, overall: mean(ds), courses };
}

/* ───────── 결과 ───────── */
function radarSVG(ds) {
  const cx = 220, cy = 196, R = 140, n = 6;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n, rr = R * (v - 1) / 4;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };
  const ring = v => DOMAINS.map((_, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
  let g = '';
  [2, 3, 4, 5].forEach(v => (g += `<polygon points="${ring(v)}" fill="none" stroke="#ffffff22" stroke-width="1"/>`));
  DOMAINS.forEach((_, i) => { const [x, y] = pt(i, 5); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#ffffff1a"/>`; });
  const poly = ds.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
  g += `<polygon points="${poly}" fill="#7fd0bf40" stroke="#7fd0bf" stroke-width="2.5" stroke-linejoin="round"/>`;
  ds.forEach((v, i) => { const [x, y] = pt(i, v); g += `<circle cx="${x}" cy="${y}" r="4.5" fill="#7fd0bf"/>`; });
  DOMAINS.forEach((d, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    const x = cx + (R + 34) * Math.cos(a), y = cy + (R + 30) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < .2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    const short = d.replace('인공지능(AI)', '인공지능').replace('디지털 안전과 윤리', '안전과 윤리');
    g += `<text x="${x.toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="${anchor}">${short}</text>`;
    g += `<text class="sc" x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}" text-anchor="${anchor}">${ds[i].toFixed(2)}</text>`;
  });
  return `<title id="radarT">6개 역량 점수 방사형 그래프: ${DOMAINS.map((d, i) => d + ' ' + ds[i].toFixed(2)).join(', ')}</title>` + g;
}

const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
const md = iso => iso ? `${Number(iso.slice(5, 7))}. ${Number(iso.slice(8, 10))}.` : '';
function cohortStatus(c) {
  const ks = c.cohorts || [];
  const open = ks.find(k => k.applyEnd && k.applyEnd >= TODAY && (!k.self || k.start <= TODAY));
  if (open) return { kind: 'open', k: open, text: `지금 신청 가능 · ${open.gi} (${open.self ? '연수 기간 중 신청' : '신청 마감 ' + md(open.applyEnd)})` };
  const soon = ks.find(k => k.start && k.start > TODAY);
  if (soon) return { kind: 'soon', k: soon, text: `다음 기수 · ${soon.gi} ${md(soon.start)} 시작${soon.self ? ', 기간 중 신청' : ''}` };
  return { kind: 'closed', text: '2026년 기수 운영 종료 · 2027 계획 공문을 확인하세요' };
}
function cohortLine(c) {
  if (!c.cohorts || !c.cohorts.length) return '';
  const st = cohortStatus(c);
  return `<p class="cohort"><b>${esc(st.text)}</b><br>2026년 ${c.cohorts.length > 1 ? c.cohorts.length + '개 기수' : '1회'} 운영 · 신청: ${esc(c.apply_how)}</p>`;
}

function renderRecs() {
  const r = report;
  const rec = r.courses.filter(c => !c.why.length).slice(0, 3);
  $('recs').innerHTML = rec.length ? `<div class="recs">${rec.map((c, i) => {
    const gap = c.linked.some(x => x.s < 3);
    const reason = `${c.linked.map(x => `${DOMAINS[x.d]} ${x.s.toFixed(2)}점`).join(', ')}을 ${gap ? '채우는 데' : '넓히는 데'} 맞는 ${c.level} 과정이에요.` +
      (S.interest && c.topics.includes(S.interest) ? ' 고른 관심 주제와도 같아요.' : '');
    return `<article class="rec ${i === 0 ? 'first' : ''}">
      <span class="rk">${i === 0 ? '가장 잘 맞아요' : '함께 보면 좋아요'}</span>
      <h3>${esc(c.name)}</h3>
      <div class="tags"><span>${esc(c.level)}</span><span>${c.hours ? c.hours + '시간' : '시간 확인'}</span><span>${esc(c.mode)}</span><span>${esc(c.schools.join('·'))}</span></div>
      <p class="why">${reason}</p>
      <p>${esc(c.content)}</p>
      ${cohortLine(c)}
      ${c.conditions ? `<p class="cond">신청 조건: ${esc(c.conditions)}</p>` : ''}
    </article>`;
  }).join('')}</div>` : `<div class="empty">지금 학교급과 준비도에 꼭 맞는 과정을 찾지 못했어요. 아래 전체 연수에서 대상과 내용을 확인해 보세요.</div>`;

  const nowList = r.courses.filter(c => (S.school === '기타' || c.schools.includes(S.school)))
    .map(c => ({ c, st: cohortStatus(c) })).filter(o => o.st.kind !== 'closed')
    .sort((a, b) => (a.st.kind === 'open' ? 0 : 1) - (b.st.kind === 'open' ? 0 : 1));
  $('recs').innerHTML += nowList.length ? `<div class="now"><h3>지금 신청할 수 있는 2026 연수</h3><ul>${nowList.map(o =>
    `<li class="${o.st.kind}"><b>${esc(o.c.name)}</b><span>${esc(o.st.text)}<br>${esc(o.c.apply_how)}</span></li>`).join('')}</ul></div>` : '';

  $('catalogCount').textContent = `${r.courses.length}개 과정`;
  $('catalog').innerHTML = r.courses.map(c => `<details>
      <summary><span>${esc(c.name)}<small>${esc(c.level)} · ${c.hours ? c.hours + '시간' : '시간 확인'} · ${esc(c.mode)} · ${esc(c.schools.join('·'))}</small></span>
      <span class="st ${c.why.length ? '' : 'ok'}">${c.why.length ? '확인 필요' : rec.includes(c) ? '추천' : '가능'}</span></summary>
      <div class="body">
        <p>${esc(c.content)}</p>
        ${c.why.length ? `<p><b>참고</b> ${esc(c.why.join(' / '))}</p>` : ''}
        ${c.cohorts && c.cohorts.length ? `<p><b>${esc(cohortStatus(c).text)}</b></p><p><b>2026 기수</b> ${c.cohorts.map(k => esc(k.gi) + (k.period ? ' ' + esc(k.period) : '')).join(' · ')}</p><p><b>신청</b> ${esc(c.apply_how)}</p>` : ''}
        ${c.conditions ? `<p><b>조건</b> ${esc(c.conditions)}</p>` : ''}
        ${c.note ? `<p>${esc(c.note)}</p>` : ''}
        <p><b>나의 연계 역량 준비도</b> ${c.r.toFixed(2)}점</p>
      </div></details>`).join('');
  renderPrefs(rec);
}

function renderPrefs(rec) {
  const rest = report.courses.filter(c => !rec.includes(c));
  const item = c => `<label class="pref"><input type="radio" name="pref" value="${c.id}" ${S.preferred === c.id ? 'checked' : ''} ${S.submitted ? 'disabled' : ''}>${esc(c.name)}${rec.includes(c) ? '<em>추천</em>' : ''}</label>`;
  const restOpen = rest.some(c => c.id === S.preferred);
  $('prefList').innerHTML = rec.map(item).join('') +
    `<label class="pref"><input type="radio" name="pref" value="undecided" ${S.preferred === 'undecided' ? 'checked' : ''} ${S.submitted ? 'disabled' : ''}>아직 정하지 못했어요</label>` +
    `<details class="more-prefs" ${restOpen ? 'open' : ''}><summary class="btn text small">다른 연수에서 고르기 (${rest.length}개)</summary><div class="pref-list">${rest.map(item).join('')}</div></details>`;
}

function renderResult() {
  report = calculate(S.answers, S.school, S.interest);
  const r = report;
  show('result');
  const lv = level(r.overall);
  $('overall').textContent = r.overall.toFixed(2);
  $('levelPill').textContent = lv + ' 단계';
  $('levelNote').textContent = LEVEL_NOTE[lv];
  $('resMeta').textContent = `${S.school} · ${N}문항 · ${new Date().toLocaleDateString('ko-KR')}`;
  $('radar').innerHTML = radarSVG(r.ds);
  $('dbars').innerHTML = r.ds.map((s, i) => `<div class="dbar ${s < 3 ? 'low' : ''}"><div class="dbar-h"><b>${DOMAINS[i]}</b><span class="num">${s.toFixed(2)} · ${level(s)}</span></div><div class="dbar-t"><i style="width:${Math.max(3, (s - 1) / 4 * 100)}%;animation-delay:${i * 70}ms"></i></div></div>`).join('');
  $('areaRow').innerHTML = r.areas.map((s, i) => `<div><b class="num">${s.toFixed(2)}</b><span>${AREAS[i]}</span></div>`).join('');

  const idx = r.ds.map((s, i) => ({ s, i }));
  const hi = idx.filter(x => x.s >= 4), lo = idx.filter(x => x.s < 3);
  const top = hi.length ? hi.sort((a, b) => b.s - a.s).slice(0, 2) : [idx.reduce((a, b) => (b.s > a.s ? b : a))];
  const low = lo.length ? lo.sort((a, b) => a.s - b.s).slice(0, 2) : [idx.reduce((a, b) => (b.s < a.s ? b : a))];
  $('swList').innerHTML =
    top.map(x => `<div class="sw"><b>강점 · ${DOMAINS[x.i]} ${x.s.toFixed(2)}</b><span>${DESC[x.i]}</span></div>`).join('') +
    low.map(x => `<div class="sw need"><b>다음 걸음 · ${DOMAINS[x.i]} ${x.s.toFixed(2)}</b><span class="tip">${PRACTICES[x.i]}</span></div>`).join('');

  $('topics').innerHTML = `<button class="chip" data-t="" aria-pressed="${!S.interest}">결과에 맡기기</button>` +
    TOPICS.map(t => `<button class="chip" data-t="${t.id}" aria-pressed="${S.interest === t.id}">${esc(t.name)}</button>`).join('');
  renderRecs();
  syncSubmitted();
  $('resultTitle').focus({ preventScroll: true });
}

$('topics').addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  S.interest = b.dataset.t; save();
  report = calculate(S.answers, S.school, S.interest);
  $('topics').querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.t === S.interest)));
  renderRecs();
});
$('prefList').addEventListener('change', e => { if (e.target.name === 'pref') { S.preferred = e.target.value; save(); } });

function syncSubmitted() {
  const done = S.submitted;
  $('submitBtn').disabled = done;
  $('consent').disabled = done;
  $('consent').checked = done || $('consent').checked;
  $('submitBtn').textContent = done ? '제출 완료' : '익명으로 제출';
  if (done) { $('submitStatus').className = 'status ok'; $('submitStatus').textContent = '제출했어요. 참여해 주셔서 고맙습니다.'; }
}

$('submitBtn').onclick = async () => {
  if (S.submitted) return;
  const st = $('submitStatus');
  if (location.hash === '#demo') { st.className = 'status err'; st.textContent = '예시 결과 화면이라 제출되지 않아요. 직접 진단한 뒤 제출해 주세요.'; return; }
  if (!S.preferred) { st.className = 'status err'; st.textContent = '희망 연수를 하나 골라 주세요.'; $('prefList').querySelector('input').focus(); return; }
  if (!$('consent').checked) { st.className = 'status err'; st.textContent = '익명 활용 동의에 체크해 주세요.'; $('consent').focus(); return; }
  const r = report;
  const payload = {
    action: 'submit', version: '2.0', id: S.id, school: S.school, interest: S.interest || '',
    preferred: S.preferred, recommended: r.courses.filter(c => !c.why.length).slice(0, 3).map(c => c.id),
    overall: +r.overall.toFixed(3), ds: r.ds.map(x => +x.toFixed(3)), answers: S.answers, consent: true
  };
  const btn = $('submitBtn'); btn.disabled = true; btn.textContent = '보내는 중…';
  st.className = 'status'; st.textContent = '';
  try {
    if (LIVE) {
      const res = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/migwa_submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey },
        body: JSON.stringify({ payload })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw Error(body.message || '저장하지 못했어요.');
    } else {
      // 서버 주소가 없으면 미리보기 모드: 이 기기에만 저장
      const list = JSON.parse(localStorage.getItem(LOCAL_SUBMITS) || '[]');
      if (!list.some(x => x.id === payload.id)) list.push({ ...payload, submitted_at: new Date().toISOString() });
      localStorage.setItem(LOCAL_SUBMITS, JSON.stringify(list));
    }
    S.submitted = true; save();
    renderPrefs(r.courses.filter(c => !c.why.length).slice(0, 3));
    syncSubmitted();
    if (!LIVE) st.textContent = '미리보기 모드라 이 기기에만 저장했어요. (config.js에 수파베이스 주소를 넣으면 실제로 모입니다)';
  } catch (e) {
    btn.disabled = false; btn.textContent = '다시 제출';
    st.className = 'status err';
    st.textContent = '제출을 확인하지 못했어요. 응답은 그대로 남아 있으니 다시 눌러 주세요. 같은 응답은 한 번만 집계돼요.';
  }
};

$('editBtn').onclick = () => { if (S.submitted) { toast('이미 제출한 응답은 고칠 수 없어요.'); return; } S.idx = 0; save(); show('survey'); renderQ('in'); };
$('printBtn').onclick = $('printBtn2').onclick = () => {
  document.querySelectorAll('#catalog details').forEach(d => (d.open = true));
  try { window.print(); } catch (e) { toast('인쇄가 막혀 있어요. 결과 파일(HTML) 저장을 이용해 주세요.'); }
};
$('htmlBtn').onclick = () => {
  let css = '';
  try { for (const sh of document.styleSheets) { try { for (const rule of sh.cssRules) css += rule.cssText + '\n'; } catch (e) { /* 외부 시트 */ } } } catch (e) { /* ignore */ }
  const copy = $('resultMain').cloneNode(true);
  copy.querySelectorAll('.no-print').forEach(el => el.remove());
  copy.querySelectorAll('details').forEach(d => (d.open = true));
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI·디지털 역량진단 결과</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><style>${css}</style></head><body><div class="wrap">${copy.outerHTML}</div></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `AI디지털역량진단_결과_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('결과 파일을 저장했어요.');
};
$('resetBtn').onclick = () => {
  if (!confirm('응답과 결과를 모두 지우고 처음부터 할까요?')) return;
  localStorage.removeItem(STORE); S = fresh(); report = null;
  $('consent').checked = false; $('submitStatus').textContent = '';
  show('intro'); renderIntro();
};

/* 시작 */
renderIntro();
const saved = load();
if (location.hash === '#demo') {
  // 결과 화면 미리보기용 예시 응답 (저장하지 않음)
  S = fresh(); S.school = '초등';
  QS.forEach((q, i) => (S.answers[q.id] = [4, 3, 4, 5, 3, 2, 4, 3, 3, 4][i % 10] - (q.d === 3 ? 1 : 0)));
  save = () => {};
  renderResult();
} else if (saved && saved.submitted && QS.every(q => saved.answers[q.id])) { S = saved; renderResult(); }
