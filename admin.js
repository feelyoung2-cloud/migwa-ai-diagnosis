'use strict';
/* 미래과학교육원 AI·디지털 역량진단 — 관리자 통계 */
const { QS, DOMAINS, COURSES, TOPICS } = window.MIGWA;
const CFG = window.MIGWA_CONFIG || {};
const DEMO = !(CFG.supabaseUrl && CFG.supabaseKey);
const KEY_STORE = 'migwa.v2.adminSession';
const LOCAL_SUBMITS = 'migwa.v2.localSubmissions';
const PAGE = 20;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const NAMES = Object.fromEntries([...COURSES.map(c => [c.id, c.name]), ['undecided', '아직 정하지 못함']]);
const TOPIC_NAMES = Object.fromEntries([...TOPICS.map(t => [t.id, t.name]), ['', '결과에 맡김']]);

let all = [], view = [], page = 1, selected = new Set();

async function api(body) {
  if (DEMO) {
    const list = JSON.parse(localStorage.getItem(LOCAL_SUBMITS) || '[]');
    if (body.action === 'list') {
      return { ok: true, items: list.filter(x => !x.deleted).map((x, i) => ({ ...x, seq: i + 1, day: (x.submitted_at || '').slice(0, 10) })) };
    }
    if (body.action === 'delete') {
      list.forEach(x => { if (body.ids.includes(x.id)) x.deleted = true; });
      localStorage.setItem(LOCAL_SUBMITS, JSON.stringify(list));
      return { ok: true, changed: body.ids.length };
    }
  }
  if (body.action === 'list') {
    const rows = await rpc('migwa_admin_list', {});
    return { ok: true, items: rows };
  }
  if (body.action === 'delete') {
    const n = await rpc('migwa_admin_hide', { ids: body.ids });
    return { ok: true, changed: n };
  }
}

