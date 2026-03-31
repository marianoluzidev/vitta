"use strict";
/**
 * Copia alineada con src/services/slotEngine.ts — mantener ambas en sync al cambiar reglas de agenda.
 * @see src/services/slotEngine.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAY_KEYS = void 0;
exports.parseTime = parseTime;
exports.minutesToTime = minutesToTime;
exports.getWeekdayFromDate = getWeekdayFromDate;
exports.mergeIntervals = mergeIntervals;
exports.subtractIntervals = subtractIntervals;
exports.intervalsOverlap = intervalsOverlap;
exports.openIntervalsFromBlocks = openIntervalsFromBlocks;
exports.blockedFromBreaks = blockedFromBreaks;
exports.isStartWithinOpenIntervals = isStartWithinOpenIntervals;
exports.bookingIntersectsBlocked = bookingIntersectsBlocked;
exports.computeAvailableSlots = computeAvailableSlots;
exports.validateNewBookingTimes = validateNewBookingTimes;
exports.DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function parseTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return (h !== null && h !== void 0 ? h : 0) * 60 + (m !== null && m !== void 0 ? m : 0);
}
function minutesToTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function getWeekdayFromDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return exports.DAY_KEYS[d.getDay()];
}
function mergeIntervals(intervals) {
    if (intervals.length <= 1)
        return intervals;
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const out = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const last = out[out.length - 1];
        if (sorted[i].start <= last.end) {
            last.end = Math.max(last.end, sorted[i].end);
        }
        else {
            out.push({ ...sorted[i] });
        }
    }
    return out;
}
function subtractIntervals(open, busy) {
    let result = open.map((i) => ({ ...i }));
    for (const b of busy) {
        const next = [];
        for (const a of result) {
            if (b.end <= a.start || b.start >= a.end) {
                next.push(a);
            }
            else {
                if (a.start < b.start)
                    next.push({ start: a.start, end: b.start });
                if (b.end < a.end)
                    next.push({ start: b.end, end: a.end });
            }
        }
        result = next;
    }
    return mergeIntervals(result);
}
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}
function openIntervalsFromBlocks(blocks) {
    const open = [];
    for (const block of blocks) {
        const start = parseTime(block.start);
        const end = parseTime(block.end);
        const breakInts = (block.breaks || []).map((br) => ({
            start: parseTime(br.start),
            end: parseTime(br.end),
        }));
        const blockInterval = [{ start, end }];
        const free = subtractIntervals(blockInterval, breakInts);
        open.push(...free);
    }
    return mergeIntervals(open);
}
function blockedFromBreaks(blocks) {
    const out = [];
    for (const block of blocks) {
        for (const br of block.breaks || []) {
            out.push({ start: parseTime(br.start), end: parseTime(br.end) });
        }
    }
    return mergeIntervals(out);
}
function isStartWithinOpenIntervals(startMinutes, openIntervals) {
    return openIntervals.some((iv) => startMinutes >= iv.start && startMinutes <= iv.end);
}
function bookingIntersectsBlocked(startMinutes, endMinutes, mergedBlocked) {
    return mergedBlocked.some((b) => intervalsOverlap(startMinutes, endMinutes, b.start, b.end));
}
function computeAvailableSlots(schedule, exceptions, bookings, date, durationMinutes, stepMinutes, dayEnabled) {
    var _a;
    const day = getWeekdayFromDate(date);
    const blocks = (_a = schedule[day]) !== null && _a !== void 0 ? _a : [];
    if (dayEnabled && dayEnabled[day] === false)
        return [];
    if (!blocks.length)
        return [];
    const open = openIntervalsFromBlocks(blocks);
    const blockedByBreaks = blockedFromBreaks(blocks);
    const blockedByExceptions = [];
    for (const ex of exceptions) {
        if (ex.type === 'full_day') {
            blockedByExceptions.push({ start: 0, end: 24 * 60 });
            break;
        }
        if (ex.type === 'range' && ex.start != null && ex.end != null) {
            blockedByExceptions.push({
                start: parseTime(ex.start),
                end: parseTime(ex.end),
            });
        }
    }
    const blockedByBookings = bookings
        .filter((b) => { var _a; return ((_a = b.status) !== null && _a !== void 0 ? _a : '') !== 'cancelled'; })
        .map((b) => ({
        start: parseTime(b.startTime),
        end: parseTime(b.endTime),
    }));
    const allBlocked = mergeIntervals([...blockedByBreaks, ...blockedByExceptions, ...blockedByBookings]);
    const slots = [];
    for (const openIv of open) {
        let t = openIv.start;
        while (t <= openIv.end) {
            const endMin = t + durationMinutes;
            if (!bookingIntersectsBlocked(t, endMin, allBlocked)) {
                slots.push({
                    start: minutesToTime(t),
                    end: minutesToTime(endMin),
                    startMinutes: t,
                    endMinutes: endMin,
                });
            }
            t += stepMinutes;
        }
    }
    return slots;
}
function validateNewBookingTimes(params) {
    var _a;
    const { schedule, dayEnabled, date, startTime, endTime, totalDurationMinutes, exceptions, existingBookings } = params;
    const day = getWeekdayFromDate(date);
    const blocks = (_a = schedule[day]) !== null && _a !== void 0 ? _a : [];
    if (dayEnabled && dayEnabled[day] === false) {
        return { ok: false, reason: 'DAY_DISABLED' };
    }
    if (!blocks.length) {
        return { ok: false, reason: 'NO_SCHEDULE' };
    }
    const startMin = parseTime(startTime);
    const endMin = parseTime(endTime);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
        return { ok: false, reason: 'INVALID_DURATION' };
    }
    if (endMin - startMin !== totalDurationMinutes) {
        return { ok: false, reason: 'INVALID_DURATION' };
    }
    const open = openIntervalsFromBlocks(blocks);
    if (!isStartWithinOpenIntervals(startMin, open)) {
        return { ok: false, reason: 'OUTSIDE_AVAILABILITY' };
    }
    const blockedByBreaks = blockedFromBreaks(blocks);
    const blockedByExceptions = [];
    for (const ex of exceptions) {
        if (ex.type === 'full_day') {
            return { ok: false, reason: 'BLOCKED' };
        }
        if (ex.type === 'range' && ex.start != null && ex.end != null) {
            blockedByExceptions.push({
                start: parseTime(ex.start),
                end: parseTime(ex.end),
            });
        }
    }
    const blockedByBookings = existingBookings
        .filter((b) => { var _a; return ((_a = b.status) !== null && _a !== void 0 ? _a : '') !== 'cancelled'; })
        .map((b) => ({
        start: parseTime(b.startTime),
        end: parseTime(b.endTime),
    }));
    const allBlocked = mergeIntervals([...blockedByBreaks, ...blockedByExceptions, ...blockedByBookings]);
    if (bookingIntersectsBlocked(startMin, endMin, allBlocked)) {
        return { ok: false, reason: 'BLOCKED' };
    }
    return { ok: true };
}
//# sourceMappingURL=slotEngineCore.js.map