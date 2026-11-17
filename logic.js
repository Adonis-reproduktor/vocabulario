/* Pure logic (no DOM) – testable in node. */
(function (root) {
  const L = {};

  L.dayNumber = function (now) {
    now = now || new Date();
    return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  };

  L.shuffle = function (a, rnd) {
    rnd = rnd || Math.random;
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  L.stripAccents = function (s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  };

  L.norm = function (s) {
    return (s || '').toLowerCase().normalize('NFC').trim().replace(/\s+/g, ' ').replace(/[.!?,;]+$/, '');
  };

  L.posGroup = function (pos) {
    if (pos === 'm' || pos === 'f' || pos === 'mf') return 'n';
    return pos;
  };

  L.article = function (e) {
    if (e.pos === 'm') return 'o ';
    if (e.pos === 'f') return 'a ';
    return '';
  };

  L.display = function (e) {
    return L.article(e) + e.pt;
  };

  // returns 'ok' | 'accent' | 'wrong'
  L.check = function (e, typed) {
    let t = L.norm(typed);
    const ans = L.norm(e.pt);
    if (!t) return 'wrong';
    if (L.article(e)) {
      t = t.replace(/^(o|a|os|as)\s+/, '');
    }
    if (t === ans) return 'ok';
    if (L.stripAccents(t) === L.stripAccents(ans)) return 'accent';
    // hyphen / space tolerance
    if (t.replace(/[-\s]/g, '') === ans.replace(/[-\s]/g, '')) return 'ok';
    return 'wrong';
  };

  L.makeCloze = function (e) {
    if (!e.ex || !e.exf) return null;
    const esc = e.exf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let re;
    try { re = new RegExp('(^|[^\\p{L}])(' + esc + ')(?![\\p{L}])', 'iu'); } catch (x) { return null; }
    const m = re.exec(e.ex);
    if (!m) return null;
    const start = m.index + m[1].length;
    const before = e.ex.slice(0, start);
    const word = m[2];
    const after = e.ex.slice(start + word.length);
    return { before, word, after };
  };

  L.distractors = function (vocab, e, n, pick) {
    const g = L.posGroup(e.pos);
    const pool = vocab.filter(v => v.pt !== e.pt && (!e.en || v.en !== e.en) && L.posGroup(v.pos) === g && (!pick || pick(v)));
    return L.shuffle(pool).slice(0, n);
  };

  // ---- spaced repetition (SM-2 style, per word) ----
  // rec: { ef, reps, interval, due, lapses, ok, bad, learned, last }
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  L.learn = function (rec, day, mistakes, self) {
    rec = rec || {};
    let ef = 2.5;
    if (self >= 5) ef += 0.1; else if (self != null && self <= 1) ef -= 0.2;
    ef -= 0.1 * (mistakes || 0);
    rec.ef = clamp(ef, 1.3, 2.8);
    rec.reps = 0;
    rec.interval = 1;
    rec.due = day + 1;
    rec.learned = day;
    rec.ok = rec.ok || 0;
    rec.bad = (rec.bad || 0) + (mistakes ? 1 : 0);
    rec.lapses = rec.lapses || 0;
    return rec;
  };

  // q: 1 = wrong, 3 = hard / only accents wrong, 4 = good, 5 = easy
  L.review = function (rec, day, q) {
    rec = rec || { ef: 2.5, reps: 0, interval: 1, ok: 0, bad: 0, lapses: 0 };
    if (rec.ef == null) rec.ef = 2.5;
    if (q === true) q = 4;
    if (q === false) q = 1;
    if (q < 3) {
      rec.reps = 0;
      rec.interval = 1;
      rec.lapses = (rec.lapses || 0) + 1;
      rec.bad = (rec.bad || 0) + 1;
    } else {
      rec.reps = (rec.reps || 0) + 1;
      if (rec.reps === 1) rec.interval = 1;
      else if (rec.reps === 2) rec.interval = 3;
      else rec.interval = Math.max(rec.interval + 1, Math.round((rec.interval || 1) * rec.ef * (q === 3 ? 0.85 : q === 5 ? 1.2 : 1)));
      rec.ok = (rec.ok || 0) + 1;
    }
    rec.ef = clamp(rec.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), 1.3, 2.8);
    rec.due = day + rec.interval;
    rec.last = day;
    return rec;
  };

  L.mastered = rec => !!rec && rec.learned != null && (rec.interval || 0) >= 21;

  L.errorRate = function (log) {
    if (!log || log.length < 10) return 0;
    const recent = log.slice(-100);
    return recent.filter(x => !x).length / recent.length;
  };

  // target number of words in the daily review: 30..60, more when I make more mistakes
  L.dailyTarget = function (log, learnedCount) {
    const err = L.errorRate(log);
    const n = Math.round(30 + 30 * Math.min(1, err / 0.4));
    return Math.max(0, Math.min(n, learnedCount));
  };

  L.buildReview = function (vocab, words, log, day, rnd) {
    const learned = vocab.filter(v => words[v.pt] && words[v.pt].learned != null);
    const target = L.dailyTarget(log, learned.length);
    const due = learned.filter(v => words[v.pt].due <= day)
      .sort((a, b) => (words[a.pt].due - words[b.pt].due) || ((words[a.pt].ef || 2.5) - (words[b.pt].ef || 2.5)));
    let chosen = due.slice(0, target);
    if (chosen.length < target) {
      const rest = L.shuffle(learned.filter(v => words[v.pt].due > day), rnd).slice(0, target - chosen.length);
      chosen = chosen.concat(rest);
    }
    return { items: L.shuffle(chosen, rnd), target, dueCount: due.length };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  else root.L = L;
})(typeof window !== 'undefined' ? window : globalThis);
