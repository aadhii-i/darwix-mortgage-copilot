/* Darwix AI Mortgage Copilot: clickable prototype.
   AI listens → detects → suggests → captures → prepares.
   Agent decides → accepts / dismisses → escalates → approves.
   All data is mocked. Nothing is sent anywhere. */

/* ================= CONFIG ================= */

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'brief', label: 'Meeting brief' },
  { id: 'live', label: 'Live meeting' },
  { id: 'review', label: 'Meeting review' },
  { id: 'actions', label: 'Next actions' },
  { id: 'manager', label: 'Manager' },
  { id: 'ops', label: 'Operations' },
];

// The eight moments from slide 03, with how each one is detected.
const MOMENTS = [
  { id: 'profiling', label: 'Profiling', kind: 'hybrid' },
  { id: 'affordability', label: 'Affordability', kind: 'ai' },
  { id: 'product', label: 'Product explanation', kind: 'ai' },
  { id: 'conflict', label: 'Conflicting information', kind: 'rule' },
  { id: 'compliance', label: 'Compliance risk', kind: 'rule' },
  { id: 'missing', label: 'Missing information', kind: 'rule' },
  { id: 'competitor', label: 'Competitor objection', kind: 'ai' },
  { id: 'nba', label: 'Next best action', kind: 'hybrid' },
];
const KIND_LABEL = { ai: 'AI-generated', rule: 'Rule-based', hybrid: 'Hybrid' };

const TIER = {
  medium: 'Medium confidence · suggest, agent decides',
  high: 'High confidence · agent confirms before anything is recorded',
  risk: 'High confidence + high risk · warn, evidence, escalate',
};

const NUDGES = {
  affordability: {
    tier: 'medium', title: 'Darwix nudge',
    msg: 'Customer is uncertain about affordability.',
    sug: '“What monthly payment range would feel comfortable for you?”',
    why: 'Target payment has not been captured.',
    acts: [['use', 'Use nudge', 'primary'], ['dismiss', 'Dismiss'], ['escalate', 'Escalate']],
  },
  conflict: {
    tier: 'high', tone: 'rose', title: 'Conflicting information',
    msg: 'Income information may be inconsistent.',
    sug: 'Verify the correct figure before recording.',
    evidence: 'Sarah: “combined … around $140k”<br>Michael: “$90k and hers is around $40k” = $130k',
    why: 'Two borrowers gave figures $10k apart. No household income is recorded until it is verified.',
    acts: [['verify', 'Verify', 'primary'], ['dismiss', 'Dismiss'], ['escalate', 'Escalate']],
  },
  compliance: {
    tier: 'risk', title: 'Compliance review',
    msg: 'Consider avoiding an approval implication.',
    sug: 'Final approval depends on underwriting and verified information.',
    why: 'The statement implies a guaranteed approval. This event is recorded whatever you choose.',
    acts: [['rephrase', 'Rephrase', 'amber'], ['dismiss', 'Dismiss'], ['escalate', 'Escalate']],
  },
  competitor: {
    tier: 'medium', title: 'Competitor objection',
    msg: 'Customer is comparing offers.',
    sug: 'Identify what matters most: rate, payment, fees, or timeline.',
    why: 'Another lender was mentioned. Quote rates only from approved rate data, and never match an unverified claim.',
    acts: [['use', 'Use', 'primary'], ['dismiss', 'Dismiss']],
  },
  missing: {
    tier: 'high', title: 'Missing information',
    msg: 'Liability details are still missing.',
    sug: 'Flag the missing item before the next step.',
    why: 'Student loan amount and other debts have not been captured. Liabilities affect affordability and can’t be left out.',
    acts: [['confirm', 'Confirm', 'primary'], ['dismiss', 'Dismiss']],
  },
  nba: {
    tier: 'medium', title: 'Next best action',
    msg: 'Meeting is ending with no next step.',
    sug: 'Confirm the document checklist and a follow-up date.',
    why: 'No checklist or follow-up has been agreed in this meeting yet.',
    acts: [['confirm', 'Confirm', 'primary'], ['dismiss', 'Dismiss']],
  },
};

// Structured profile. Completeness counts every non-document field that holds
// captured information (verified, captured or pending). Missing and conflicting
// fields don't count. "Captured" never means "verified".
const FIELDS = [
  ['Identity', [['identity', 'Identity & contact', 'On file', 'verified', 'CRM · KYC check']]],
  ['Purchase', [
    ['firstTime', 'First-time buyer', 'Yes, both borrowers', 'captured', 'CRM'],
    ['timeline', 'Timeline', '2–4 weeks', 'captured', 'Web inquiry'],
  ]],
  ['Affordability', [
    ['target', 'Target monthly payment', '', 'missing'],
    ['down', 'Down payment', '~$45k savings (self-reported)', 'captured', 'Web inquiry'],
  ]],
  ['Employment', [
    ['emp1', 'Borrower 1 · Michael', 'Salaried · project engineer', 'captured', 'CRM'],
    ['emp2', 'Borrower 2 · Sarah', 'Contract / variable · verify', 'pending', 'CRM'],
  ]],
  ['Income', [
    ['inc1', 'Michael', '', 'missing'],
    ['inc2', 'Sarah', '', 'missing'],
    ['hh', 'Household', '', 'missing'],
  ]],
  ['Liabilities', [
    ['student', 'Student loan', 'Mentioned · amount unknown', 'missing', 'Web inquiry'],
    ['otherDebt', 'Other debts', '', 'missing'],
  ]],
  ['Concerns', [
    ['compOffer', 'Competitor offer', 'Spoke with another lender', 'captured', 'Web inquiry'],
    ['priority', 'What matters most', '', 'missing'],
  ]],
  ['Documents', [
    ['paystubs', 'Pay stubs', 'Not received', 'missing'],
    ['bank', 'Bank statements', 'Not received', 'missing'],
  ]],
];
const STATE_UI = {
  verified: ['✓', 'Verified'], captured: ['●', 'Captured'], pending: ['◐', 'Pending'],
  missing: ['○', 'Missing'], conflicting: ['≠', 'Conflicting'],
};
const PEOPLE = { agent: ['Agent', 'Dana'], sarah: ['Customer', 'Sarah'], michael: ['Customer', 'Michael'] };

const SCRIPT = [
  { w: 'agent', x: 'So you’re looking to purchase within the next few weeks?', t: 25 },
  { w: 'sarah', x: 'Yes, but we’re not sure what [[monthly payment]] we’d be comfortable with.', t: 40,
    quiet: 'Timeline confirmed · captured quietly',
    fx() { set('timeline', '2–4 weeks · confirmed in meeting', 'captured'); trigger('affordability'); } },
  { w: 'agent', x: 'That’s a good place to start. Let’s look at income next.', t: 70 },
  { w: 'sarah', x: 'Our [[combined income is around $140k]].', t: 35,
    quiet: 'Household income · captured quietly',
    fx() { set('hh', '$140k (stated)', 'captured'); } },
  { w: 'michael', x: '[[My income is $90k]] and [[hers is around $40k]].', t: 20,
    fx() {
      set('inc1', '$90k (stated)', 'captured');
      set('inc2', '$40k (stated)', 'captured');
      set('hh', '$140k stated vs $130k from individual figures', 'conflicting');
      trigger('conflict');
    } },
  { w: 'michael', x: 'So with all that, would we get approved for a $400k home?', t: 60 },
  { w: 'agent', x: '[[You should be approved for this.]]', t: 15, flagged: true,
    fx() { S.compliance.push({ at: S.clock, status: 'Open' }); trigger('compliance'); } },
  { w: 'sarah', x: '[[Another lender said they can give us a better rate.]]', t: 45,
    fx() { trigger('competitor'); } },
  { w: 'agent', x: 'Let me make sure we’ve covered everything before we wrap up.', t: 240,
    fx() { trigger('missing'); } },
  { w: 'sarah', x: 'This has been really helpful. [[What happens now?]]', t: 60,
    fx() { trigger('nba'); } },
];

const FOLLOW_UP = 'Mon, Sep 28 · 10:00 AM';

/* ================= STATE ================= */

