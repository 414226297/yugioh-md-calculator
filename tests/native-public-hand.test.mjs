import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeReader} from '../dist/reader/native-reader.js';

const ref = values => ({
  get: key => values[key],
  getClassName: () => values.className ?? '',
  getBaseAddress: () => 100,
});
const list = rows => ref({_size: rows.length, _items: {at: index => rows[index], getBaseAddress: () => 1000}});

function readWithDeckCount(deckCount) {
  const deckPlace = ref({team: 1, position: 15});
  if (deckCount === 'throws') {
    Object.defineProperty(deckPlace, 'get', {value: key => {
      if (key === 'localCardNum') throw Error('optional deck count unavailable');
      return {team: 1, position: 15}[key];
    }});
  } else {
    deckPlace.get = key => ({team: 1, position: 15, localCardNum: deckCount})[key];
  }
  const duelView = ref({className: 'YgomGame.Duel.DuelView'});
  const field = ref({nearHandPlace: ref({team: 0}), cardPlaces: list([deckPlace])});
  const log = ref({
    m_LogBaseItemList: list([]),
    m_DataList_ShowAction: list([]),
    m_DataList_MoveMulti: list([]),
    m_DataList_ShowChain: list([]),
    m_DataList_ShowCardName: list([]),
    m_DataList_ShowText: list([]),
  });
  const hand = list([ref({m_IsHide: false, m_Mrk: 200})]);
  const duel = ref({
    effectWorker: ref({goManager: ref({duelField: field, cardRoots: list([])})}),
    handCardManager: ref({nearHandInfoList: list([]), farHandInfoList: hand}),
    duelHUD: ref({duellog: log}),
    engineInitializer: ref({duelSettings: ref({_count: 0, _entries: {at: () => null}})}),
  });
  const classes = {
    'YgomGame.Menu.ContentViewControllerManager': ref({Instance: ref({viewStack: list([duelView])})}),
    'YgomGame.Duel.DuelClient': ref({instance: duel}),
  };
  return new NativeReader('', 1, '', {getClass: name => classes[name] ?? ref({})}).read();
}

test('optional opponent deck count cannot discard an otherwise valid public hand observation', () => {
  for (const unavailable of [undefined, 'throws']) {
    const snapshot = readWithDeckCount(unavailable);
    assert.equal(snapshot.status, 'duel');
    assert.deepEqual(snapshot.publicHandObservation?.cards, [200]);
    assert.deepEqual(snapshot.publicHandObservation?.changes, []);
    assert.equal(snapshot.publicHandObservation?.drawState, undefined);
  }
});

test('valid opponent deck count stays available for draw inference', () => {
  const snapshot = readWithDeckCount(54);
  assert.deepEqual(snapshot.publicHandObservation?.cards, [200]);
  assert.equal(snapshot.publicHandObservation?.drawState?.deckCount, 54);
});
