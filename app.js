/* Vocabulário – PT (Portugal) vocabulary trainer. Plain JS, no dependencies. */
(function () {
  'use strict';
  const VOCAB = window.VOCAB || [];
  const LESSON_SIZE = 10;
  const KEY = 'vocabulario_v1';
  const root = document.getElementById('app');

  // ---------- helpers ----------
  function h(tag, props) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(kid => {
        if (kid == null || kid === false) return;
        e.append(kid.nodeType ? kid : document.createTextNode(kid));
      });
    }
    return e;
  }
  const POS = { m: 'rzecz. (o)', f: 'rzecz. (a)', mf: 'rzecz.', v: 'czasownik', adj: 'przymiotnik', adv: 'przysłówek', prep: 'przyimek', conj: 'spójnik', pron: 'zaimek', intj: 'wykrzyknik', num: 'liczebnik' };

  // ---------- state ----------
  let S = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.words) return s;
    } catch (e) {}
    return { words: {}, lessons: {}, log: [], streak: 0, lastDay: null, reviewDone: null };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  function touchStreak() {
    const d = L.dayNumber();
    if (S.lastDay === d) return;
    S.streak = S.lastDay === d - 1 ? (S.streak || 0) + 1 : 1;
    S.lastDay = d;
  }

  // ---------- speech ----------
  let ptVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    ptVoice = vs.find(v => /^pt[-_]PT/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-PT';
      if (ptVoice) u.voice = ptVoice;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  const speakBtn = text => h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Odtwórz', onclick: () => speak(text) }, '🔊');

  // ---------- navigation ----------
  let tab = 'lessons';
  function shell(content, opts) {
    opts = opts || {};
    root.replaceChildren(content);
    if (!opts.noNav) root.append(nav());
    window.scrollTo(0, 0);
  }
  function nav() {
    const item = (id, label, icon) => h('button', { class: 'nav-item' + (tab === id ? ' active' : ''), onclick: () => { tab = id; route(); } }, h('span', { class: 'nav-icon' }, icon), h('span', null, label));
    return h('nav', { class: 'nav' }, item('lessons', 'Lekcje', '📚'), item('review', 'Powtórka', '🔁'), item('stats', 'Postępy', '📈'));
  }
  function route() {
    if (tab === 'lessons') viewLessons();
    else if (tab === 'review') viewReview();
    else viewStats();
  }

  // ---------- views ----------
  function lessonWords(i) { return VOCAB.slice(i * LESSON_SIZE, i * LESSON_SIZE + LESSON_SIZE); }
  const lessonCount = () => Math.floor(VOCAB.length / LESSON_SIZE) + (VOCAB.length % LESSON_SIZE >= 5 ? 1 : 0);

  function viewLessons() {
    const n = lessonCount();
    let next = 0;
    while (next < n && S.lessons[next]) next++;
    const list = h('div', { class: 'list' });
    for (let i = 0; i < n; i++) {
      const ws = lessonWords(i);
      if (!ws.length) continue;
      const done = S.lessons[i];
      const card = h('button', { class: 'card lesson' + (done ? ' done' : '') + (i === next ? ' next' : ''), onclick: () => startLesson(i) },
        h('div', { class: 'lesson-head' },
          h('strong', null, 'Lekcja ' + (i + 1)),
          h('span', { class: 'badge' }, done ? '✓ ' + done.score + '%' : (i === next ? 'następna' : ''))),
        h('div', { class: 'muted small' }, ws.slice(0, 5).map(w => w.pt).join(' · ') + ' …'));
      list.append(card);
    }
    shell(h('div', { class: 'page' },
      h('h1', null, 'Lekcje'),
      h('p', { class: 'muted' }, VOCAB.length + ' słów · po ' + LESSON_SIZE + ' w lekcji · wg częstości'),
      list));
    const el = document.querySelector('.lesson.next');
    if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 0);
  }

  function viewReview() {
    const day = L.dayNumber();
    const r = L.buildReview(VOCAB, S.words, S.log, day);
    const learned = Object.values(S.words).filter(w => w.learned != null).length;
    const doneToday = S.reviewDone === day;
    shell(h('div', { class: 'page' },
      h('h1', null, 'Codzienna powtórka'),
      learned === 0
        ? h('div', { class: 'card' }, 'Najpierw zrób choć jedną lekcję. Potem tutaj pojawią się słówka do powtórki.')
        : h('div', { class: 'card center' },
            h('div', { class: 'big' }, r.items.length),
            h('div', { class: 'muted' }, 'słówek na dziś' + (r.dueCount ? ' (' + r.dueCount + ' do powtórki wg harmonogramu)' : '')),
            h('p', { class: 'muted small' }, 'Widzisz angielskie słowo – wpisujesz portugalskie. Im więcej błędów, tym więcej słówek (30–60).'),
            doneToday ? h('p', { class: 'ok-text' }, '✓ Dzisiejsza powtórka zrobiona') : null,
            h('button', { class: 'btn primary', onclick: () => startReview(r.items) }, doneToday ? 'Powtórz jeszcze raz' : 'Zacznij powtórkę')),
      learned >= 4 ? h('div', null,
        h('h2', null, 'Gry i dodatkowe ćwiczenia'),
        h('p', { class: 'muted small' }, 'Losowe 10 poznanych słówek. Nie zmieniają harmonogramu powtórek.'),
        h('div', { class: 'grid' },
          gameBtn('🧩 Pary', 'match'), gameBtn('🔤 Układanka z liter', 'letters'),
          gameBtn('🎧 Słuchaj i wpisz', 'listenType'), gameBtn('👂 Słuchaj i wybierz', 'listen'))) : null));
  }

  const gameBtn = (label, kind) => h('button', { class: 'btn', onclick: () => startGame(kind) }, label);
  function startGame(kind) {
    const pool = VOCAB.filter(v => S.words[v.pt] && S.words[v.pt].learned != null);
    const words = L.shuffle(pool).slice(0, 10);
    if (words.length < 3) return;
    const ex = EX[kind](words);
    ex.intro = false;
    runExercises([ex], () => {
      shell(h('div', { class: 'page center' },
        h('div', { class: 'big' }, '👏'), h('h1', null, 'Gotowe'),
        h('button', { class: 'btn primary', onclick: () => startGame(kind) }, 'Jeszcze raz'),
        h('button', { class: 'btn', onclick: () => { tab = 'review'; route(); } }, 'Wróć')), { noNav: true });
    }, 'Gra');
  }

  function viewStats() {
    const ws = Object.values(S.words).filter(w => w.learned != null);
    const total = VOCAB.length;
    const mastered = ws.filter(L.mastered).length;
    const rec = S.log.slice(-100);
    const acc = rec.length ? Math.round(100 * rec.filter(Boolean).length / rec.length) : null;
    const lessonsDone = Object.keys(S.lessons).length;
    const ta = h('textarea', { class: 'backup', rows: 4, placeholder: 'Wklej tu kopię zapasową…' });
    shell(h('div', { class: 'page' },
      h('h1', null, 'Postępy'),
      h('div', { class: 'grid' },
        stat(ws.length + ' / ' + total, 'poznane słowa'),
        stat(mastered, 'dobrze utrwalone (odstęp ≥ 3 tyg.)'),
        stat(lessonsDone, 'lekcje ukończone'),
        stat((S.streak || 0) + ' 🔥', 'dni z rzędu'),
        stat(acc == null ? '—' : acc + '%', 'skuteczność (ost. 100)')),
      h('h2', null, 'Kopia zapasowa'),
      h('p', { class: 'muted small' }, 'Postępy są zapisane tylko w tej przeglądarce. Skopiuj kopię i schowaj np. w Notatkach – przyda się przy zmianie telefonu.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { ta.value = JSON.stringify(S); ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) {} } }, 'Pokaż / kopiuj'),
        h('button', { class: 'btn', onclick: () => {
          try {
            const s = JSON.parse(ta.value);
            if (!s || !s.words) throw 0;
            S = s; save(); alert('Przywrócono.'); route();
          } catch (e) { alert('To nie wygląda na kopię zapasową.'); }
        } }, 'Przywróć')),
      ta,
      h('button', { class: 'btn danger', onclick: () => { if (confirm('Skasować cały postęp?')) { S = { words: {}, lessons: {}, log: [], streak: 0, lastDay: null, reviewDone: null }; save(); route(); } } }, 'Wyzeruj postępy')));
  }
  const stat = (v, l) => h('div', { class: 'card center' }, h('div', { class: 'big' }, v), h('div', { class: 'muted small' }, l));

  // ---------- exercise runner ----------
  // exercise = { title, items: [entries], make(entry) -> question | null }
  // question = { render(api) } ; api.answer(correct, info)
  function runExercises(exercises, onFinish, ctx) {
    let ei = 0;
    const mistakes = {}; // pt -> count
    function nextExercise() {
      if (ei >= exercises.length) return onFinish(mistakes);
      const ex = exercises[ei];
      const queue = ex.items.slice();
      const total = queue.length;
      let done = 0;
      const attempts = {};
      const firstSeen = {};
      function step() {
        if (!queue.length) { ei++; return nextExercise(); }
        const e = queue.shift();
        const q = ex.make(e);
        if (!q) { done++; return step(); }
        const wrap = h('div', { class: 'page ex' });
        const bar = h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: 'width:' + Math.round(100 * done / total) + '%' }));
        const top = h('div', { class: 'ex-top' },
          h('button', { class: 'close', onclick: () => { if (confirm('Przerwać? Postęp tej sesji nie zostanie zapisany.')) route(); } }, '✕'),
          bar,
          h('span', { class: 'muted small' }, (ctx ? ctx + ' · ' : '') + (ei + 1) + '/' + exercises.length));
        wrap.append(top, h('div', { class: 'ex-title muted' }, ex.title));
        const body = h('div', { class: 'ex-body' });
        wrap.append(body);
        const footer = h('div', { class: 'footer' });
        wrap.append(footer);
        let answered = false;
        const api = {
          body, footer,
          next() { done++; step(); },
          mistake(pt) { mistakes[pt] = (mistakes[pt] || 0) + 1; },
          answer(correct, feedback, opt) {
            if (answered) return;
            answered = true;
            opt = opt || {};
            const first = !attempts[e.pt] && !firstSeen[e.pt];
            firstSeen[e.pt] = true;
            if (correct) done++;
            else {
              mistakes[e.pt] = (mistakes[e.pt] || 0) + 1;
              attempts[e.pt] = (attempts[e.pt] || 0) + 1;
              if (attempts[e.pt] <= 2) queue.push(e); else done++;
            }
            if (ex.onResult) ex.onResult(e, correct, correct ? opt.q : 1, first);
            const fb = h('div', { class: 'feedback ' + (correct ? 'good' : 'bad') }, feedback || (correct ? 'Dobrze!' : 'Niestety nie'));
            if (correct && opt.rate && ex.onRate && first) {
              footer.replaceChildren(fb, h('div', { class: 'rate' },
                [['Trudne', 3], ['Dobrze', 4], ['Łatwe', 5]].map(([lab, q]) =>
                  h('button', { class: 'btn', onclick: () => { ex.onRate(e, q); step(); } }, lab))));
            } else {
              footer.replaceChildren(fb, h('button', { class: 'btn primary', id: 'next-btn', onclick: step }, 'Dalej'));
            }
          },
        };
        shell(wrap, { noNav: true });
        q.render(api, e);
      }
      // intro screen between exercises
      if (ex.intro !== false && ei > 0) {
        shell(h('div', { class: 'page center' },
          h('div', { class: 'big' }, (ei + 1) + ' / ' + exercises.length),
          h('h2', null, ex.title),
          h('p', { class: 'muted' }, ex.hint || ''),
          h('button', { class: 'btn primary', onclick: step }, 'Start')), { noNav: true });
      } else step();
    }
    nextExercise();
  }

  // ---------- question builders ----------
  function qChoice(e, prompt, options, correctKey, opts) {
    opts = opts || {};
    return {
      render(api) {
        api.body.append(prompt);
        const list = h('div', { class: 'options' });
        options.forEach(o => {
          const b = h('button', { class: 'opt', type: 'button' }, o.label);
          b.addEventListener('click', () => {
            if (b.disabled) return;
            const ok = o.key === correctKey;
            list.querySelectorAll('button').forEach(x => x.disabled = true);
            b.classList.add(ok ? 'right' : 'wrong');
            if (!ok) {
              [...list.children].forEach((x, i) => { if (options[i].key === correctKey) x.classList.add('right'); });
            }
            if (opts.speakOnAnswer) speak(opts.speakOnAnswer);
            api.answer(ok, ok ? 'Dobrze!' : (opts.reveal || ''));
          });
          list.append(b);
        });
        api.body.append(list);
      }
    };
  }
  const promptBox = (...kids) => h('div', { class: 'prompt' }, kids);
  const posChip = e => h('span', { class: 'chip' }, POS[e.pos] || e.pos);

  function opts4(e, labelFn, keyFn) {
    const ds = L.distractors(VOCAB, e, 3);
    const all = L.shuffle([e].concat(ds));
    return all.map(v => ({ label: labelFn(v), key: keyFn(v) }));
  }

  const EX = {
    cards(words, onSelf) {
      const ex = {
        title: 'Poznaj słowa', intro: false, items: words, onSelf,
        make(e) {
          return {
            render(api) {
              api.body.append(h('div', { class: 'card flash' },
                posChip(e),
                h('div', { class: 'word' }, L.display(e), ' ', speakBtn(L.display(e))),
                h('div', { class: 'en' }, e.en),
                e.ex ? h('div', { class: 'sent' }, e.ex, ' ', speakBtn(e.ex)) : null));
              speak(L.display(e));
              api.footer.append(
                h('div', { class: 'muted small', style: 'width:100%' }, 'Jak dobrze znasz to słowo?'),
                ...[['Nie znam', 1], ['Prawie', 3], ['Znam', 5]].map(([lab, q]) =>
                  h('button', { class: 'btn' + (q === 5 ? ' primary' : ''), onclick: () => { if (ex.onSelf) ex.onSelf(e, q); api.next(); } }, lab)));
            }
          };
        }
      };
      return ex;
    },
    ptEn(words) {
      return {
        title: 'Co to znaczy?', hint: 'Wybierz angielskie znaczenie.', items: L.shuffle(words),
        make(e) {
          return qChoice(e, promptBox(posChip(e), h('div', { class: 'word' }, L.display(e), ' ', speakBtn(L.display(e)))),
            opts4(e, v => v.en, v => v.pt), e.pt, { reveal: e.en, speakOnAnswer: L.display(e) });
        }
      };
    },
    enPt(words) {
      return {
        title: 'Jak to będzie po portugalsku?', hint: 'Wybierz portugalskie słowo.', items: L.shuffle(words),
        make(e) {
          return qChoice(e, promptBox(posChip(e), h('div', { class: 'word' }, e.en)),
            opts4(e, v => L.display(v), v => v.pt), e.pt, { reveal: L.display(e), speakOnAnswer: L.display(e) });
        }
      };
    },
    listen(words) {
      return {
        title: 'Posłuchaj i wybierz', hint: 'Odsłuchaj słowo i wybierz to, które usłyszałeś. Jeśli nic nie słychać, sprawdź czy telefon nie jest wyciszony.', items: L.shuffle(words),
        make(e) {
          const q = qChoice(e, promptBox(h('button', { class: 'big-play', type: 'button', onclick: () => speak(e.pt) }, '🔊 Odtwórz')),
            opts4(e, v => L.display(v), v => v.pt), e.pt, { reveal: L.display(e) + ' – ' + e.en });
          const r = q.render;
          q.render = api => { r(api); setTimeout(() => speak(e.pt), 250); };
          return q;
        }
      };
    },
    cloze(words) {
      return {
        title: 'Uzupełnij zdanie', hint: 'Wybierz słowo pasujące do luki.', items: L.shuffle(words),
        make(e) {
          const c = L.makeCloze(e);
          if (!c) return null;
          const wl = c.word.toLowerCase();
          const ds = L.distractors(VOCAB, e, 3, v => v.exf && L.makeCloze(v)).map(v => v.exf.toLowerCase());
          const uniq = [...new Set([wl].concat(ds))];
          if (uniq.length < 2) return null;
          const options = L.shuffle(uniq).map(x => ({ label: x, key: x }));
          const sentence = h('div', { class: 'sent big-sent' }, c.before, h('span', { class: 'gap' }, '_____'), c.after);
          return qChoice(e, promptBox(sentence, h('div', { class: 'muted small' }, e.en)), options, wl,
            { reveal: c.before + c.word + c.after, speakOnAnswer: c.before + c.word + c.after });
        }
      };
    },
    listenType(words, onResult, onRate) {
      return { title: 'Posłuchaj i wpisz', hint: 'Odsłuchaj słowo i wpisz je tak, jak się pisze.', items: L.shuffle(words), onResult, onRate, make(e) { return qType(e, 'listen'); } };
    },
    match(words) {
      const sh = L.shuffle(words), groups = [];
      for (let i = 0; i < sh.length; i += 5) {
        const g = sh.slice(i, i + 5);
        if (g.length >= 3 || !groups.length) groups.push(g); else groups[groups.length - 1] = groups[groups.length - 1].concat(g);
      }
      return {
        title: 'Połącz pary', hint: 'Dotknij słowa po portugalsku, a potem jego znaczenia.',
        items: groups.map((g, i) => ({ pt: '__m' + i, words: g })),
        make(item) {
          return {
            render(api) {
              const left = L.shuffle(item.words), right = L.shuffle(item.words);
              let selL = null, selR = null, left_n = item.words.length;
              const colL = h('div', { class: 'col' }), colR = h('div', { class: 'col' });
              const bL = left.map(w => { const b = h('button', { class: 'opt small-opt', type: 'button' }, L.display(w)); b.addEventListener('click', () => pickL(w, b)); return b; });
              const bR = right.map(w => { const b = h('button', { class: 'opt small-opt', type: 'button' }, w.en); b.addEventListener('click', () => pickR(w, b)); return b; });
              colL.append(...bL); colR.append(...bR);
              api.body.append(h('div', { class: 'pairs' }, colL, colR));
              function clear(sel) { sel && sel.b.classList.remove('sel'); }
              function pickL(w, b) { if (b.disabled) return; clear(selL); selL = { w, b }; b.classList.add('sel'); speak(w.pt); try2(); }
              function pickR(w, b) { if (b.disabled) return; clear(selR); selR = { w, b }; b.classList.add('sel'); try2(); }
              function try2() {
                if (!selL || !selR) return;
                const ok = selL.w.pt === selR.w.pt;
                const a = selL.b, c = selR.b, wl = selL.w;
                selL = selR = null;
                a.classList.remove('sel'); c.classList.remove('sel');
                if (ok) {
                  a.classList.add('right'); c.classList.add('right'); a.disabled = c.disabled = true;
                  if (--left_n === 0) api.answer(true, 'Wszystkie pary połączone!');
                } else {
                  api.mistake(wl.pt);
                  a.classList.add('wrong'); c.classList.add('wrong');
                  setTimeout(() => { a.classList.remove('wrong'); c.classList.remove('wrong'); }, 500);
                }
              }
            }
          };
        }
      };
    },
    letters(words) {
      return {
        title: 'Ułóż słowo z liter', hint: 'Dotykaj liter we właściwej kolejności.', items: L.shuffle(words),
        make(e) {
          if (/[\s-]/.test(e.pt) || e.pt.length < 3 || e.pt.length > 14) return qType(e);
          return {
            render(api) {
              const chars = e.pt.split('');
              let tiles = L.shuffle(chars.map((c, i) => ({ c, i })));
              if (tiles.map(t => t.c).join('') === e.pt) tiles = tiles.reverse();
              const built = [];
              const row = h('div', { class: 'built' }), pool = h('div', { class: 'tiles' });
              api.body.append(promptBox(posChip(e), h('div', { class: 'word' }, e.en)), row, pool);
              const ck = h('button', { class: 'btn primary', onclick: finish }, 'Sprawdź');
              api.footer.append(h('button', { class: 'btn', onclick: () => { built.length = 0; draw(); } }, 'Wyczyść'), ck);
              let locked = false;
              function draw() {
                row.replaceChildren(...built.map(t => h('button', { class: 'tile built-t', type: 'button', onclick: () => { if (locked) return; built.splice(built.indexOf(t), 1); draw(); } }, t.c)));
                pool.replaceChildren(...tiles.map(t => h('button', { class: 'tile', type: 'button', disabled: built.includes(t), onclick: () => { if (locked) return; built.push(t); draw(); } }, t.c)));
              }
              function finish() {
                if (locked) return;
                locked = true;
                const word = built.map(t => t.c).join('');
                const ok = word === e.pt;
                row.classList.add(ok ? 'right' : 'wrong');
                speak(L.display(e));
                api.answer(ok, ok ? 'Dobrze! ' + L.display(e) : 'Poprawnie: ' + L.display(e));
              }
              draw();
            }
          };
        }
      };
    },
    type(words, onResult, onRate) {
      return {
        title: 'Wpisz po portugalsku', hint: 'Zobaczysz angielskie słowo. Wpisz portugalskie.', items: L.shuffle(words), onResult, onRate,
        make(e) { return qType(e); }
      };
    }
  };

  function qType(e, mode) {
    return {
      render(api) {
        const input = h('input', { class: 'type-input', type: 'text', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false', placeholder: 'po portugalsku…', enterkeyhint: 'done' });
        if (mode === 'listen') {
          api.body.append(promptBox(h('button', { class: 'big-play', type: 'button', onclick: () => speak(e.pt) }, '🔊 Odtwórz')), input);
          setTimeout(() => speak(e.pt), 250);
        } else {
          api.body.append(promptBox(posChip(e), h('div', { class: 'word' }, e.en),
            e.pos === 'm' || e.pos === 'f' ? h('div', { class: 'muted small' }, 'rzeczownik – możesz dopisać o / a') : null), input);
        }
        const accents = h('div', { class: 'accents' }, 'áàâãçéêíóôõú'.split('').map(ch => h('button', { type: 'button', class: 'acc', onmousedown: ev => ev.preventDefault(), onclick: () => { input.setRangeText(ch, input.selectionStart, input.selectionEnd, 'end'); input.focus(); } }, ch)));
        api.body.append(accents);
        const check = () => {
          if (input.disabled) return;
          let r = L.check(e, input.value), alt = null;
          if (r === 'wrong' && mode !== 'listen') {
            alt = VOCAB.find(v => v !== e && v.en === e.en && L.check(v, input.value) !== 'wrong');
            if (alt) r = L.check(alt, input.value);
          }
          input.disabled = true;
          input.classList.add(r === 'wrong' ? 'wrong' : 'right');
          const tail = mode === 'listen' ? ' – ' + e.en : '';
          if (alt && r === 'ok') api.answer(true, 'Dobrze! (też: ' + L.display(alt) + '; w słowniku: ' + L.display(e) + ')', { rate: true });
          else if (r === 'ok') api.answer(true, 'Dobrze! ' + L.display(e) + tail, { rate: true });
          else if (r === 'accent') api.answer(true, 'Prawie – uwaga na akcenty: ' + L.display(e) + tail, { q: 3 });
          else api.answer(false, 'Poprawnie: ' + L.display(e) + tail);
          speak(L.display(e));
        };
        input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); check(); } });
        api.footer.append(
          h('button', { class: 'btn', onclick: () => { input.value = ''; check(); } }, 'Nie wiem'),
          h('button', { class: 'btn primary', onclick: check }, 'Sprawdź'));
        setTimeout(() => input.focus(), 50);
      }
    };
  }

  // ---------- lesson ----------
  function startLesson(i) {
    const words = lessonWords(i);
    if (!words.length) return;
    const selfRate = {};
    const types = [EX.cards(words, (e, q) => { selfRate[e.pt] = q; }), EX.ptEn(words), EX.enPt(words), EX.match(words), EX.cloze(words), EX.listenType(words), EX.type(words)];
    runExercises(types, mistakes => {
      const day = L.dayNumber();
      const total = Object.values(mistakes).reduce((a, b) => a + b, 0);
      const score = Math.max(0, Math.round(100 - 100 * total / (words.length * 5)));
      words.forEach(w => { S.words[w.pt] = L.learn(S.words[w.pt], day, mistakes[w.pt] || 0, selfRate[w.pt]); });
      S.lessons[i] = { score, date: day };
      touchStreak(); save();
      shell(h('div', { class: 'page center' },
        h('div', { class: 'big' }, '🎉'),
        h('h1', null, 'Lekcja ' + (i + 1) + ' ukończona'),
        h('p', { class: 'muted' }, 'Wynik: ' + score + '% · błędy: ' + total),
        h('p', { class: 'muted small' }, 'Te słówka wrócą w powtórkach. Jutro pojawią się po raz pierwszy.'),
        h('button', { class: 'btn primary', onclick: () => { tab = 'lessons'; route(); } }, 'Do listy lekcji'),
        h('button', { class: 'btn', onclick: () => startLesson(i + 1) }, 'Następna lekcja')), { noNav: true });
    }, 'Lekcja ' + (i + 1));
  }

  // ---------- daily review ----------
  function startReview(items) {
    if (!items.length) return;
    const day = L.dayNumber();
    const firstTry = {};
    const apply = (e, q) => {
      S.words[e.pt] = L.review(S.words[e.pt], day, q);
      S.log.push(q >= 3 ? 1 : 0);
      if (S.log.length > 300) S.log = S.log.slice(-300);
      save();
    };
    const ex = EX.type(items, (e, correct, q, first) => {
      if (firstTry[e.pt] !== undefined) return;
      if (!correct) { firstTry[e.pt] = false; apply(e, 1); }
      else if (q === 3) { firstTry[e.pt] = true; apply(e, 3); }
    }, (e, q) => {
      if (firstTry[e.pt] !== undefined) return;
      firstTry[e.pt] = true; apply(e, q);
    });
    ex.intro = false;
    runExercises([ex], mistakes => {
      const wrong = Object.keys(firstTry).filter(k => !firstTry[k]).length;
      S.reviewDone = day;
      touchStreak(); save();
      shell(h('div', { class: 'page center' },
        h('div', { class: 'big' }, '✅'),
        h('h1', null, 'Powtórka gotowa'),
        h('p', { class: 'muted' }, (items.length - wrong) + ' / ' + items.length + ' bez błędu w pierwszej próbie'),
        h('button', { class: 'btn primary', onclick: () => { tab = 'review'; route(); } }, 'OK')), { noNav: true });
    }, 'Powtórka');
  }

  // ---------- boot ----------
  if (!VOCAB.length) {
    root.append(h('div', { class: 'page' }, h('h1', null, 'Brak danych'), h('p', null, 'Nie znaleziono pliku data.js.')));
  } else {
    route();
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