let S;
function freshState() {
  const fields = {};
  FIELDS.forEach(([group, rows]) => rows.forEach(([k, label, val, st, src]) => {
    fields[k] = { k, group, label, val, st, src: src || '', flagged: false };
  }));
  return {
    view: 'dashboard', consent: false, started: false, ended: false, approved: false,
    line: 0, clock: 0, lines: [], rendered: 0,
    nudges: [],            // { id, at, status: 'active'|'done', outcome, tone, isNew }
    fields, log: [], compliance: [], escalations: 0, nextStep: false, liabFlagged: false,
    editing: false, summaryHTML: null, summaryEscalated: false,
    sys: { crm: 'draft', docs: 'prepared', cal: 'suggested', los: 'queued' },
    todos: {}, flashes: new Set(), guideMin: false,
  };
}
S = freshState();

/* ================= HELPERS ================= */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hl = s => esc(s).replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>');
const plain = s => s.replace(/\[\[|\]\]/g, '');
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const stateChip = st => `<span class="state s-${st}"><i>${STATE_UI[st][0]}</i>${STATE_UI[st][1]}</span>`;
const kindDot = kind => `<span class="dot ${kind}" title="${KIND_LABEL[kind]}"></span>`;
const ICON_SPARK = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0l1.8 6.2L16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8z"/></svg>';

