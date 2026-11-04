/* FlowShift dashboard: rendering and interactions. Algorithm lives in engine.js. */
(function () {
  'use strict';
  const Engine = window.FlowShiftEngine;
  const STORAGE_KEY = 'flowshift-demo-v1';
  const MAX_TEAMS = 6;
  const $ = id => document.getElementById(id);
  const formatInt = number => String(number).padStart(2, '0');
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function initialState() {
    const now = Date.now();
    return {
      tickets: Engine.createDemoTickets(now), capacity: 2, offsetMs: 0,
      nextId: 8, selectedId: null, filter: 'open',
      history: [{ at: now, message: 'Demo loaded: 7 incidents ranked against 2 available teams.' }],
      banner: 'Ready — try injecting an emergency to see priorities shift.'
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState();
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved.tickets) || !Array.isArray(saved.history)) return initialState();
      if (!saved.tickets.every(t => t && typeof t.id === 'string' &&
          typeof t.title === 'string' && Number.isFinite(t.createdAt) &&
          Number.isInteger(t.urgency) && Number.isInteger(t.impact) &&
          Number.isInteger(t.slaMinutes) && (t.resolvedAt === null || Number.isFinite(t.resolvedAt)))) {
        return initialState();
      }
      return {
        ...saved, capacity: Engine.clampInteger(saved.capacity, 0, MAX_TEAMS),
        offsetMs: Number.isFinite(saved.offsetMs) && saved.offsetMs >= 0 ? saved.offsetMs : 0,
        nextId: Engine.clampInteger(saved.nextId, 8, 9999999),
        selectedId: typeof saved.selectedId === 'string' ? saved.selectedId : null,
        filter: ['open', 'resolved', 'all'].includes(saved.filter) ? saved.filter : 'open',
        history: saved.history.slice(0, 30),
        banner: typeof saved.banner === 'string' ? saved.banner : 'Demonstration restored.'
      };
    } catch (_) { return initialState(); }
  }

  let state = loadState();
  const simNow = () => Date.now() + state.offsetMs;
  const getPlan = () => Engine.buildPlan(state.tickets, state.capacity, simNow());
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* Private mode works without persistence. */ } }

  function fmtTime(value) {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function shortWait(minutes) { return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`; }
  function dueLabel(remaining) { return remaining <= 0 ? `${Math.abs(remaining)}m overdue` : `${remaining}m left`; }

  function addHistory(message) {
    state.history.unshift({ at: simNow(), message });
    state.history = state.history.slice(0, 30);
    state.banner = message;
  }
  function commit(message) {
    if (message) addHistory(message);
    saveState();
    render();
  }
  function nextId() { return `FS-${String(state.nextId++).padStart(3, '0')}`; }

  function renderStats(plan) {
    $('statOpen').textContent = formatInt(plan.stats.active);
    $('statAssigned').textContent = formatInt(plan.stats.assigned);
    $('statWaiting').textContent = formatInt(plan.stats.waiting);
    $('statOverdue').textContent = formatInt(plan.stats.overdue);
    $('queueCount').textContent = `${plan.stats.active} open`;
    $('resolvedCount').textContent = `${plan.stats.resolved} resolved`;
    $('capacityValue').textContent = `${state.capacity} / ${MAX_TEAMS}`;
    $('capacityBar').style.width = `${state.capacity / MAX_TEAMS * 100}%`;
    $('minusCapacity').disabled = state.capacity <= 0;
    $('plusCapacity').disabled = state.capacity >= MAX_TEAMS;
    $('simClock').textContent = `SIM TIME · ${new Date(simNow()).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}`;
    $('announcement').textContent = state.banner;
    document.querySelectorAll('.filter').forEach(button => {
      const selected = button.dataset.filter === state.filter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderQueue(plan) {
    const search = $('searchInput').value.trim().toLowerCase();
    let tickets = state.filter === 'resolved' ? plan.resolved :
      state.filter === 'all' ? [...plan.active, ...plan.resolved] : plan.active;
    tickets = tickets.filter(ticket =>
      `${ticket.title} ${ticket.id} ${ticket.category}`.toLowerCase().includes(search)
    );
    $('emptyState').hidden = tickets.length !== 0;
    $('queueList').innerHTML = tickets.map(t => {
      const done = t.status === 'resolved';
      const deadline = done ? 'Completed' : dueLabel(t.score.remainingMinutes);
      const deadlineClass = done ? 'resolved' : t.score.deadlineState === 'overdue' ? 'overdue' :
        t.score.deadlineState === 'critical' ? 'critical' : '';
      const timeDescription = done ? `Resolved at ${fmtTime(t.resolvedAt)}` :
        `Waiting ${shortWait(t.score.waitedMinutes)} · ${deadline}`;
      return `<article class="ticket ${state.selectedId === t.id ? 'selected' : ''}">
        <span class="ticket-rank">${done ? '✓' : t.rank}</span>
        <div class="ticket-body"><div class="ticket-heading"><span class="ticket-title">${escapeHtml(t.title)}</span></div>
        <div class="ticket-meta">${escapeHtml(t.id)} <b>•</b> ${escapeHtml(t.category)} <b>•</b> ${escapeHtml(timeDescription)}</div>
        <div class="ticket-tags"><span class="tag ${done ? 'resolved' : t.status}">${done ? '✓ Resolved' : t.status === 'assigned' ? '● Team assigned' : '◷ In queue'}</span>
        ${!done ? `<span class="tag ${deadlineClass}">${escapeHtml(deadline)}</span>` : ''}</div></div>
        <div class="ticket-right"><div class="score-number">${done ? '—' : t.score.total}</div><div class="score-caption">${done ? 'done' : 'points'}</div>
        <div class="ticket-buttons"><button type="button" class="small-btn" data-action="explain" data-id="${escapeHtml(t.id)}">Why?</button>
        <button type="button" class="small-btn ${done ? '' : 'finish'}" data-action="${done ? 'reopen' : 'resolve'}" data-id="${escapeHtml(t.id)}">${done ? 'Reopen' : 'Resolve'}</button></div></div></article>`;
    }).join('');
  }

  function renderDecision(plan) {
    const ticket = [...plan.active, ...plan.resolved].find(t => t.id === state.selectedId) || plan.active[0] || plan.resolved[0];
    if (!ticket) {
      $('selectedTitle').textContent = 'No incidents yet. Create one to see its score.';
      $('scoreBreakdown').innerHTML = '';
      $('decisionNote').textContent = 'Scoring updates when incoming incidents, staffing or deadlines change.';
      return;
    }
    state.selectedId = ticket.id;
    $('selectedTitle').textContent = `${ticket.id} · ${ticket.title}`;
    if (ticket.status === 'resolved') {
      $('scoreBreakdown').innerHTML = '<div class="score-total"><span>Completed incident</span><strong>✓</strong></div>';
      $('decisionNote').textContent = 'Resolved incidents leave the active queue. The next highest-ranked waiting incident automatically gets the newly available team.';
      return;
    }
    const { score } = ticket;
    const rows = [
      ['Urgency', `${ticket.urgency} × 15`, score.severityPoints],
      ['People affected', `${ticket.impact} × 10`, score.impactPoints],
      ['Waiting-time bonus', `${shortWait(score.waitedMinutes)} elapsed`, score.agingPoints],
      ['Deadline escalation', dueLabel(score.remainingMinutes), score.deadlinePoints]
    ];
    $('scoreBreakdown').innerHTML = rows.map(([name, detail, value]) =>
      `<div class="score-line"><span>${escapeHtml(name)} <small>(${escapeHtml(detail)})</small></span><b>+${value}</b></div>`
    ).join('') + `<div class="score-total"><span>TOTAL PRIORITY SCORE</span><strong>${score.total}</strong></div>`;
    $('decisionNote').textContent = `Rank #${ticket.rank} of ${plan.active.length}. ${ticket.status === 'assigned' ?
      'A response team is assigned because this incident is inside the available capacity.' :
      'No team is available yet. This ticket will be reassessed automatically after every change.'} ` +
      (score.remainingMinutes <= 0 ? 'Its response target has been missed.' : `Target: ${dueLabel(score.remainingMinutes)}.`);
  }

  function renderLog() {
    $('eventLog').innerHTML = state.history.slice(0, 8).map(entry =>
      `<li>${escapeHtml(entry.message)}<time datetime="${new Date(entry.at).toISOString()}">${escapeHtml(fmtTime(entry.at))} · simulated time</time></li>`
    ).join('');
  }

  function render() {
    const plan = getPlan();
    renderStats(plan);
    renderQueue(plan);
    renderDecision(plan);
    renderLog();
  }

  $('incidentForm').addEventListener('submit', event => {
    event.preventDefault();
    $('formError').hidden = true;
    const fields = {
      title: $('titleInput').value, category: $('categoryInput').value,
      urgency: Number($('urgencyInput').value), impact: Number($('impactInput').value),
      slaMinutes: Number($('slaInput').value)
    };
    try {
      const ticket = Engine.makeTicket(fields, simNow(), nextId());
      state.tickets.push(ticket);
      state.selectedId = ticket.id;
      state.filter = 'open';
      $('searchInput').value = '';
      $('incidentForm').reset();
      commit(`${ticket.id} added — ${ticket.title}. Queue and team assignments recalculated.`);
    } catch (error) {
      $('formError').textContent = error.message;
      $('formError').hidden = false;
    }
  });

  $('emergencyBtn').addEventListener('click', () => {
    const ticket = Engine.makeTicket({
      title: 'Emergency: oxygen supply needed at clinic', category: 'Medical',
      urgency: 5, impact: 5, slaMinutes: 15
    }, simNow(), nextId());
    state.tickets.push(ticket);
    state.selectedId = ticket.id;
    state.filter = 'open';
    $('searchInput').value = '';
    const position = getPlan().active.find(t => t.id === ticket.id);
    commit(`Emergency ${ticket.id} injected — ranked #${position.rank}; ${position.status === 'assigned' ? 'team dispatched' : 'waiting for a team'}.`);
  });

  $('advanceBtn').addEventListener('click', () => {
    state.offsetMs += 15 * Engine.MINUTE;
    commit('Clock advanced 15 minutes — waiting bonuses and response-deadline penalties recalculated.');
  });

  $('spikeBtn').addEventListener('click', () => {
    const cases = [
      ['Sudden water supply interruption', 'Utilities', 4, 4, 45],
      ['Fallen tree blocking access road', 'Transport', 4, 3, 60],
      ['School internet outage', 'Technology', 2, 4, 120],
      ['Park fence safety concern', 'Infrastructure', 2, 2, 180]
    ];
    for (const [title, category, urgency, impact, slaMinutes] of cases) {
      state.tickets.push(Engine.makeTicket({ title, category, urgency, impact, slaMinutes }, simNow(), nextId()));
    }
    state.filter = 'open';
    $('searchInput').value = '';
    commit('Demand surge: 4 new incidents reported. All priorities and assignments recalculated.');
  });

  $('minusCapacity').addEventListener('click', () => {
    if (state.capacity > 0) { state.capacity--; commit(`Response team capacity reduced to ${state.capacity}. Dispatch plan recalculated.`); }
  });
  $('plusCapacity').addEventListener('click', () => {
    if (state.capacity < MAX_TEAMS) { state.capacity++; commit(`Response team capacity increased to ${state.capacity}. Next eligible incident auto-assigned.`); }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Reset the demo? This clears your current incidents and local event history.')) return;
    state = initialState();
    $('incidentForm').reset();
    $('searchInput').value = '';
    commit('Demo reset to the original 7-incident scenario.');
  });

  $('queueList').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const ticket = state.tickets.find(t => t.id === button.dataset.id);
    if (!ticket) return;
    state.selectedId = ticket.id;
    if (button.dataset.action === 'resolve' && ticket.resolvedAt === null) {
      ticket.resolvedAt = simNow();
      commit(`${ticket.id} resolved — any freed response team automatically reassigned.`);
    } else if (button.dataset.action === 'reopen' && ticket.resolvedAt !== null) {
      ticket.resolvedAt = null;
      state.filter = 'open';
      commit(`${ticket.id} reopened — entered live priority queue again.`);
    } else {
      saveState(); render();
    }
  });

  $('searchInput').addEventListener('input', () => renderQueue(getPlan()));
  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    saveState(); render();
  }));
  document.querySelectorAll('.nav-item').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === link));
  }));

  render();
  // Real elapsed time also changes scores; periodic refresh keeps the display current.
  window.setInterval(render, 30 * 1000);
})();
