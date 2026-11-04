/*
 * FlowShift priority engine
 * Pure functions with no browser dependencies. The same file runs in Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FlowShiftEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MINUTE = 60 * 1000;

  function clampInteger(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }

  function makeTicket(fields, nowMs, id) {
    const title = String(fields.title || '').trim();
    if (!title || title.length > 80) throw new Error('Title must be 1–80 characters.');
    const urgency = Number(fields.urgency);
    const impact = Number(fields.impact);
    const slaMinutes = Number(fields.slaMinutes);
    if (![urgency, impact].every(v => Number.isInteger(v) && v >= 1 && v <= 5)) {
      throw new Error('Urgency and impact must be whole numbers between 1 and 5.');
    }
    if (!Number.isInteger(slaMinutes) || slaMinutes < 15 || slaMinutes > 240) {
      throw new Error('Response target must be 15–240 minutes.');
    }
    if (!Number.isFinite(nowMs)) throw new Error('Invalid creation time.');
    return {
      id: String(id), title, category: String(fields.category || 'Other'),
      urgency, impact, slaMinutes, createdAt: nowMs, resolvedAt: null
    };
  }

  function calculateScore(ticket, nowMs) {
    const waitedMinutes = Math.max(0, Math.floor((nowMs - ticket.createdAt) / MINUTE));
    const deadlineAt = ticket.createdAt + ticket.slaMinutes * MINUTE;
    const remainingMinutes = Math.ceil((deadlineAt - nowMs) / MINUTE);
    const severityPoints = ticket.urgency * 15;
    const impactPoints = ticket.impact * 10;
    // Aging keeps older tickets from being indefinitely ignored.
    const agingPoints = Math.min(36, Math.floor(waitedMinutes / 10) * 3);
    // Immediate response targets, especially missed ones, are escalated.
    const deadlinePoints = remainingMinutes <= 0 ? 40 : remainingMinutes <= 15 ? 22 : remainingMinutes <= 45 ? 10 : 0;
    return {
      total: severityPoints + impactPoints + agingPoints + deadlinePoints,
      severityPoints, impactPoints, agingPoints, deadlinePoints,
      waitedMinutes, remainingMinutes, deadlineAt,
      deadlineState: remainingMinutes <= 0 ? 'overdue' : remainingMinutes <= 15 ? 'critical' : remainingMinutes <= 45 ? 'soon' : 'on-track'
    };
  }

  function buildPlan(tickets, capacity, nowMs) {
    const available = clampInteger(capacity, 0, 20);
    const active = tickets.filter(t => t.resolvedAt === null).map(t => ({ ...t, score: calculateScore(t, nowMs) }));
    const resolved = tickets.filter(t => t.resolvedAt !== null).map(t => ({ ...t, score: null, status: 'resolved', rank: null }));
    active.sort((a, b) =>
      b.score.total - a.score.total ||
      a.score.deadlineAt - b.score.deadlineAt ||
      a.createdAt - b.createdAt ||
      String(a.id).localeCompare(String(b.id))
    );
    const prioritized = active.map((ticket, index) => ({
      ...ticket, rank: index + 1,
      status: index < available ? 'assigned' : 'waiting'
    }));
    return {
      active: prioritized,
      resolved: resolved.sort((a, b) => b.resolvedAt - a.resolvedAt),
      stats: {
        active: prioritized.length,
        assigned: prioritized.filter(t => t.status === 'assigned').length,
        waiting: prioritized.filter(t => t.status === 'waiting').length,
        overdue: prioritized.filter(t => t.score.deadlineState === 'overdue').length,
        resolved: resolved.length,
        capacity: available
      }
    };
  }

  function createDemoTickets(nowMs) {
    const demo = [
      { title: 'Hospital cooling system failure', category: 'Medical', urgency: 5, impact: 5, slaMinutes: 30, age: 8 },
      { title: 'Neighborhood power outage', category: 'Utilities', urgency: 3, impact: 5, slaMinutes: 90, age: 28 },
      { title: 'Water leak in public library', category: 'Infrastructure', urgency: 3, impact: 3, slaMinutes: 90, age: 50 },
      { title: 'Traffic signal not responding', category: 'Transport', urgency: 4, impact: 4, slaMinutes: 60, age: 12 },
      { title: 'Streetlight maintenance request', category: 'Utilities', urgency: 1, impact: 2, slaMinutes: 180, age: 95 },
      { title: 'Wi-Fi failure in community center', category: 'Technology', urgency: 2, impact: 2, slaMinutes: 120, age: 62 },
      { title: 'Blocked wheelchair-access ramp', category: 'Infrastructure', urgency: 4, impact: 3, slaMinutes: 60, age: 42 }
    ];
    return demo.map((item, index) => ({
      ...makeTicket(item, nowMs - item.age * MINUTE, `FS-${String(index + 1).padStart(3, '0')}`),
      age: undefined
    })).map(({ age, ...ticket }) => ticket);
  }

  return { MINUTE, clampInteger, makeTicket, calculateScore, buildPlan, createDemoTickets };
});