function toast(msg, warn) {
  const t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.innerHTML = `<i>${warn ? '!' : '✓'}</i><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function say(w, x, extra = {}) {
  S.clock += extra.t || 12;
  S.lines.push({ w, x, at: S.clock, ...extra });
}
function set(k, val, st) {
  Object.assign(S.fields[k], { val, st, src: 'Meeting · ' + fmt(S.clock) });
  S.flashes.add(k);
}
function trigger(id) {
  S.nudges.unshift({ id, at: S.clock, status: 'active', isNew: true, lineIdx: S.lines.length - 1 });
}
function log(title, steps) { S.log.unshift({ at: S.clock, title, steps }); }
function active() { return S.nudges.filter(n => n.status === 'active'); }
function nudge(id) { return S.nudges.find(n => n.id === id); }

function completeness() {
  const rows = Object.values(S.fields).filter(f => f.group !== 'Documents');
  const have = rows.filter(f => ['verified', 'captured', 'pending'].includes(f.st)).length;
  return Math.round((have / rows.length) * 100);
}
function toVerify() {
  return Object.values(S.fields).filter(f => f.group !== 'Documents' && (f.st === 'pending' || f.st === 'conflicting'));
}
function docsNeeded() {
  return Object.values(S.fields).filter(f => f.group === 'Documents' && f.st !== 'verified');
}

/* ================= CONVERSATION ================= */

function advance() {
  if (S.ended || S.line >= SCRIPT.length) return;
  const L = SCRIPT[S.line++];
  say(L.w, L.x, { t: L.t, flagged: L.flagged, quiet: L.quiet });
  if (L.quiet) log(L.quiet.split(' · ')[0], ['Low confidence tier: no nudge shown', 'Captured quietly to profile']);
  if (L.fx) L.fx();
  render();
}

/* ================= AGENT DECISIONS ================= */

function resolve(n, outcome, tone, title, steps, toastMsg, warn) {
  n.status = 'done'; n.outcome = outcome; n.tone = tone; n.isNew = true;
  log(title, steps);
  if (toastMsg) toast(toastMsg, warn);
}
function escalate(n, title) {
  S.escalations++;
  resolve(n, 'Escalated to manager', 'up', title,
    ['Agent escalated to manager', 'Meeting continues'], 'Escalated to your manager', true);
}

function decide(id, action) {
  const n = S.nudges.find(x => x.id === id && x.status === 'active');
  if (!n) return;
  switch (id + ':' + action) {
    case 'affordability:use':
      say('agent', 'What monthly payment range would feel comfortable for you?', { t: 10, viaNudge: true });
      say('michael', 'Somewhere around [[$2,400 to $2,600 a month]].', { t: 15 });
      set('target', '$2,400–2,600 / month', 'captured');
      resolve(n, 'Accepted · target payment captured', 'ok', 'Affordability concern',
        ['Agent accepted suggestion', 'Target payment captured'], 'Nudge accepted · Target payment captured');
      break;
    case 'conflict:verify':
      say('agent', 'Thanks. I’ll confirm the exact figures from your pay stubs and tax documents before I record a household number.', { t: 15 });
      set('hh', 'Pending verification · not recorded', 'pending');
      resolve(n, 'Verify chosen · Income → Pending verification', 'ok', 'Conflicting information',
        ['Agent chose to verify', 'Income → Pending verification (not verified)'], 'Income marked Pending verification');
      break;
    case 'compliance:rephrase':
      say('agent', 'Final approval is subject to underwriting and verification.', { t: 8, revised: true });
      S.compliance[S.compliance.length - 1].status = 'Rephrased in meeting';
      resolve(n, 'Statement rephrased · event recorded', 'ok', 'Compliance risk: approval implication',
        ['Agent reviewed warning', 'Statement rephrased', 'Event recorded in activity log'], 'Statement rephrased · compliance event recorded');
      break;
    case 'compliance:dismiss':
      S.compliance[S.compliance.length - 1].status = 'Dismissed · sent for manager review';
      resolve(n, 'Dismissed · still recorded for review', 'no', 'Compliance risk: approval implication',
        ['Agent dismissed warning', 'Event recorded and sent to manager review'], 'Dismissed. The event is still recorded for review.', true);
      break;
    case 'compliance:escalate':
      S.compliance[S.compliance.length - 1].status = 'Escalated to manager';
      escalate(n, 'Compliance risk: approval implication');
      break;
    case 'competitor:use':
      say('agent', 'What matters most to you: the rate, the monthly payment, fees, or timeline?', { t: 10, viaNudge: true });
      say('michael', 'Mostly [[the monthly payment]], and [[the fees]].', { t: 15 });
      set('priority', 'Monthly payment + fees', 'captured');
      resolve(n, 'Accepted · priority captured', 'ok', 'Competitor objection',
        ['Agent accepted suggestion', 'Priority captured: monthly payment + fees'], 'Nudge accepted · Priority captured');
      break;
    case 'missing:confirm':
      S.fields.student.flagged = true; S.fields.otherDebt.flagged = true; S.liabFlagged = true;
      S.flashes.add('student'); S.flashes.add('otherDebt');
      resolve(n, 'Confirmed · liabilities flagged for follow-up', 'ok', 'Missing information',
        ['Agent confirmed', 'Liabilities flagged for follow-up (not excluded)'], 'Liabilities flagged for follow-up');
      break;
    case 'nba:confirm':
      say('agent', 'I’ll send you a checklist for pay stubs and bank statements, and let’s schedule a follow-up for Monday at 10 AM.', { t: 20, viaNudge: true });
      say('sarah', '[[Monday at 10 works.]]', { t: 8 });
      S.nextStep = true;
      ['paystubs', 'bank'].forEach(k => { S.fields[k].val = 'To request after meeting'; S.flashes.add(k); });
      resolve(n, 'Confirmed · checklist + follow-up agreed', 'ok', 'Next best action',
        ['Agent confirmed next step', 'Checklist (2 documents) + follow-up ' + FOLLOW_UP], 'Next step agreed');
      break;
    default:
      if (action === 'dismiss') {
        resolve(n, 'Dismissed', 'no', MOMENTS.find(m => m.id === id).label, ['Agent dismissed suggestion'], 'Suggestion dismissed');
      } else if (action === 'escalate') {
        escalate(n, MOMENTS.find(m => m.id === id).label);
      }
  }
  render();
}

/* ================= NAV + ROUTING ================= */

function go(view) {
  S.view = view;
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'v-' + view; });
  if (view === 'live') S.rendered = 0; // live skeleton is rebuilt, so replay transcript into it
  render();
  window.scrollTo({ top: 0 });
}

function renderNav() {
  const done = { dashboard: S.view !== 'dashboard' || S.started, brief: S.started, live: S.ended, review: S.approved };
  $('#nav').innerHTML = VIEWS.map((v, i) =>
    `<button type="button" data-nav="${v.id}" ${S.view === v.id ? 'aria-current="page"' : ''} class="${done[v.id] && S.view !== v.id ? 'done' : ''}"><span class="n">${i + 1}</span>${v.label}</button>`
  ).join('');
}

function render() {
  renderNav();
  ({ dashboard: renderDashboard, brief: renderBrief, live: renderLive, review: renderReview,
     actions: renderActions, manager: renderManager, ops: renderOps })[S.view]();
  renderGuide();
}

/* ================= 1 · DASHBOARD ================= */

function renderDashboard() {
  const pct = completeness();
  $('#v-dashboard').innerHTML = `
  <div class="page-head">
    <div><span class="eyebrow">Friday, September 25</span><h1>Good morning, Dana.</h1><p>4 meetings today. Darwix has prepared a brief for each one.</p></div>
  </div>
  <div class="dash">
    <div>
      <article class="feature">
        <div class="feature-top">
          <div>
            <span class="eyebrow">Next meeting · Today, 10:00 AM · In person</span>
            <h2>Sarah + Michael</h2>
            <p class="muted">First-time homebuyers · purchase consultation · Room 2</p>
          </div>
          <button class="btn primary lg" type="button" data-nav="${S.started ? 'live' : 'brief'}" data-cue="prepare">${S.started ? 'Return to meeting' : 'Prepare meeting'} →</button>
        </div>
        <div class="feature-body">
          <div><span class="label">Brief</span><div class="v">Ready · 5 priorities</div></div>
          <div><span class="label">Missing / verify</span><div class="v" style="color:var(--amber)">3 items</div></div>
          <div><span class="label">Profile completeness</span><div class="v pc"><div class="bar"><i style="width:${pct}%"></i></div>${pct}%</div></div>
        </div>
      </article>

      <div class="sched">
        <h3>Today’s meetings</h3>
        <div class="card" style="padding:0 20px">
          ${[
            ['10:00 AM', 'Sarah + Michael', 'First-time purchase · brief ready', pct, true],
            ['11:30 AM', 'James Okafor', 'Refinance review · brief ready', 78],
            ['1:30 PM', 'Priya + Dev Patel', 'Document review · 2 items to verify', 64],
            ['3:30 PM', 'Lena Nguyen', 'First-time buyer intro · brief ready', 42],
          ].map(([t, who, d, p]) => `
          <div class="meet-row">
            <span class="t">${t}</span>
            <div><div class="who">${who}</div><div class="d">${d}</div></div>
            <div class="pc"><div class="bar"><i style="width:${p}%"></i></div>${p}%</div>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <aside class="card">
      <div class="side-block">
        <h3>Follow-ups <span class="faint" style="font-weight:400">· 3</span></h3>
        <div class="list-row"><div>R. Alvarez: bank statements<div class="d">Requested Tue</div></div><span class="state s-pending"><i>◐</i>Due today</span></div>
        <div class="list-row"><div>M. Chen: rate question<div class="d">Answer from approved rate data</div></div><span class="state s-pending"><i>◐</i>Due today</span></div>
        <div class="list-row"><div>J. Okafor: appraisal update<div class="d">Customer asked Wed</div></div><span class="state s-conflicting"><i>!</i>1 day overdue</span></div>
      </div>
      <div class="side-block">
        <h3>Risk &amp; escalation items <span class="faint" style="font-weight:400">· 2</span></h3>
        <div class="list-row"><div>Patel: self-employed income<div class="d">Verification pending · 2 yrs tax returns</div></div><span class="state s-pending"><i>◐</i>Verify</span></div>
        <div class="list-row"><div>Nguyen: profile incomplete<div class="d">Liabilities and income not captured</div></div><span class="state s-missing"><i>○</i>42%</span></div>
      </div>
      <div class="side-block">
        <h3>Profile completeness</h3>
        <p class="muted" style="font-size:13px">Your average at meeting end this week is <b style="color:var(--ink)">81%</b>. Team target: 80%.</p>
      </div>
    </aside>
  </div>`;
}

/* ================= 2 · BRIEF ================= */

function renderBrief() {
  $('#v-brief').innerHTML = `
  <div class="page-head">
    <div><span class="eyebrow">Pre-meeting brief · Today, 10:00 AM</span><h1>Sarah + Michael</h1><p>First-time homebuyers · prepared by Darwix from CRM and the web inquiry.</p></div>
    <button class="btn ghost" type="button" data-nav="dashboard">← Dashboard</button>
  </div>
  <div class="brief">
    <div>
      <span class="label">Known</span>
      <div class="card known" style="margin-top:8px">
        ${[
          ['First-time buyers', 'Both borrowers. No formal application yet.', 'CRM'],
          ['Purchase timeline', '2–4 weeks. Target homes around $400k.', 'Web inquiry'],
          ['Employment / income', 'Michael: salaried project engineer. Sarah: contract / variable work. No income figures yet.', 'CRM'],
          ['Existing obligations', 'Student loan mentioned. Amount and payment unknown.', 'Web inquiry'],
          ['Competitor conversation', 'Spoke with another lender. Terms not shared.', 'Web inquiry'],
        ].map(([k, v, src]) => `<div class="known-row"><span class="k">${k}</span><span>${v}</span><span class="src">${src}</span></div>`).join('')}
      </div>
      <div class="missing-box">
        <span class="label" style="color:var(--amber)">Missing / verify</span>
        <ul>
          <li><span>⚠</span><div><b>Target monthly payment</b><span>Affordability preference hasn’t been captured yet.</span></div></li>
          <li><span>⚠</span><div><b>Liability details</b><span>Student loan amount unknown. Other debts not discussed.</span></div></li>
          <li><span>⚠</span><div><b>Some income verification</b><span>Sarah’s contract income will need documents before it is treated as verified.</span></div></li>
        </ul>
      </div>
    </div>

    <aside class="ai-panel">
      <span class="eyebrow">${ICON_SPARK.replace('<svg', '<svg width="11" height="11"')} Darwix AI priorities</span>
      <h2>What to cover in this meeting</h2>
      <ol class="prio">
        <li><b>Clarify affordability</b><span>Target monthly payment hasn’t been captured.</span></li>
        <li><b>Verify employment / income</b><span>Sarah’s income type is contract / variable.</span></li>
        <li><b>Confirm liabilities</b><span>Student loan details are incomplete.</span></li>
        <li><b>Understand competitor concern</b><span>Find out what matters most: rate, payment, fees or timeline.</span></li>
        <li><b>Agree next action</b><span>No application or follow-up exists yet.</span></li>
      </ol>
      <p class="ai-note">Darwix suggests and captures. It never approves a mortgage, decides eligibility or quotes rates outside approved data.</p>
      <label class="consent" id="consentWrap" for="consent"><input type="checkbox" id="consent" ${S.consent ? 'checked' : ''}><span><b style="font-weight:600">Both customers agreed to recording and transcription.</b><br><span class="muted" style="font-size:12px">Required before Darwix starts listening.</span></span></label>
      <button class="btn primary lg" id="startBtn" type="button" style="width:100%;margin-top:12px" ${S.consent ? '' : 'disabled'}>${S.started ? 'Return to meeting' : 'Start meeting'} →</button>
    </aside>
  </div>`;
}

/* ================= 3 · LIVE MEETING ================= */

function liveSkeleton() {
  $('#v-live').innerHTML = `
  <div class="live">
    <div class="live-bar">
      <span class="brand">DARWIX COPILOT</span>
      <span class="meet">Meeting: <b>Sarah + Michael</b></span>
      <span class="spacer"></span>
      <span class="rec" id="recState">Recording · transcribing</span>
      <span class="clock" id="clock">00:00</span>
      <span class="live-pill" id="livePill"><i></i>LIVE</span>
    </div>
    <div class="live-cols">
      <div class="pane">
        <div class="pane-h"><span class="label">Live transcript</span><span class="faint" style="font-size:12px" id="lineCount"></span></div>
        <div class="pane-b" id="transcript"></div>
      </div>
      <div class="pane">
        <div class="pane-h"><span class="label">Customer profile</span><span class="pc" id="pcTop"></span></div>
        <div class="pane-b" id="profile"></div>
      </div>
      <div class="pane copilot-pane">
        <div class="pane-h"><span class="eyebrow">Darwix copilot</span><span class="listening" id="listening"><i></i>Listening</span></div>
        <div class="pane-b" id="copilot"></div>
      </div>
    </div>
    <div class="strip" id="strip"></div>
    <div class="controls" id="controls"></div>
  </div>
  <div class="card log-card">
    <div class="pane-h"><span class="label">Activity log · every AI detection and agent decision</span><span class="faint" style="font-size:12px">The system records</span></div>
    <ol class="log" id="log"></ol>
  </div>`;
}

function renderLive() {
  if (!$('#transcript')) liveSkeleton();
  if (S.rendered === 0) $('#transcript').innerHTML = '';

  // Transcript: append only new lines so earlier lines don't re-animate.
  const tx = $('#transcript');
  if (!S.lines.length) {
    tx.innerHTML = `<p class="transcript-empty">Darwix is listening.<br>Click <b>Continue conversation</b> to play the meeting.</p>`;
  } else {
    if (S.rendered === 0) tx.innerHTML = '';
    S.lines.slice(S.rendered).forEach((L, i) => {
      const idx = S.rendered + i;
      const [role, name] = PEOPLE[L.w];
      const el = document.createElement('div');
      el.className = `utt ${L.w === 'agent' ? 'agent' : ''} ${L.flagged ? 'flagged' : ''} ${L.revised ? 'revised' : ''}`;
      el.id = 'utt-' + idx;
      el.innerHTML = `<div class="who"><span class="name">${role}${L.w === 'agent' ? '' : ' · ' + name}</span>${L.viaNudge ? '<span class="role">asked via nudge</span>' : ''}${L.revised ? '<span class="role">rephrased</span>' : ''}<span class="ts">${fmt(L.at)}</span></div>
        <div class="txt">“${hl(L.x)}”</div>
        <div class="tags"></div>`;
      tx.appendChild(el);
    });
    S.rendered = S.lines.length;
    tx.scrollTop = tx.scrollHeight;
  }
  // Detection tags: attach to the line where each moment fired.
  S.lines.forEach((L, idx) => {
    const tags = $('#utt-' + idx + ' .tags');
    if (!tags || tags.dataset.done) return;
    const fired = S.nudges.filter(n => n.lineIdx === idx);
    let html = '';
    if (L.quiet) html += `<div class="detect quiet">○ ${esc(L.quiet)}</div>`;
    fired.forEach(n => {
      const tone = n.id === 'compliance' ? 'amber' : n.id === 'conflict' ? 'rose' : '';
      const label = n.id === 'compliance' ? 'Compliance risk' : MOMENTS.find(m => m.id === n.id).label;
      html += `<div class="detect ${tone}">${ICON_SPARK} AI detects: ${esc(label)}</div>`;
    });
    if (html) { tags.innerHTML = html; tags.dataset.done = '1'; }
  });
  $('#lineCount').textContent = S.lines.length ? S.lines.length + ' lines' : '';

  // Profile
  const pr = $('#profile'), keep = pr.scrollTop;
  pr.innerHTML = FIELDS.map(([group, rows]) => `
    <div class="pgroup"><h4>${group}</h4>
      ${rows.map(([k]) => {
        const f = S.fields[k];
        return `<div class="frow ${S.flashes.has(k) ? 'flash' : ''}" id="f-${k}">
          <span class="l">${esc(f.label)}${f.flagged ? '<span class="flagfu">⚑ Follow-up</span>' : ''}</span>${stateChip(f.st)}
          <span class="v ${f.val ? '' : 'none'}">${esc(f.val || 'Not captured')}</span>
          ${f.src ? `<span class="src">${esc(f.src)}</span>` : ''}</div>`;
      }).join('')}
    </div>`).join('');
  pr.scrollTop = keep;
  const flash = pr.querySelector('.flash');
  if (flash) {
    const top = flash.offsetTop - 30;
    if (top < pr.scrollTop || top > pr.scrollTop + pr.clientHeight - 60) pr.scrollTo({ top, behavior: 'smooth' });
  }
  S.flashes.clear();
  const pct = completeness();
  $('#pcTop').innerHTML = `<div class="bar"><i style="width:${pct}%"></i></div>${pct}%`;

  // Copilot
  const act = active();
  const done = S.nudges.filter(n => n.status === 'done');
  $('#listening').innerHTML = S.ended ? 'Stopped' : act.length ? `<i></i>${act.length} to review` : '<i></i>Listening';
  $('#copilot').innerHTML =
    (act.length ? act.map(nudgeCard).join('')
      : `<div class="idle">${S.ended ? 'Meeting ended. Darwix has stopped listening.' : 'Listening quietly. Darwix only speaks up when a moment matters.'}</div>`)
    + (done.length ? `<div style="margin-top:14px"><span class="label">Handled</span>${done.map(n => `
        <div class="outcome ${n.isNew ? 'new' : ''}"><span class="ic ${n.tone}">${n.tone === 'ok' ? '✓' : n.tone === 'up' ? '↑' : '–'}</span>
        <span><b>${esc(n.id === 'compliance' ? 'Compliance review' : n.id === 'affordability' ? 'Affordability' : NUDGES[n.id].title)}</b><br><span class="muted">${esc(n.outcome)}</span></span>
        <span class="ts">${fmt(n.at)}</span></div>`).join('')}</div>` : '')
    + `<div class="moments"><span class="label">Moments Darwix watches</span>
        <ul>${MOMENTS.map(m => {
          const n = nudge(m.id);
          const st = !n ? 'watching' : n.status === 'active' ? 'now' : 'handled';
          return `<li class="${n ? 'fired' : ''}">${kindDot(m.kind)}${m.label}<span class="st">${st === 'watching' ? '·' : st === 'now' ? '●' : '✓'}</span></li>`;
        }).join('')}</ul>
        <div class="tiers"><span>${kindDot('ai')} AI-generated</span><span>${kindDot('rule')} Rule-based</span><span>${kindDot('hybrid')} Hybrid</span></div>
        <div class="tiers"><span><b>Low</b> stay silent, capture quietly</span><span><b>Medium</b> suggest, agent decides</span><span><b>High + high risk</b> warn, evidence, escalate</span></div>
      </div>`;
  S.nudges.forEach(n => { n.isNew = false; });

  // Status strip (mirrors slide 04)
  const f = S.fields;
  const captured = [
    f.timeline.src.startsWith('Meeting') && 'Timeline', 'Employment',
    (f.inc1.st === 'captured') && 'Income', f.target.st === 'captured' && 'Target payment',
    f.priority.st === 'captured' && 'Priority',
  ].filter(Boolean);
  const open = [
    (f.student.st === 'missing') && 'Liabilities', f.target.st !== 'captured' && 'Target payment',
    f.hh.st === 'conflicting' && 'Income (conflict)', f.hh.st === 'pending' && 'Income (verify)',
  ].filter(Boolean);
  const follow = toVerify().length + (S.liabFlagged ? 1 : 0);
  const comp = S.compliance[0];
  $('#strip').innerHTML = `
    <div><span class="label">Profile</span><div class="v indigo">${pct}% complete</div></div>
    <div><span class="label">Captured</span><div class="v">${captured.join(' · ')}</div></div>
    <div><span class="label">Open</span><div class="v amber">${open.join(' · ') || 'None'}</div></div>
    <div><span class="label">Follow-ups</span><div class="v">${follow} pending</div></div>
    <div><span class="label" style="${comp ? 'color:var(--amber)' : ''}">${comp ? '⚠ ' : ''}Compliance</span><div class="v ${comp ? 'amber' : ''}">${comp ? '1 flag · ' + esc(comp.status.toLowerCase()) : 'No flags'}</div></div>`;

  // Controls
  const scriptDone = S.line >= SCRIPT.length;
  $('#controls').innerHTML = S.ended
    ? `<span class="hint">Meeting ended at ${fmt(S.clock)}. Darwix drafted a summary for your review.</span><span class="spacer"></span><button class="btn primary" type="button" data-nav="review">Open meeting review →</button>`
    : `<button class="btn primary" type="button" id="continueBtn" ${scriptDone ? 'disabled' : ''}>Continue conversation ▸</button>
       <span class="hint">${scriptDone ? 'Conversation complete.' : `Simulated conversation · line ${S.line} of ${SCRIPT.length}`}</span>
       <span class="spacer"></span>
       <button class="btn" type="button" id="endBtn">End meeting</button>`;

  // Clock + status
  $('#clock').textContent = fmt(S.clock);
  $('#livePill').className = 'live-pill' + (S.ended ? ' ended' : '');
  $('#livePill').innerHTML = S.ended ? '<i></i>ENDED' : '<i></i>LIVE';
  $('#recState').textContent = S.ended ? 'Recording stopped' : 'Recording · transcribing';

  // Activity log
  $('#log').innerHTML = S.log.length
    ? S.log.map(l => `<li><span class="ts">${fmt(l.at)}</span><div><b>${l.title === 'Meeting started' || l.title === 'Meeting ended' ? '' : 'AI detected: '}${esc(l.title)}</b>${l.steps.map(s => `<span>${esc(s)}</span>`).join('')}</div></li>`).join('')
    : '<li><span class="ts">—</span><div class="faint">Every detection and every agent decision will be recorded here.</div></li>';
}

function nudgeCard(n) {
  const d = NUDGES[n.id];
  const m = MOMENTS.find(x => x.id === n.id);
  const buttons = `<div class="acts">${d.acts.map(([a, label, cls]) => `<button class="btn sm ${cls || ''}" type="button" data-n="${n.id}" data-a="${a}">${label}</button>`).join('')}</div>`;
  if (n.id === 'compliance') {
    const L = S.lines.find(l => l.flagged);
    return `<article class="nudge compliance ${n.isNew ? 'new' : ''}" role="alert">
      <div class="comp-band"><span>⚠ COMPLIANCE REVIEW</span><span>${kindDot('rule')} Rule-based</span></div>
      <div class="comp-body">
        <p class="msg">${esc(d.msg)}</p>
        <p class="sug">${esc(d.sug)}</p>
        <div class="evidence"><span class="label">Evidence · ${fmt(L.at)}</span>Agent: “${esc(plain(L.x))}”<br><span class="faint">Rule: approval implication · ${TIER.risk}</span></div>
        <div class="why"><span class="label">Why this appeared</span>${esc(d.why)}</div>
        ${buttons}
      </div></article>`;
  }
  return `<article class="nudge ${d.tone || ''} ${n.isNew ? 'new' : ''}">
    <div class="nudge-k"><span class="eyebrow">${ICON_SPARK.replace('<svg', '<svg width="11" height="11"')} ${esc(d.title)}</span><span class="conf">${kindDot(m.kind)}${KIND_LABEL[m.kind]}</span></div>
    <p class="msg">${esc(d.msg)}</p>
    <p class="sug">${esc(d.sug)}</p>
    ${d.evidence ? `<div class="evidence"><span class="label">Evidence</span>${d.evidence}</div>` : ''}
    <div class="why"><span class="label">Why this appeared</span>${esc(d.why)}<br><span class="faint" style="font-size:11.5px">${TIER[d.tier]}</span></div>
    ${buttons}
  </article>`;
}

/* ================= 4 · MEETING REVIEW ================= */

function summarySections() {
  const f = S.fields;
  const comp = S.compliance[0];
  const goals = [
    { t: 'Buy a first home in the next 2–4 weeks, targeting around $400k.', s: 'CRM · confirmed ' + fmt(S.lines[1] ? S.lines[1].at : 0) },
    f.target.st === 'captured'
      ? { t: 'Comfortable monthly payment: $2,400–2,600 (stated).', s: f.target.src.replace('Meeting · ', '') }
      : { t: 'Comfortable monthly payment was not captured.', v: true },
  ];
  const profile = [
    { t: 'Michael: salaried project engineer. Income $90k (stated).' },
    { t: 'Sarah: contract / variable work. Income ~$40k (stated).', v: true },
    f.hh.st === 'pending'
      ? { t: 'Household income: $140k stated vs $130k from individual figures. Pending verification, not recorded.', v: true }
      : f.hh.st === 'conflicting'
        ? { t: 'Household income: conflicting figures ($140k vs $130k), unresolved.', v: true }
        : { t: 'Household income not discussed.', v: true },
    { t: 'Down payment: ~$45k savings (self-reported).' },
  ];
  const concerns = [
    { t: 'Unsure what monthly payment is affordable.' },
    { t: f.priority.st === 'captured' ? 'Comparing another lender’s rate. Cares most about monthly payment and fees.' : 'Comparing another lender’s rate. Main priority not identified.' },
  ];
  const questions = [
    { t: 'Student loan balance and monthly payment.' },
    { t: 'Any other debts (auto, credit cards).' },
  ];
  if (f.target.st !== 'captured') questions.push({ t: 'What monthly payment feels comfortable?' });
  const docs = docsNeeded().map(d => ({ t: d.label + (d.k === 'paystubs' ? ' (last 30 days, both borrowers)' : ' (last 2 months)') }));
  const RISK_TEXT = {
    emp2: 'Borrower 2 (Sarah) employment: contract / variable income. Verify with documents.',
    hh: f.hh.st === 'pending' ? 'Household income: $140k vs $130k stated. Pending verification.' : 'Household income: conflicting figures, unresolved.',
  };
  const risks = toVerify().map(x => ({ t: RISK_TEXT[x.k] || `${x.group}: ${x.label}. ${x.val}`, v: true }));
  if (comp) risks.push({ t: `Compliance: approval implication at ${fmt(comp.at)}. ${comp.status}.`, v: true, s: 'Locked record' });
  risks.push({ t: 'Competitor rate claim is unverified. Compare with approved rate data only.' });
  const next = S.nextStep
    ? [{ t: 'Send document checklist (pay stubs, bank statements). Needs agent approval.' }, { t: 'Follow-up: ' + FOLLOW_UP + '.' }]
    : [{ t: 'No next step was agreed in the meeting. Schedule a follow-up.', v: true }];
  next.push({ t: 'Verify income and liabilities before any application step.' });
  return [['Customer goals', goals], ['Financial profile', profile], ['Concerns', concerns], ['Open questions', questions],
    ['Documents', docs], ['Risks / items to verify', risks], ['Next steps', next]];
}

function renderReview() {
  const el = $('#v-review');
  if (!S.ended) {
    el.innerHTML = `<div class="gate"><span class="eyebrow">Meeting review</span><h2>The review is drafted when the meeting ends.</h2><p class="muted">End the meeting from the live workspace. Darwix drafts a summary, and nothing is sent until you approve it.</p><button class="btn primary" type="button" data-nav="${S.started ? 'live' : 'brief'}">${S.started ? 'Back to live meeting' : 'Go to meeting brief'}</button></div>`;
    return;
  }
  const comp = S.compliance.length;
  el.innerHTML = `
  <div class="page-head">
    <div><span class="eyebrow">Meeting review · Sarah + Michael · ${fmt(S.clock)}</span><h1>Darwix drafted this. You decide what’s recorded.</h1></div>
  </div>
  <div class="stats">
    <div class="stat"><span class="label">Profile completeness</span><div class="big">${completeness()}%</div><div class="sub">Captured, not verified</div></div>
    <div class="stat amber"><span class="label">Open verification items</span><div class="big">${toVerify().length}</div><div class="sub">${toVerify().map(f => f.group === 'Income' ? 'Income' : f.label.split(' · ')[0]).join(' · ') || 'None'}</div></div>
    <div class="stat ${comp ? 'amber' : ''}"><span class="label">Compliance items</span><div class="big">${comp}</div><div class="sub">${comp ? esc(S.compliance[0].status) : 'None'}</div></div>
    <div class="stat"><span class="label">Documents needed</span><div class="big">${docsNeeded().length}</div><div class="sub">Pay stubs · Bank statements</div></div>
  </div>
  <div class="review">
    <article class="card doc ${S.editing ? 'editing' : ''}">
      <div class="doc-h"><h2>Meeting summary</h2><span class="draft-badge ${S.approved ? 'ok' : ''}">${S.approved ? 'Approved by agent' : 'Draft · not approved'}</span></div>
      <div id="sumBody">${S.summaryHTML || summarySections().map(([h, items]) => `
        <section class="sec"><h3>${h}</h3><ul ${S.editing ? 'contenteditable="true"' : ''}>${items.map(i =>
          `<li>${i.v ? stateChip('pending') : ''}<span>${esc(i.t)}</span>${i.s ? `<span class="src">${esc(i.s)}</span>` : ''}</li>`).join('')}</ul></section>`).join('')}</div>
    </article>
    <aside class="side">
      <div class="card">
        <h3>${S.approved ? 'Summary approved' : 'Review before anything moves'}</h3>
        <p class="muted" style="font-size:13px">${S.approved ? 'Next actions are ready. Anything the customer will see still needs your approval.' : 'Edit anything that’s wrong. Timestamps point back to the conversation.'}</p>
        <div class="btn-row">
          ${S.approved
            ? '<button class="btn primary" type="button" data-nav="actions">View next actions →</button>'
            : `<button class="btn" type="button" id="editBtn">${S.editing ? 'Done editing' : 'Edit'}</button>
               <button class="btn primary" type="button" id="approveBtn">Approve summary</button>
               <button class="btn" type="button" id="escSumBtn" ${S.summaryEscalated ? 'disabled' : ''}>${S.summaryEscalated ? 'Escalated' : 'Escalate'}</button>`}
        </div>
      </div>
      <div class="card">
        <span class="label">What approval does</span>
        <ul class="guard-list">
          <li><span>✓</span><span>Prepares a CRM draft, a document request and a follow-up suggestion</span></li>
          <li><span>✓</span><span>Keeps unverified figures labelled “stated”</span></li>
          <li><span style="color:var(--amber)">✕</span><span>Sends nothing externally without your approval</span></li>
          <li><span style="color:var(--amber)">✕</span><span>Never decides eligibility or approval</span></li>
        </ul>
      </div>
    </aside>
  </div>`;
}

/* ================= 5 · NEXT ACTIONS ================= */

function renderActions() {
  const el = $('#v-actions');
  if (!S.approved) {
    el.innerHTML = `<div class="gate"><span class="eyebrow">Next actions</span><h2>Approve the meeting summary first.</h2><p class="muted">Darwix only prepares actions from a summary the agent has approved.</p><button class="btn primary" type="button" data-nav="${S.ended ? 'review' : S.started ? 'live' : 'brief'}">${S.ended ? 'Go to meeting review' : 'Continue the demo'}</button></div>`;
    return;
  }
  const todos = [
    ['pay', 'Collect pay stubs', 'Both borrowers · last 30 days'],
    ['bank', 'Collect bank statements', 'Last 2 months · joint and individual accounts'],
    ['verify', 'Verify income / liabilities', 'Household income pending · student loan and other debts missing'],
    ['fu', 'Schedule follow-up', S.nextStep ? 'Agreed in meeting · ' + FOLLOW_UP : 'Suggested · ' + FOLLOW_UP],
  ];
  const doneChip = label => `<span class="ok-chip">✓ ${label}</span>`;
  el.innerHTML = `
  <div class="page-head">
    <div><span class="eyebrow">Post-meeting · Sarah + Michael</span><h1>Next actions</h1><p>Created from the approved summary. Sensitive actions wait for you.</p></div>
    <button class="btn" type="button" data-nav="manager">Manager view →</button>
  </div>
  <div class="na-grid">
    <div class="card">
      <h2>To do</h2>
      <ol class="todo">${todos.map(([id, w, d]) => `
        <li class="${S.todos[id] ? 'done' : ''}"><div><div class="w">${w}</div><div class="d">${esc(d)}</div></div>
        <input type="checkbox" data-todo="${id}" aria-label="Mark “${w}” done" ${S.todos[id] ? 'checked' : ''}></li>`).join('')}</ol>
    </div>
    <div class="card">
      <h2>Prepared system actions</h2>
      <div class="sys"><div class="nm">CRM<small>Write · approved fields</small></div>
        <div class="what"><b>Draft update:</b> meeting summary, ${completeness()}% profile (unverified values labelled “stated”), 4 tasks.</div>
        <div class="go">${S.sys.crm === 'draft' ? '<button class="btn primary sm" type="button" data-sys="crm">Approve &amp; sync</button>' : doneChip('Synced')}</div></div>
      <div class="sys"><div class="nm">Document workflow<small>Customer-facing · approval</small></div>
        <div class="what"><b>Request prepared:</b> pay stubs and bank statements, sent to both borrowers by secure link.</div>
        <div class="go">${S.sys.docs === 'prepared' ? '<button class="btn primary sm" type="button" data-sys="docs">Review &amp; send</button>' : doneChip('Sent')}</div></div>
      <div class="sys"><div class="nm">Calendar<small>Customer-facing · approval</small></div>
        <div class="what"><b>Follow-up suggested:</b> ${FOLLOW_UP}, 30 min.</div>
        <div class="go">${S.sys.cal === 'suggested' ? '<button class="btn primary sm" type="button" data-sys="cal">Review invite</button>' : doneChip('Invite sent')}</div></div>
      <div class="sys"><div class="nm">LOS<small>Write · pre-application</small></div>
        <div class="what"><div class="warnbox"><b>⚠ Loan system unavailable.</b> Information safely queued for agent review.</div></div>
        <div class="go"><button class="btn sm" type="button" data-sys="los">Retry</button></div></div>
      <p class="pilot-note"><b>PILOT</b> = mocked integrations · <b>PRODUCTION</b> = live CRM / LOS / approved product data</p>
    </div>
  </div>`;
}

/* ================= 6 · MANAGER ================= */

function renderManager() {
  const mine = S.ended;
  const comp = S.compliance[0];
  const compOpen = comp && comp.status !== 'Rephrased in meeting';
  const escCount = 2 + S.escalations + (S.summaryEscalated ? 1 : 0);
  $('#v-manager').innerHTML = `
  <div class="page-head">
    <div><span class="eyebrow">Manager · Northgate team · Today</span><h1>Where attention is needed</h1><p>Summaries, decisions and flags. Raw conversations stay out of view by default.</p></div>
    <button class="btn" type="button" data-nav="ops">Operations →</button>
  </div>
  <div class="tiles">
    <div class="tile"><span class="label">Meetings</span><div class="big">24</div><div class="sub">today, team-wide</div></div>
    <div class="tile"><span class="label">Completed</span><div class="big">18</div><div class="sub">${mine ? 'incl. Sarah + Michael' : '6 in progress or upcoming'}</div></div>
    <div class="tile attn"><span class="label">Follow-ups due</span><div class="big">5</div><div class="sub">1 overdue</div></div>
    <div class="tile attn"><span class="label">Incomplete profiles</span><div class="big">3</div><div class="sub">below 70% at meeting end</div></div>
    <div class="tile attn"><span class="label">Escalations</span><div class="big">${escCount}</div><div class="sub">awaiting review</div></div>
  </div>
  <div class="mgr">
    <div class="card">
      <div class="card-h"><h2>Needs attention</h2><span class="faint" style="font-size:12px">Ranked by risk</span></div>
      <ul class="attn-list">
        ${mine ? `<li class="mine"><span class="sev ${compOpen ? 'amber' : 'indigo'}"></span>
          <div><div class="who">Sarah + Michael<small>Dana Brooks · 10:00 AM · just completed</small></div>
            <div class="why">${S.approved ? 'Summary approved.' : 'Summary awaiting agent approval.'} ${completeness()}% profile · ${toVerify().length} items to verify · follow-up ${S.nextStep ? 'agreed' : 'not agreed'}.</div>
            <div class="chips">${comp ? `<span class="state ${compOpen ? 's-pending' : 's-verified'}"><i>${compOpen ? '⚠' : '✓'}</i>Compliance: ${compOpen ? 'review' : 'rephrased in meeting'}</span>` : ''}
              <span class="state s-pending"><i>◐</i>${toVerify().length} to verify</span>
              ${S.escalations ? `<span class="state s-conflicting"><i>↑</i>${S.escalations} escalated</span>` : ''}</div></div>
          <div class="r">Follow-up<br>Mon 10:00</div></li>` : ''}
        <li><span class="sev amber"></span><div><div class="who">Patel household<small>J. Kim · 9:00 AM</small></div><div class="why">Compliance alert dismissed without a rephrase (“rate is locked” before lock).</div><div class="chips"><span class="state s-pending"><i>⚠</i>Compliance review</span></div></div><div class="r">2h open</div></li>
        <li><span class="sev rose"></span><div><div class="who">D. Okafor<small>M. Ruiz · 8:30 AM</small></div><div class="why">Escalated: two part-time incomes, and the agent is unsure how to verify them.</div><div class="chips"><span class="state s-conflicting"><i>↑</i>Escalation</span></div></div><div class="r">Waiting 3h</div></li>
        <li><span class="sev"></span><div><div class="who">L. Nguyen<small>A. Shah · yesterday</small></div><div class="why">Profile 42% at meeting end. Liabilities and income not captured.</div><div class="chips"><span class="state s-missing"><i>○</i>Incomplete profile</span></div></div><div class="r">Follow-up today</div></li>
      </ul>
    </div>
    <div class="card">
      <div class="card-h"><h2>Meeting quality</h2><span class="faint" style="font-size:12px">This week · tick = pilot target</span></div>
      ${[
        ['Information completeness', 82, 80, 'Median profile at meeting end'],
        ['Follow-up completion', 91, 90, 'Follow-ups done by their due date'],
        ['AI intervention acceptance', 64, 50, 'Healthy range 40–75%. Much higher may mean rubber-stamping.'],
      ].map(([l, v, t, n]) => `<div class="metric"><div class="top"><span>${l}</span><b>${v}%</b></div><div class="track" title="${l}: ${v}% (target ${t}%)"><i style="width:${v}%"></i><s style="left:${t}%"></s></div><div class="note">${n}</div></div>`).join('')}
      <div class="metric"><div class="top"><span>Compliance alerts</span><b>${3 + (comp ? 1 : 0)}</b></div><div class="note">${2 + (comp && !compOpen ? 1 : 0)} resolved in meeting · ${1 + (compOpen ? 1 : 0)} need review</div></div>
      <div class="metric"><div class="top"><span>Unresolved items</span><b>${5 + (mine ? toVerify().length : 0)}</b></div><div class="note">Verification pending across open files</div></div>
    </div>
  </div>
  <div class="privacy"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>
    <span>Managers see summaries, agent decisions and flagged evidence, not full transcripts. Opening a transcript requires a stated reason and is logged.</span></div>`;
}

/* ================= 7 · OPERATIONS ================= */

function renderOps() {
  const mine = S.approved;
  const verifyCount = mine ? toVerify().length : 0;
  $('#v-ops').innerHTML = `
  <div class="page-head">
    <div><span class="eyebrow">Operations · back office</span><h1>Workflow and system status</h1><p>When an integration fails, work is queued, never lost, and never blocks the agent.</p></div>
  </div>
  <div class="ops">
    <div>
      <span class="label">Documentation</span>
      <div class="docq" style="margin-top:8px">
        <div><span class="label">Pending</span><div class="big">${3 + (mine ? 2 : 0)}</div><div class="sub muted" style="font-size:12px">${mine ? 'incl. 2 for Sarah + Michael' : 'across 3 customers'}</div></div>
        <div class="amber"><span class="label">Verification required</span><div class="big">${verifyCount}</div><div class="sub muted" style="font-size:12px">${mine ? 'Household income · Borrower 2 employment' : 'None open'}</div></div>
      </div>
      <div class="card" style="padding:20px 22px">
        <h2>Queue</h2>
        <ul class="queue-list">
          ${mine ? `<li><div>Sarah + Michael: pre-application data<div class="d">Held for LOS · waiting for agent review</div></div><span class="warn-chip">⚠ Queued</span></li>
          <li><div>Sarah + Michael: document request<div class="d">Pay stubs, bank statements</div></div>${S.sys.docs === 'sent' ? '<span class="ok-chip">✓ Sent</span>' : '<span class="warn-chip">◐ Awaiting agent</span>'}</li>
          <li><div>Sarah + Michael: CRM profile update<div class="d">Unverified values labelled “stated”</div></div>${S.sys.crm === 'synced' ? '<span class="ok-chip">✓ Synced</span>' : '<span class="warn-chip">◐ Awaiting agent</span>'}</li>` : ''}
          <li><div>R. Alvarez: bank statements<div class="d">Requested Tue · reminder scheduled</div></div><span class="warn-chip">◐ Pending</span></li>
          <li><div>Patel household: tax returns<div class="d">Self-employed · 2 years required</div></div><span class="warn-chip">◐ Pending</span></li>
        </ul>
      </div>
    </div>
    <div class="card">
      <h2>System status</h2>
      <div class="sysrow"><span class="nm">CRM<small>READ · WRITE</small></span><span class="ok-chip">✓ Synced</span><span class="d">${mine && S.sys.crm === 'synced' ? 'Sarah + Michael update synced after agent approval.' : 'All approved updates synced. Last sync 2 min ago.'}</span></div>
      <div class="sysrow"><span class="nm">LOS<small>READ · WRITE</small></span><span class="warn-chip">⚠ Temporarily unavailable</span>
        <span class="d"><div class="warnbox" style="margin-top:6px"><b>Loan system unavailable.</b> Information safely queued for agent review. Nothing is lost, and meetings and follow-ups keep running.</div></span></div>
      <div class="sysrow"><span class="nm">Document workflow<small>WRITE</small></span><span class="ok-chip">✓ ${S.sys.docs === 'sent' ? 'Request sent' : 'Request prepared'}</span><span class="d">Customer-facing requests go out only after agent approval.</span></div>
      <div class="sysrow"><span class="nm">Calendar<small>READ · WRITE</small></span><span class="ok-chip">✓ ${S.sys.cal === 'sent' ? 'Invite sent' : 'Follow-up suggested'}</span><span class="d">Availability read. Invites sent only by the agent.</span></div>
      <div class="sysrow"><span class="nm">Product &amp; rate data<small>READ</small></span><span class="ok-chip">✓ Approved data current</span><span class="d">The only source Darwix uses for rate or product explanations.</span></div>
      <p class="pilot-note"><b>PILOT</b> = mocked integrations · <b>PRODUCTION</b> = live CRM / LOS / approved product data · <b>FUTURE</b> = deeper automation, advanced analytics</p>
    </div>
  </div>
  <div class="bounds">
    <div class="b-read"><h4>Read</h4>Customer context · Loan / application status · Approved rate data · Calendar context</div>
    <div class="b-write"><h4>Write</h4>Structured notes · Follow-up tasks · Profile fields · Approved CRM updates</div>
    <div class="b-appr"><h4>Requires approval</h4>Customer-facing messages · Material profile updates · Sensitive actions · Escalations</div>
    <div class="b-never"><h4>Never automate</h4>Final approval · Eligibility decisions · Rate misrepresentation · Excluding liabilities · Binding promises</div>
  </div>
  <p class="tagline">AI can recommend. <em>The agent decides.</em> The system records.</p>`;
}

/* ================= GUIDED DEMO ================= */

function guideStep() {
  const a = active().map(n => n.id);
  switch (S.view) {
    case 'dashboard':
      return S.started ? { n: 3, text: 'The meeting is in progress. <b>Return to meeting</b>.', cue: '[data-cue=prepare]' }
        : { n: 1, text: '<b>Prepare for Sarah + Michael.</b> Click <b>Prepare meeting</b>.', cue: '[data-cue=prepare]' };
    case 'brief':
      if (S.started) return { n: 2, text: 'Meeting in progress. <b>Return to meeting</b>.', cue: '#startBtn' };
      return S.consent ? { n: 2, text: 'Darwix prepared the priorities. <b>Start meeting</b>.', cue: '#startBtn' }
        : { n: 2, text: 'Review what’s known and missing, then confirm recording consent.', cue: '#consentWrap' };
    case 'live': {
      if (S.ended) return { n: 12, text: 'Meeting ended. <b>Open meeting review</b>.', cue: '[data-nav=review].btn' };
      if (a.includes('compliance')) return { n: 10, text: '<b>Compliance warning</b> with evidence. Click <b>Rephrase</b>.', cue: '[data-n=compliance][data-a=rephrase]' };
      if (a.includes('affordability')) return { n: 4, text: 'Darwix nudges the agent and says why. Click <b>Use nudge</b>.', cue: '[data-n=affordability][data-a=use]' };
      if (a.includes('conflict')) return { n: 8, text: 'Conflicting income flagged. Click <b>Verify</b>. It won’t mark anything as verified.', cue: '[data-n=conflict][data-a=verify]' };
      if (a.includes('competitor')) return { n: 10, text: 'Competitor objection. Click <b>Use</b>.', cue: '[data-n=competitor][data-a=use]' };
      if (a.includes('missing')) return { n: 10, text: 'Liabilities still missing. <b>Confirm</b> to flag them for follow-up.', cue: '[data-n=missing][data-a=confirm]' };
      if (a.includes('nba')) return { n: 10, text: 'No next step yet. <b>Confirm</b> the checklist and follow-up.', cue: '[data-n=nba][data-a=confirm]' };
      if (S.line >= SCRIPT.length) return { n: 11, text: 'Conversation done. <b>End meeting</b>.', cue: '#endBtn' };
      if (S.line === 0) return { n: 3, text: 'Meeting is live. Click <b>Continue conversation</b>.', cue: '#continueBtn' };
      if (S.line === 1) return { n: 3, text: 'The customer is about to raise affordability. <b>Continue</b>.', cue: '#continueBtn' };
      if (S.line === 2 && S.fields.target.st === 'captured') return { n: 6, text: 'Profile updated: <b>Target payment → Captured</b>. Continue the meeting.', cue: '#continueBtn' };
      if (S.line < 5) return { n: 7, text: 'The borrowers talk about income. <b>Continue</b>.', cue: '#continueBtn' };
      if (S.line < 7) return { n: 9, text: 'Watch what happens when the agent implies approval. <b>Continue</b>.', cue: '#continueBtn' };
      return { n: 10, text: 'Continue the conversation.', cue: '#continueBtn' };
    }
    case 'review':
      if (!S.ended) return { n: 11, text: 'Finish the meeting first.', cue: '.gate .btn' };
      return S.approved ? { n: 14, text: 'Summary approved. <b>View next actions</b>.', cue: '[data-nav=actions].btn' }
        : { n: 13, text: 'Darwix drafted the summary. Review it, then <b>Approve summary</b>.', cue: '#approveBtn' };
    case 'actions':
      if (!S.approved) return { n: 13, text: 'Approve the summary first.', cue: '.gate .btn' };
      return S.sys.crm === 'draft' ? { n: 14, text: 'Next actions created. <b>Approve &amp; sync</b> the CRM draft.', cue: '[data-sys=crm]' }
        : { n: 15, text: 'Open the <b>Manager view</b> to see the outcome.', cue: '[data-nav=manager].btn' };
    case 'manager':
      return { n: 15, text: 'The manager sees the outcome, not raw conversation. Open <b>Operations</b>.', cue: '[data-nav=ops].btn' };
    case 'ops':
      return { n: 16, text: 'LOS is down, but the work is queued and nothing broke. <b>Demo complete.</b>', cue: null, end: true };
  }
  return { n: 1, text: '', cue: null };
}

function renderGuide() {
  const g = guideStep();
  document.querySelectorAll('.cue').forEach(el => el.classList.remove('cue'));
  if (g.cue && !S.guideMin) { const el = document.querySelector(g.cue); if (el) el.classList.add('cue'); }
  $('#guide').classList.toggle('guide-min', S.guideMin);
  $('#guideIn').innerHTML = `
    <span class="step">Guided demo · ${g.n} / 16</span>
    <span class="txt">${g.text}</span>
    <span class="prog" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i class="${i < g.n ? 'on' : ''}"></i>`).join('')}</span>
    ${g.end ? '<button class="gbtn" type="button" id="restartBtn">Restart demo</button>' : '<button class="gbtn ghost" type="button" id="restartBtn">Restart</button>'}
    <button class="gbtn ghost" type="button" id="guideToggle">${S.guideMin ? 'Show guide' : 'Hide'}</button>`;
}

/* ================= MODALS ================= */

function modal(html) {
  $('#modalRoot').innerHTML = `<div class="scrim" data-scrim="1"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $('#modalRoot .modal button, #modalRoot .modal textarea');
  if (first) first.focus();
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

/* ================= EVENTS ================= */

document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset && t.dataset.scrim) { closeModal(); return; }
  const btn = t.closest('button, [data-nav]');
  if (!btn) return;

  if (btn.dataset.nav) { go(btn.dataset.nav); return; }
  if (btn.dataset.n) { decide(btn.dataset.n, btn.dataset.a); return; }
  if (btn.dataset.sys) { systemAction(btn.dataset.sys); return; }

  switch (btn.id) {
    case 'startBtn':
      if (!S.consent) return;
      if (!S.started) { S.started = true; log('Meeting started', ['Recording consent confirmed', 'Darwix listening']); }
      go('live'); break;
    case 'continueBtn': advance(); break;
    case 'endBtn': {
      const open = active().length;
      modal(`<span class="eyebrow">End meeting</span><h2>End the meeting with Sarah + Michael?</h2>
        <p class="muted">Recording stops and Darwix drafts a summary for your review. Nothing is sent externally.</p>
        ${open ? `<div class="warnbox" style="margin-top:12px"><b>${open} suggestion${open > 1 ? 's' : ''} still open.</b> ${open > 1 ? 'They’ll' : 'It’ll'} be listed as unresolved in the review.</div>` : ''}
        <div class="row"><button class="btn ghost" type="button" id="cancelModal">Keep going</button><button class="btn primary" type="button" id="confirmEnd">End meeting</button></div>`);
      break;
    }
    case 'confirmEnd':
      S.ended = true;
      active().forEach(n => { n.status = 'done'; n.outcome = 'Left open at meeting end'; n.tone = 'no'; });
      log('Meeting ended', ['Draft summary generated', 'Awaiting agent review']);
      closeModal(); go('review'); break;
    case 'cancelModal': closeModal(); break;
    case 'editBtn':
      if (S.editing) {
        const body = $('#sumBody');
        body.querySelectorAll('[contenteditable]').forEach(u => u.removeAttribute('contenteditable'));
        S.summaryHTML = body.innerHTML; S.editing = false; toast('Edits saved to the draft');
      } else { S.editing = true; }
      render();
      if (S.editing) { const u = $('#sumBody ul'); if (u) u.focus(); }
      break;
    case 'approveBtn':
      if (S.editing) {
        const body = $('#sumBody');
        body.querySelectorAll('[contenteditable]').forEach(u => u.removeAttribute('contenteditable'));
        S.summaryHTML = body.innerHTML; S.editing = false;
      }
      S.approved = true;
      toast('Summary approved. Next actions prepared; nothing sent.');
      go('actions'); break;
    case 'escSumBtn':
      S.summaryEscalated = true; toast('Summary escalated to your manager. You can still approve it.', true); render(); break;
    case 'sendDocs':
      S.sys.docs = 'sent'; closeModal(); toast('Document request sent to Sarah + Michael'); render(); break;
    case 'sendInvite':
      S.sys.cal = 'sent'; closeModal(); toast('Follow-up invite sent'); render(); break;
    case 'restartBtn':
      S = freshState(); closeModal(); go('dashboard'); break;
    case 'guideToggle':
      S.guideMin = !S.guideMin; renderGuide(); break;
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'consent') { S.consent = e.target.checked; render(); }
  if (e.target.dataset.todo) { S.todos[e.target.dataset.todo] = e.target.checked; render(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalRoot').innerHTML) closeModal(); });

function systemAction(k) {
  if (k === 'crm') { S.sys.crm = 'synced'; toast('CRM updated from the approved summary'); render(); return; }
  if (k === 'los') { toast('LOS still unavailable. Data stays safely queued, with auto-retry every 5 min.', true); return; }
  if (k === 'docs') {
    modal(`<span class="eyebrow">Customer-facing · requires approval</span><h2>Document request</h2>
      <label class="fld" for="docMsg"><span class="label">Message to Sarah + Michael</span>
      <textarea id="docMsg" rows="9">Hi Sarah and Michael,

Thanks for meeting today. To keep things moving, please upload these through the secure link:

• Pay stubs (last 30 days, both of you)
• Bank statements (last 2 months)

This helps us review your options. It is not an approval or a commitment to lend.

Dana</textarea></label>
      <div class="row"><button class="btn ghost" type="button" id="cancelModal">Cancel</button><button class="btn primary" type="button" id="sendDocs">Approve &amp; send</button></div>`);
  }
  if (k === 'cal') {
    modal(`<span class="eyebrow">Customer-facing · requires approval</span><h2>Follow-up invite</h2>
      <label class="fld" for="calWhen"><span class="label">When</span><input type="text" id="calWhen" value="${FOLLOW_UP}"></label>
      <label class="fld" for="calNote"><span class="label">Note</span><textarea id="calNote" rows="3">30-minute call to go through payment options and review your documents.</textarea></label>
      <div class="row"><button class="btn ghost" type="button" id="cancelModal">Cancel</button><button class="btn primary" type="button" id="sendInvite">Approve &amp; send</button></div>`);
  }
}

// Live clock: ticks while the meeting is running.
setInterval(() => {
  if (S.started && !S.ended) {
    S.clock += 1;
    const c = $('#clock'); if (c && S.view === 'live') c.textContent = fmt(S.clock);
  }
}, 1000);

go('dashboard');
