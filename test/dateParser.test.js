import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTimezone, parseEventTime, validateEventDate } from '../src/dateParser.js';

function parse(input, referenceIso, defaultTimezone = 'America/New_York') {
  const timezone = extractTimezone(input)?.iana ?? defaultTimezone;
  const parsed = parseEventTime(input, timezone, new Date(referenceIso));
  return parsed?.toISOString();
}

test('default Eastern parsing works when the process timezone is UTC', () => {
  const reference = '2026-01-15T17:00:00.000Z';

  assert.equal(parse('8pm', reference), '2026-01-16T01:00:00.000Z');
  assert.equal(parse('today 8pm', reference), '2026-01-16T01:00:00.000Z');
  assert.equal(parse('tomorrow 8pm', reference), '2026-01-17T01:00:00.000Z');
});

test('weekday phrases resolve forward instead of into the past', () => {
  const thursdayReference = '2026-01-15T17:00:00.000Z';

  assert.equal(parse('Wednesday 8pm', thursdayReference), '2026-01-22T01:00:00.000Z');
});

test('timezone abbreviations use the intended civil timezone', () => {
  const summerReference = '2026-07-15T16:00:00.000Z';

  assert.equal(parse('8pm EST', summerReference), '2026-07-16T00:00:00.000Z');
  assert.equal(parse('8pm EDT', summerReference), '2026-07-16T00:00:00.000Z');
  assert.equal(parse('8pm PST', summerReference), '2026-07-16T03:00:00.000Z');
});

test('reset phrases are UTC based and tomorrow reset is distinct from reset', () => {
  const afterResetReference = '2026-01-15T17:00:00.000Z';

  assert.equal(parse('reset', afterResetReference), '2026-01-16T00:00:00.000Z');
  assert.equal(parse('reset+1.5', afterResetReference), '2026-01-16T01:30:00.000Z');
  assert.equal(parse('tomorrow reset', afterResetReference), '2026-01-17T00:00:00.000Z');
});

test('today remains the current local day and can still validate as past', () => {
  const lateNightEasternReference = new Date('2026-07-15T03:30:00.000Z');
  const parsed = parseEventTime('today 8pm', 'America/New_York', lateNightEasternReference);

  assert.equal(parsed.toISOString(), '2026-07-15T00:00:00.000Z');
  assert.deepEqual(validateEventDate(parsed, lateNightEasternReference), {
    valid: false,
    error: 'Event time must be in the future'
  });
});
