import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadTournamentStartPreferences,
  saveTournamentStartPreferences
} from '../../src/storage/tournamentStartPreferences';

describe('tournament start preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads empty defaults when storage is empty or malformed', () => {
    expect(loadTournamentStartPreferences()).toEqual({
      lastStakes: '',
      lastBuyInDollars: '',
      stakes: [],
      buyIns: []
    });

    localStorage.setItem('stackflow.tournament.start.preferences.v1', '{');

    expect(loadTournamentStartPreferences()).toEqual({
      lastStakes: '',
      lastBuyInDollars: '',
      stakes: [],
      buyIns: []
    });
  });

  it('saves trimmed values and keeps recent unique values', () => {
    saveTournamentStartPreferences({ stakes: ' $120 ', buyInDollars: ' 120 ' });
    const next = saveTournamentStartPreferences({ stakes: '$250', buyInDollars: '250' });

    expect(next).toEqual({
      lastStakes: '$250',
      lastBuyInDollars: '250',
      stakes: ['$250', '$120'],
      buyIns: ['250', '120']
    });
  });

  it('keeps only the five most recent values', () => {
    for (let index = 1; index <= 6; index += 1) {
      saveTournamentStartPreferences({
        stakes: `$${index * 100}`,
        buyInDollars: String(index * 100)
      });
    }

    expect(loadTournamentStartPreferences()).toMatchObject({
      stakes: ['$600', '$500', '$400', '$300', '$200'],
      buyIns: ['600', '500', '400', '300', '200']
    });
  });
});