/* ── Supabase 로그인·호출 ── */
function session() { try { return JSON.parse(sessionStorage.getItem(KEY_STORE) || 'null'); } catch (e) { return null; } }
async function auth(grant, body) {
  const res = await fetch(`${CFG.supabaseUrl}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify(body)
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(/invalid/i.test(d.error_description || d.msg || d.error || '') ? '이메일 또는 비밀번호가 맞지 않아요.' : (d.error_description || d.msg || '로그인하지 못했어요.'));
  const s = { access: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 60) * 1000, email: d.user?.email };
  sessionStorage.setItem(KEY_STORE, JSON.stringify(s));
  return s;
}
async function token() {
  let s = session();
  if (!s) throw Error('로그인이 필요해요.');
  if (Date.now() > s.exp) s = await auth('refresh_token', { refresh_token: s.refresh });
  return s.access;
}
async function rpc(name, args) {
  const res = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(args)
  });
  const d = await res.json().catch(() => null);
  if (!res.ok) throw Error(d?.message || '요청을 처리하지 못했어요.');
  return d;
}

function hbar(label, text, pct, low) {
  return `<div class="hbar ${low ? 'low' : ''}"><div class="hbar-h"><b>${esc(label)}</b><span class="num">${esc(text)}</span></div><div class="hbar-t"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div></div>`;
}

async function load() {
  $('status').textContent = '불러오는 중…';
  try {
    const d = await api({ action: 'list' });
    all = d.items.map(x => ({ ...x, ds: (x.ds || []).map(Number), overall: Number(x.overall) }));
    applyFilter();
    $('status').textContent = `${new Date().toLocaleTimeString('ko-KR')} 기준 · 전체 ${all.length}건`;
  } catch (e) {
    $('status').textContent = e.message;
    if (/로그인|권한|JWT/i.test(e.message)) { logout(); $('loginStatus').textContent = e.message; }
  }
}

function applyFilter() {
  const s = $('fSchool').value, f = $('fFrom').value, t = $('fTo').value;
  view = all.filter(x => (!s || x.school === s) && (!f || x.day >= f) && (!t || x.day <= t));
  page = 1; selected.clear();
  render();
}

function render() {
  const n = view.length;
  $('kN').textContent = n.toLocaleString() + '건';
  const days = view.map(x => x.day).sort();
  $('kPeriod').textContent = n ? `${days[0]} ~ ${days[n - 1]}` : '조건에 맞는 응답이 없어요';
  const avg = mean(view.map(x => x.overall));
  $('kAvg').textContent = avg == null ? '—' : avg.toFixed(2);
  const dAvg = DOMAINS.map((_, i) => mean(view.map(x => x.ds[i])));
  if (n) {
    const hi = dAvg.indexOf(Math.max(...dAvg)), lo = dAvg.indexOf(Math.min(...dAvg));
    $('kHi').textContent = DOMAINS[hi]; $('kHiS').textContent = dAvg[hi].toFixed(2) + '점';
    $('kLo').textContent = DOMAINS[lo]; $('kLoS').textContent = dAvg[lo].toFixed(2) + '점';
  } else { ['kHi', 'kLo'].forEach(k => ($(k).textContent = '—')); ['kHiS', 'kLoS'].forEach(k => ($(k).textContent = '')); }

  $('domainBars').innerHTML = DOMAINS.map((d, i) => hbar(d, dAvg[i] == null ? '—' : dAvg[i].toFixed(2) + ' / 5', dAvg[i] == null ? 0 : (dAvg[i] - 1) / 4 * 100, dAvg[i] != null && dAvg[i] < 3)).join('');
  const count = (arr, key) => arr.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
  const sc = count(view, x => x.school);
  $('schoolBars').innerHTML = ['유치원', '초등', '중등', '특수', '기타'].map(s => hbar(s, `${sc[s] || 0}건 · ${n ? ((sc[s] || 0) / n * 100).toFixed(1) : 0}%`, n ? (sc[s] || 0) / n * 100 : 0)).join('');
  const pc = count(view, x => x.preferred);
  const prefIds = [...COURSES.map(c => c.id), 'undecided'].sort((a, b) => (pc[b] || 0) - (pc[a] || 0));
  $('prefBars').innerHTML = n ? prefIds.filter(id => pc[id]).map(id => hbar(NAMES[id] || id, `${pc[id]}건 · ${(pc[id] / n * 100).toFixed(1)}%`, pc[id] / n * 100)).join('') || '<p>희망 응답이 없어요.</p>' : '<p>응답이 없어요.</p>';
  const tc = count(view, x => x.interest || '');
  $('topicBars').innerHTML = n ? Object.keys(TOPIC_NAMES).filter(k => tc[k]).sort((a, b) => tc[b] - tc[a]).map(k => hbar(TOPIC_NAMES[k], `${tc[k]}건`, tc[k] / n * 100)).join('') : '<p>응답이 없어요.</p>';
  const rc = {};
  view.forEach(x => (x.recommended || []).forEach(id => (rc[id] = (rc[id] || 0) + 1)));
  $('courseRows').innerHTML = COURSES.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${rc[c.id] || 0}건</td><td class="num">${pc[c.id] || 0}건</td><td class="num">${n ? ((pc[c.id] || 0) / n * 100).toFixed(1) + '%' : '—'}</td></tr>`).join('');
  const qAvg = QS.map(q => ({ q, v: mean(view.map(x => Number(x.answers?.[q.id])).filter(Boolean)) })).filter(o => o.v != null).sort((a, b) => a.v - b.v).slice(0, 10);
  $('lowQs').innerHTML = qAvg.length ? qAvg.map(o => `<tr class="qrow"><td>${esc(o.q.text)}</td><td>${DOMAINS[o.q.d]}</td><td class="num">${o.v.toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="3">응답이 없어요.</td></tr>';
  renderRows();
}

function renderRows() {
  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  page = Math.min(page, pages);
  const items = view.slice((page - 1) * PAGE, page * PAGE);
  $('rows').innerHTML = items.length ? items.map(r => `<tr>
    <td><input type="checkbox" class="sel" value="${esc(r.id)}" aria-label="응답 ${r.seq} 선택" ${selected.has(r.id) ? 'checked' : ''}></td>
    <td class="num">${r.seq}</td><td class="num">${esc(r.day)}</td><td>${esc(r.school)}</td><td class="num">${r.overall.toFixed(2)}</td>
    <td>${esc(NAMES[r.preferred] || r.preferred)}</td><td><button class="btn ghost small det" data-id="${esc(r.id)}">상세</button></td></tr>`).join('')
    : '<tr><td colspan="7">조건에 맞는 응답이 없어요.</td></tr>';
  $('pInfo').textContent = `${page} / ${pages}쪽 · ${view.length}건`;
  $('pPrev').disabled = page <= 1; $('pNext').disabled = page >= pages;
  syncSel(items);
}
function syncSel(items = view.slice((page - 1) * PAGE, page * PAGE)) {
  $('selCount').textContent = selected.size + '건 선택';
  $('hideSel').disabled = !selected.size;
  $('selAll').checked = items.length > 0 && items.every(r => selected.has(r.id));
}

function csv() {
  const head = ['번호', '제출일', '학교급', '관심주제', '희망연수', '추천연수', '종합', ...DOMAINS, ...QS.map(q => q.id)];
  const lines = [head, ...view.map(r => [r.seq, r.day, r.school, TOPIC_NAMES[r.interest || ''] || r.interest, NAMES[r.preferred] || r.preferred,
    (r.recommended || []).map(id => NAMES[id] || id).join(' / '), r.overall.toFixed(3), ...r.ds.map(v => Number(v).toFixed(3)), ...QS.map(q => r.answers?.[q.id] ?? '')])];
  const text = '﻿' + lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = `AI디지털역량진단_응답_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}

function enter() { $('loginBox').hidden = true; $('dash').hidden = false; $('logout').hidden = DEMO; $('demoNote').hidden = !DEMO; load(); }
function logout() { sessionStorage.removeItem(KEY_STORE); $('dash').hidden = true; $('loginBox').hidden = false; $('logout').hidden = true; }

$('loginForm').onsubmit = async e => {
  e.preventDefault();
  $('loginStatus').textContent = '확인 중…';
  try {
    const s = await auth('password', { email: $('email').value.trim(), password: $('key').value });
    $('key').value = '';
    const ok = await rpc('migwa_is_admin', {});
    if (!ok) { sessionStorage.removeItem(KEY_STORE); throw Error(`${s.email} 계정은 아직 관리자로 등록되지 않았어요. 수파베이스에서 migwa_admins 표에 이 계정을 추가해 주세요.`); }
    $('loginStatus').textContent = ''; enter();
  } catch (err) { $('loginStatus').textContent = err.message; }
};
$('logout').onclick = logout;
$('filters').onsubmit = e => { e.preventDefault(); if ($('fFrom').value && $('fTo').value && $('fFrom').value > $('fTo').value) { $('status').textContent = '시작일이 종료일보다 늦어요.'; return; } applyFilter(); };
$('fReset').onclick = () => { $('filters').reset(); applyFilter(); };
$('reload').onclick = load;
$('csv').onclick = csv;
$('pPrev').onclick = () => { page--; renderRows(); };
$('pNext').onclick = () => { page++; renderRows(); };
$('rows').onchange = e => { if (e.target.matches('.sel')) { e.target.checked ? selected.add(e.target.value) : selected.delete(e.target.value); syncSel(); } };
$('selAll').onchange = e => { view.slice((page - 1) * PAGE, page * PAGE).forEach(r => (e.target.checked ? selected.add(r.id) : selected.delete(r.id))); renderRows(); };
$('rows').onclick = e => {
  const b = e.target.closest('.det'); if (!b) return;
  const r = view.find(x => x.id === b.dataset.id); if (!r) return;
  $('dTitle').textContent = `응답 ${r.seq} · ${r.day} · ${r.school}`;
  $('dBody').innerHTML = `<p style="margin-top:8px">종합 ${r.overall.toFixed(2)} · 희망: ${esc(NAMES[r.preferred] || r.preferred)}</p>` +
    DOMAINS.map((d, i) => hbar(d, Number(r.ds[i]).toFixed(2), (r.ds[i] - 1) / 4 * 100, r.ds[i] < 3)).join('') +
    `<div class="tablewrap"><table><tbody>${QS.map(q => `<tr><td>${esc(q.text)}</td><td class="num"><b>${r.answers?.[q.id] ?? '—'}</b></td></tr>`).join('')}</tbody></table></div>`;
  $('detail').showModal();
};
$('hideSel').onclick = async () => {
  const ids = [...selected];
  if (!confirm(`선택한 ${ids.length}건을 통계에서 숨길까요?\n시트의 deleted 칸을 FALSE로 바꾸면 다시 살릴 수 있어요.`)) return;
  $('hideSel').disabled = true;
  try { const d = await api({ action: 'delete', ids }); $('status').textContent = `${d.changed}건을 숨겼어요.`; selected.clear(); await load(); }
  catch (e) { $('status').textContent = e.message; $('hideSel').disabled = false; }
};

if (DEMO || session()) enter();
