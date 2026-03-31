import { describe, it, expect } from 'vitest';
import {
  computeAvailableSlots,
  validateNewBookingTimes,
  intervalsOverlap,
  type Schedule,
  type StaffException,
  type BookingOnDay,
} from './slotEngine';

/** Misma franja todos los días para que cualquier fecha de prueba sirva */
function fullWeekNineToSix(): Schedule {
  const b = [{ start: '09:00', end: '18:00', breaks: [] as { start: string; end: string }[] }];
  return {
    sun: b,
    mon: b,
    tue: b,
    wed: b,
    thu: b,
    fri: b,
    sat: b,
  };
}

describe('intervalsOverlap', () => {
  it('no solapa si un tramo termina cuando el otro empieza (contiguos)', () => {
    expect(intervalsOverlap(600, 720, 720, 780)).toBe(false);
  });
  it('solapa con intersección estricta', () => {
    expect(intervalsOverlap(600, 730, 720, 780)).toBe(true);
  });
});

describe('computeAvailableSlots — última hora de inicio, no de fin', () => {
  const schedule = fullWeekNineToSix();
  const date = '2026-06-15';
  const exceptions: StaffException[] = [];
  const step = 30;

  it('Caso 1: 4h sin conflictos — 17:00, 17:30, 18:00 válidos; 18:15 no aparece', () => {
    const bookings: BookingOnDay[] = [];
    const slots = computeAvailableSlots(schedule, exceptions, bookings, date, 240, step, null);
    const starts = slots.map((s) => s.start);
    expect(starts).toContain('17:00');
    expect(starts).toContain('17:30');
    expect(starts).toContain('18:00');
    expect(starts).not.toContain('18:15');
  });

  it('Caso 2: turno a las 20:00 bloquea 17:00–21:00; 16:00–20:00 permitido', () => {
    const bookings: BookingOnDay[] = [{ startTime: '20:00', endTime: '21:00', status: 'confirmed' }];
    const slots = computeAvailableSlots(schedule, exceptions, bookings, date, 240, step, null);
    const starts = slots.map((s) => s.start);
    expect(starts).not.toContain('17:00');
    expect(starts).toContain('16:00');
  });

  it('Caso 3: excepción 19:00–20:00 bloquea extensión de 17:00+4h', () => {
    const ex: StaffException[] = [{ date, type: 'range', start: '19:00', end: '20:00' }];
    const slots = computeAvailableSlots(schedule, ex, [], date, 240, step, null);
    expect(slots.map((s) => s.start)).not.toContain('17:00');
  });

  it('Caso 4: 30 min — 18:00 sí; 18:15 no', () => {
    const slots = computeAvailableSlots(schedule, exceptions, [], date, 30, step, null);
    const starts = slots.map((s) => s.start);
    expect(starts).toContain('18:00');
    expect(starts).not.toContain('18:15');
  });
});

describe('validateNewBookingTimes', () => {
  const schedule = fullWeekNineToSix();
  const date = '2026-06-15';

  it('acepta inicio 18:00 con fin después del cierre si no hay bloqueos', () => {
    const r = validateNewBookingTimes({
      schedule,
      date,
      startTime: '18:00',
      endTime: '22:00',
      totalDurationMinutes: 240,
      exceptions: [],
      existingBookings: [],
    });
    expect(r).toEqual({ ok: true });
  });

  it('rechaza inicio fuera del bloque', () => {
    const r = validateNewBookingTimes({
      schedule,
      date,
      startTime: '18:15',
      endTime: '19:15',
      totalDurationMinutes: 60,
      exceptions: [],
      existingBookings: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('OUTSIDE_AVAILABILITY');
  });

  it('rechaza duración inconsistente', () => {
    const r = validateNewBookingTimes({
      schedule,
      date,
      startTime: '10:00',
      endTime: '11:00',
      totalDurationMinutes: 90,
      exceptions: [],
      existingBookings: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('INVALID_DURATION');
  });
});
