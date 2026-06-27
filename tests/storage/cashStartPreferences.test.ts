import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadCashStartPreferences,
  saveCashLocationPreference,
  saveCashStartPreferences
} from '../../src/storage/cashStartPreferences';

describe('cash start preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads empty defaults when storage is empty or invalid', () => {
    expect(loadCashStartPreferences()).toEqual({
      lastLocation: '',
      lastStakes: '',
      lastBuyInDollars: '',
      locations: [],
      stakes: [],
      buyIns: []
    });

    localStorage.setItem('stackflow.cash.start.preferences.v1', '{');

    expect(loadCashStartPreferences()).toEqual({
      lastLocation: '',
      lastStakes: '',
      lastBuyInDollars: '',
      locations: [],
      stakes: [],
      buyIns: []
    });
  });

  it('saves trimmed values and dedupes recents case-insensitively', () => {
    saveCashStartPreferences({ location: ' Bellagio ', stakes: ' 1/3 ', buyInDollars: ' 300 ' });
    const next = saveCashStartPreferences({ location: 'bellagio', stakes: '2/5', buyInDollars: '500' });

    expect(next).toEqual({
      lastLocation: 'bellagio',
      lastStakes: '2/5',
      lastBuyInDollars: '500',
      locations: ['bellagio'],
      stakes: ['2/5', '1/3'],
      buyIns: ['500', '300']
    });
  });

  it('updates only the location preference when requested', () => {
    saveCashStartPreferences({ location: 'Aria', stakes: '5/10', buyInDollars: '1000' });

    const next = saveCashLocationPreference(' Resorts World ');

    expect(next.lastLocation).toBe('Resorts World');
    expect(next.locations[0]).toBe('Resorts World');
    expect(next.lastStakes).toBe('5/10');
    expect(next.lastBuyInDollars).toBe('1000');
  });

  it('keeps only the five most recent values', () => {
    for (let index = 1; index <= 6; index += 1) {
      saveCashStartPreferences({
        location: `Room ${index}`,
        stakes: `${index}/${index * 2}`,
        buyInDollars: String(index * 100)
      });
    }

    expect(loadCashStartPreferences()).toMatchObject({
      locations: ['Room 6', 'Room 5', 'Room 4', 'Room 3', 'Room 2'],
      stakes: ['6/12', '5/10', '4/8', '3/6', '2/4'],
      buyIns: ['600', '500', '400', '300', '200']
    });
  });
});
