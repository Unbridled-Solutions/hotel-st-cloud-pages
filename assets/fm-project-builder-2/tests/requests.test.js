/*
 * "Need an update?" requests (FMRequests). Run with:   node tests/requests.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var R = isNode ? require('../src/fm-phase2-requests.js') : globalThis.FMRequests;
var ST = isNode ? require('../src/fm-phase2-store.js') : globalThis.FMStore;

var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

var UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
var KRISTY = { name: 'Kristy Slaughenhaupt', email: 'kslaugh@unbridled.com', access: 'full' };
var PENROSE = { jobCode: 'FM-2609-314', customer: 'Braddy Builders', projectName: 'Penrose' };

test('where: the page, job, tab and open step become one plain sentence', function () {
  var w = R.where('#/job/FM-2609-314/changes', { job: PENROSE, flow: 'new change order', step: 'Cabinets' });
  eq([w.area, w.jobCode], ['job:changes', 'FM-2609-314']);
  eq(w.label, 'Braddy Builders · Penrose (FM-2609-314) › Change orders › new change order, step: Cabinets');
  eq(R.where('#/books/pnl').label, 'Company books › Job P&L');
  eq(R.where('#/new', { flow: 'New project', step: 'Price' }).label, 'New project › New project, step: Price');
  eq(R.where('#/somewhere-odd').area, 'other');
});

test('a request needs a kind, a place and a few words; screenshots must be images or PDFs under 10 MB', function () {
  eq(R.check({}), ['Pick what kind of update it is.', 'Pick where in the tool it is.', 'Tell us a little about it. One sentence is plenty.']);
  eq(R.check({ kind: 'idea', area: 'books', text: 'meh' }), ['Add a few more words so Lindsay knows what to look at.']);
  var p = R.check({ kind: 'broken', area: 'other', text: 'Save does nothing', attachments: [{ name: 'notes.docx', bytes: 10 }, { name: 'huge.png', bytes: 11 * 1024 * 1024 }] });
  eq(p.length, 2);
});

test('create: adds who, when, page, browser, screen and recent errors; urgency defaults to "soon"', function () {
  var w = R.where('#/job/FM-2609-314/invoices', { job: PENROSE });
  var r = R.create({ kind: 'numbers', area: 'job:invoices', text: 'Invoice 3 shows unpaid but check 2980 cleared.' },
    { seq: 7, by: KRISTY, at: '2026-11-12T16:05:00Z', hash: '#/job/FM-2609-314/invoices', where: w, userAgent: UA, screen: '1440×900', version: '2.12.0', errors: ['TypeError: x is undefined'] });
  eq(r.ok, true, r.problems.join(' '));
  var q = r.request;
  eq([q.id, q.status, q.urgency, q.jobCode, q.by, q.context.browser, q.context.errors.length], ['REQ-0007', 'new', 'soon', 'FM-2609-314', 'Kristy Slaughenhaupt', 'Chrome on Mac', 1]);
  eq(q.where, 'Braddy Builders · Penrose (FM-2609-314) › Invoices');
});

test('picking a different place keeps where they were, so Lindsay sees both', function () {
  var w = R.where('#/books/dashboard');
  var q = R.create({ kind: 'broken', area: 'printed', text: 'The invoice PDF cuts off the last line.' }, { seq: 1, by: KRISTY, where: w }).request;
  eq([q.area, q.where], ['printed', 'A printed document (contract packet, invoice, change order) (they were on Company books › Dashboard)']);
});

test('the email goes to lwyss@unbridled.com with the kind, place, words and details; "stopping work" is flagged in the subject', function () {
  var q = R.create({ kind: 'broken', area: 'job:contract', text: 'Send for signature does nothing.', urgency: 'blocking' },
    { seq: 12, by: KRISTY, at: '2026-11-12T16:05:00Z', where: R.where('#/job/FM-2610-101/contract', { job: { jobCode: 'FM-2610-101', customer: 'Ortiz' } }), userAgent: UA }).request;
  var m = R.email(q);
  eq(m.to, 'lwyss@unbridled.com');
  eq(m.subject, '[Stopping work] Project Builder REQ-0012: Something isn\'t working · Ortiz (FM-2610-101) › Contract');
  ok(m.body.indexOf('Send for signature does nothing.') > 0 && /How urgent: It's stopping my work/.test(m.body) && /No errors showed/.test(m.body), m.body);
  ok(/^mailto:lwyss%40unbridled\.com\?subject=/.test(m.mailto));
});

test('status: Full access only; "Not doing" and "Question" need a note; the requester can answer', function () {
  var q = R.create({ kind: 'idea', area: 'books', text: 'Show deposits due on the dashboard.' }, { seq: 3, by: KRISTY, where: R.where('#/books') }).request;
  eq(R.setStatus(q, 'fixed', { name: 'Tim', access: 'view' }).ok, false);
  eq(R.setStatus(q, 'notdoing', KRISTY, '').ok, false);
  var asked = R.setStatus(q, 'question', KRISTY, 'Which deposits: overdue only?', '2026-11-12').request;
  eq(asked.status, 'question');
  var answered = R.addNote(asked, { name: 'Tim' }, 'Overdue and due this week.', '2026-11-13').request;
  eq([answered.status, answered.history.length], ['new', 3]);
  eq(R.setStatus(answered, 'fixed', KRISTY, '', '2026-11-14').request.status, 'fixed');
  eq(R.counts([answered, asked]).open, 2);
});

test('the store keeps requests in their own list, numbered, never inside a job', function () {
  var st = ST.create({ seed: { jobs: [], log: [], seq: 0 } });
  eq(st.nextRequestNumber(), 1);
  var q = R.create({ kind: 'stuck', area: 'new', text: 'Where do I add a second house?' }, { seq: st.nextRequestNumber(), by: KRISTY, where: R.where('#/new') }).request;
  eq(st.addRequest(q, 'Kristy').ok, true);
  eq(st.addRequest(q, 'Kristy').ok, false);
  eq([st.requests().length, st.nextRequestNumber(), st.log('REQUESTS').length], [1, 2, 1]);
});

console.log('requests.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
