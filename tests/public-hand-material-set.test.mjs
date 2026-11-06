import test from 'node:test';
import assert from 'node:assert/strict';
import {readActions, readActionsIncremental} from '../dist/reader/native-reader.js';
import {handChange, PublicHandTracker} from '../dist/reader/public-hand.js';
import {publicHand} from '../dist/domain/public-hand.js';
import {scene} from './fixtures/scenes.mjs';

const ref = value => ({get: key => value[key]});
const list = values => ref({_size: values.length, _items: {at: index => values[index], getBaseAddress: () => 65536}});
const movement = (code, from, to, id, options = {}) => {
  const {player = 1, target = player, hidden = false} = options;
  const flags = Object.hasOwn(options, 'flags') ? options.flags : 65;
  return ref({
  datal: {get: key => {
    if (key === 'dataint') {
      if (hidden) throw Error('non-public source identity read');
      return id;
    }
    return {datatype: 1, databyte0: from, databyte1: player}[key];
  }},
  datac: ref({datatype: 3, databyte1: code, boolbits: flags}),
  datar: ref({datatype: 1, databyte0: to, databyte1: target}),
  });
};
const log = actions => ref({
  m_LogBaseItemList: list([...Array.from({length: 10}, () => ref({loglabel: 'SeparateLine', dataindex: 0})), ref({loglabel: 'CardMoveMulti', dataindex: 0})]),
  m_DataList_ShowAction: list([]),
  m_DataList_MoveMulti: list([ref({actionDatas: list(actions)})]),
  m_DataList_ShowCardName: list([]),
  m_DataList_ShowChain: list([]),
});
const catalog = {
  100: {id: 100, category: 'spell'},
  200: {id: 200, category: 'trap'},
  300: {id: 300, category: 'monster'},
  400: {id: 400, category: 'spell', fieldSpell: true},
};
const view = (events, count, logLength = 11, cards = {}) => publicHand({...scene(), logLength, counts: {...scene().counts, opponentHand: count}, publicHandEvents: events}, false, cards);

test('batch fusion materials going from hand to grave disclose each card without name rows', () => {
  const actions = [
    movement(50, 13, 16, 100),
    movement(50, 13, 16, 200),
    movement(50, 2, 16, 300, {hidden: true}),
  ];
  for (const parse of [l => readActions(l, 0), l => readActionsIncremental(l, 0, 'fusion', null).result]) {
    const changes = parse(log(actions)).handChanges;
    assert.deepEqual(changes, [
      {key: '10:0', index: 10, type: 'leave', cardId: 100},
      {key: '10:1', index: 10, type: 'leave', cardId: 200},
      {key: '10:2:monster', index: 10, type: 'fieldLeave', slot: 2},
    ]);
    const tracker = new PublicHandTracker();
    tracker.update('fusion', 10, 3, [100, 100, 200], [], 0);
    const after = tracker.update('fusion', 11, 1, [], changes, 1);
    assert.deepEqual(view(after, 1).cards, [{id: 100, count: 1}]);
    assert.deepEqual(view(after, 1).uncertainCards, []);
    assert.deepEqual(tracker.update('fusion', 11, 1, [], changes, 2), after);
  }
});

test('hidden destinations and non-movements never read the source identity', () => {
  assert.deepEqual(handChange(movement(50, 13, 17, 100, {hidden: true}), 1, 0, 0), [{key: '1:0', index: 1, type: 'leave'}]);
  assert.deepEqual(handChange(movement(50, 13, 15, 100, {hidden: true}), 1, 0, 0), [{key: '1:0', index: 1, type: 'leave'}]);
  assert.deepEqual(handChange(movement(23, 13, 16, 100, {hidden: true}), 1, 0, 0), []);
  assert.deepEqual(handChange(movement(50, 13, 16, 100, {player: 0, hidden: true}), 1, 0, 0), []);
});

