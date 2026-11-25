import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isUsCountry,
  normalizeShippingState,
  normalizeUsState,
  stateAfterCountryChange,
  US_STATE_OPTIONS,
} from './usStates';

test('state choices retain all states, DC, existing postal territories and military regions', () => {
  assert.equal(US_STATE_OPTIONS.length, 59);
  assert.equal(new Set(US_STATE_OPTIONS.map(({ code }) => code)).size, 59);
  for (const code of ['HI', 'AK', 'DC', 'PR', 'VI', 'GU', 'AS', 'MP', 'AA', 'AE', 'AP'])
    assert.equal(normalizeUsState(code), code);
});

test('U.S. country aliases select the same state rules without changing other countries', () => {
  for (const country of ['US', 'USA', 'United States', ' usa ', 'united  states'])
    assert.equal(isUsCountry(country), true);
  for (const country of ['CAN', 'CA', 'United Kingdom', '', null, undefined])
    assert.equal(isUsCountry(country), false);
});

test('state names and postal codes normalize case and extra spaces without guessing invalid entries', () => {
  assert.equal(normalizeUsState(' california '), 'CA');
  assert.equal(normalizeUsState('ca'), 'CA');
  assert.equal(normalizeUsState('new   york'), 'NY');
  assert.equal(normalizeUsState('District of Columbia'), 'DC');
  assert.equal(normalizeUsState('Armed Forces Europe'), 'AE');
  assert.equal(normalizeUsState('U.S. Virgin Islands'), 'VI');
  for (const value of ['', 'Ontario', 'Calif', 'CAA', 'Washington state', null, undefined])
    assert.equal(normalizeUsState(value), null);
});

test('submission uses U.S. postal codes and keeps non-U.S. province names as text', () => {
  assert.equal(normalizeShippingState('USA', 'California'), 'CA');
  assert.equal(normalizeShippingState('United States', 'tx'), 'TX');
  assert.equal(normalizeShippingState('USA', 'Ontario'), '');
  assert.equal(normalizeShippingState('CAN', ' Ontario '), 'Ontario');
  assert.equal(normalizeShippingState('NGA', 'Cross River'), 'Cross River');
});

test('country changes clear unrelated states but country aliases preserve the same address region', () => {
  assert.equal(stateAfterCountryChange('USA', 'US', 'California'), 'CA');
  assert.equal(stateAfterCountryChange('United States', 'USA', ' ca '), 'CA');
  assert.equal(stateAfterCountryChange('CAN', 'Canada', 'Ontario'), 'Ontario');
  assert.equal(stateAfterCountryChange('USA', 'CAN', 'CA'), '');
  assert.equal(stateAfterCountryChange('CAN', 'USA', 'Ontario'), '');
  assert.equal(stateAfterCountryChange('NGA', 'CAN', 'Lagos'), '');
  assert.equal(stateAfterCountryChange('', 'USA', 'CA'), '');
});