test('ordinary spell/trap set preserves known monsters and field spells and can identify the sole legal set card', () => {
  const change = handChange(movement(14, 13, 9, 0, {hidden: true}), 10, 0, 0, undefined, undefined, false);
  assert.deepEqual(change, [{key: '10:0', index: 10, type: 'leave', normalSet: true, slot: 9}]);
  for (const retained of [300, 400]) {
    const tracker = new PublicHandTracker();
    tracker.update('set', 10, 2, [100, retained], [], 0, true, [], catalog);
    const after = tracker.update('set', 11, 1, [], change, 1, true, [9], catalog);
    assert.deepEqual(view(after, 1, 11, catalog).cards, [{id: retained, count: 1}]);
    assert.equal(tracker.setCards()[0].confirmedId, 100);
    assert.equal(tracker.setCards()[0].unknownPossible, false);
    assert.deepEqual(tracker.update('set', 11, 1, [], change, 2, true, [9], catalog), after);
  }
});

test('an ordinary set can be an unknown spell/trap while the visible monster remains in hand', () => {
  const change = handChange(movement(14, 13, 9, 0, {hidden: true}), 10, 0, 0, undefined, undefined, false);
  const tracker = new PublicHandTracker();
  tracker.update('unknown-set', 10, 2, [300], [], 0, true, [], catalog);
  const after = tracker.update('unknown-set', 11, 1, [], change, 1, true, [9], catalog);
  assert.deepEqual(view(after, 1, 11, catalog).cards, [{id: 300, count: 1}]);
  assert.deepEqual(tracker.setCards()[0].candidates, []);
  assert.equal(tracker.setCards()[0].unknownPossible, true);
});

test('effect placement and monster sets remain uncertain', () => {
  const cases = [
    handChange(movement(14, 13, 9, 0, {hidden: true}), 10, 0, 0, undefined, undefined, true),
    handChange(movement(13, 13, 9, 0, {hidden: true}), 10, 0, 0, undefined, undefined, false),
  ];
  for (const change of cases) {
    assert.equal(change[0].normalSet, undefined);
    const tracker = new PublicHandTracker();
    tracker.update('effect', 10, 2, [100, 300], [], 0, true, [], catalog);
    const after = tracker.update('effect', 11, 1, [], change, 1, true, [9], catalog);
    assert.deepEqual(view(after, 1, 11, catalog).cards, []);
    assert.equal(tracker.setCards()[0].confirmedId, undefined);
    assert.equal(tracker.setCards()[0].unknownPossible, true);
  }
});

test('active public chain suppresses normal-set narrowing in both readers', () => {
  const setAction = movement(14, 13, 9, 0, {hidden: true});
  for (const parse of [l => readActions(l, 0), l => readActionsIncremental(l, 0, 'chain', null).result]) {
    const makeLog = active => ref({
      m_LogBaseItemList: list(active
        ? [ref({loglabel: 'ShowChain', dataindex: 0}), ref({loglabel: 'ShowAction', dataindex: 0})]
        : [ref({loglabel: 'ShowAction', dataindex: 0})]),
      m_DataList_ShowAction: list([setAction]),
      m_DataList_MoveMulti: list([]),
      m_DataList_ShowCardName: list([]),
      m_DataList_ShowChain: list([ref({type: 1, cardid: 999})]),
    });
    assert.equal(parse(makeLog(false)).handChanges[0].normalSet, true);
    assert.equal(parse(makeLog(true)).handChanges[0].normalSet, undefined);
  }
});

test('effect placement after a separator and unverified flags cannot become an ordinary set', () => {
  for (const flags of [81, 113, undefined]) {
    const setAction = movement(14, 13, 9, 0, {hidden: true, flags});
    assert.equal(handChange(setAction, 3, 0, 0, undefined, undefined, false)[0].normalSet, undefined);
    const sample = ref({
      m_LogBaseItemList: list([
        ref({loglabel: 'ShowChain', dataindex: 0}),
        ref({loglabel: 'SeparateLine', dataindex: 0}),
        ref({loglabel: 'ShowAction', dataindex: 0}),
      ]),
      m_DataList_ShowAction: list([setAction]),
      m_DataList_MoveMulti: list([]),
      m_DataList_ShowCardName: list([]),
      m_DataList_ShowText: list([]),
      m_DataList_ShowChain: list([ref({type: 1, cardid: 999, team: 1})]),
    });
    for (const parse of [l => readActions(l, 0), l => readActionsIncremental(l, 0, 'separator', null).result]) {
      assert.equal(parse(sample).handChanges.at(-1).normalSet, undefined);
    }
  }
});
