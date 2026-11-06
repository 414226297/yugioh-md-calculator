import test from 'node:test';
import assert from 'node:assert/strict';
import {readActions, readActionsIncremental, normalDrawWindow} from '../dist/reader/native-reader.js';
import {PublicHandTracker} from '../dist/domain/public-hand-tracker.js';
import {publicHand} from '../dist/domain/public-hand.js';
import {DuelStore} from '../dist/domain/store.js';
import {renderSidebar} from '../dist/ui/sidebar.js';
import {scene} from './fixtures/scenes.mjs';

const ref = value => ({get: key => value[key]});
const list = values => ref({_size: values.length, _items: {at: index => values[index], getBaseAddress: () => 65536}});
const table = [];
table[11] = '选择了"<color=#FFC200>卡组顶端</color>"。';
table[12] = '选择了"<color=#FFC200>卡组底端</color>"。';
const move = (code, from, player, to = null, target = player) => ref({
  datal: {get: key => {
    if (key === 'dataint') {
      if (player !== 0) throw Error('hidden deck or hand identity read');
      return 1;
    }
    return {datatype: 1, databyte0: from, databyte1: player}[key];
  }},
  datac: ref({datatype: 3, databyte1: code}),
  datar: ref({datatype: to === null ? 0 : 1, databyte0: to, databyte1: target}),
});
const cue = (first = 100, second = 200, selected = first, textid = 11) => [
  {chain: {type: 1, cardid: 21956, team: 0}},
  {name: first}, {action: move(19, 15, 1)},
  {name: second}, {action: move(19, 15, 1)},
  {name: selected}, {action: move(18, 15, 1, 17)},
  {textid},
];
const draw = (player = 1) => ({action: move(1, 13, player)});
function log(rows) {
  const base = [], actions = [], batches = [], names = [], chains = [], texts = [], phases = [];
  for (const row of rows) {
    let loglabel, dataindex;
    if ('name' in row) {loglabel = 'ShowCardName'; dataindex = names.push(ref({cardid: row.name})) - 1;}
    else if (row.action) {loglabel = 'ShowAction'; dataindex = actions.push(row.action) - 1;}
    else if (row.batch) {loglabel = 'CardMoveMulti'; dataindex = batches.push(ref({actionDatas: list(row.batch)})) - 1;}
    else if (row.chain) {loglabel = 'ShowChain'; dataindex = chains.push(ref(row.chain)) - 1;}
    else if ('textid' in row) {loglabel = 'ShowText'; dataindex = texts.push(ref({textid: row.textid})) - 1;}
    else if ('phase' in row) {loglabel = 'ShowPhase'; dataindex = phases.push(ref({phase: row.phase})) - 1;}
    else {loglabel = row.label; dataindex = 0;}
    base.push(ref({loglabel, dataindex}));
  }
  return ref({m_LogBaseItemList: list(base), m_DataList_ShowAction: list(actions),
    m_DataList_ShowCardName: list(names), m_DataList_ShowChain: list(chains),
    m_DataList_ShowText: list(texts), m_DataList_ShowPhase: list(phases), m_DataList_MoveMulti: list(batches)});
}
const changes = rows => readActions(log(rows), 0, table).handChanges;
const view = (events, count, length) => publicHand({...scene(), logLength: length,
  counts: {...scene().counts, opponentHand: count}, publicHandEvents: events});
const trace = (rows, count = 0) => {
  const tracker = new PublicHandTracker();
  const events = tracker.update('deck', rows.length, count, [], changes(rows), 1);
  return {tracker, events, hand: view(events, count, rows.length)};
};

test('observed Cue log structure proves only the remaining top card', () => {
  const rows = cue();
  assert.deepEqual(changes(rows), [{key: '7:deck', index: 7, type: 'deckTop', cardId: 200}]);
  const withDraw = [...rows, draw()];
  const result = trace(withDraw, 1);
  assert.deepEqual(result.hand.cards, [{id: 200, count: 1}]);
  assert.deepEqual(result.events.filter(e => e.type === 'enter').map(e => [e.cardId, e.source]), [[200, 'draw']]);
});

test('boolean chain side follows the near player in either seat through the next draw', () => {
  for(const myTeam of [0,1]){
    const rows=cue(14627,17768,14627).map(row=>{
      if(row.chain)return {chain:{...row.chain,team:true}};
      if(row.action){
        const a=row.action;
        return {action:ref({datal:ref({datatype:1,databyte0:15,databyte1:1-myTeam}),datac:a.get('datac'),datar:ref({datatype:a.get('datar').get('datatype'),databyte0:17,databyte1:1-myTeam})})};
      }
      return row;
    });
    rows.push({chain:{type:1,cardid:21957,team:true}},draw(1-myTeam));
    const decoded=readActions(log(rows),myTeam,table).handChanges;
    assert.equal(decoded.find(c=>c.type==='deckTop')?.cardId,17768);
    const first=readActionsIncremental(log(rows.slice(0,-1)),myTeam,'bool-seat',null,table);
    const next=readActionsIncremental(log(rows),myTeam,'bool-seat',first.history,table);
    assert.deepEqual(next.result.handChanges,decoded);
    const tracker=new PublicHandTracker();
    const events=tracker.update('seat',rows.length,1,[],decoded,1);
    assert.deepEqual(view(events,1,rows.length).cards,[{id:17768,count:1}]);
    const opponent=rows.map(row=>row.chain?{chain:{...row.chain,team:false}}:row);
    assert.equal(readActions(log(opponent),myTeam,table).handChanges.some(c=>c.type==='deckTop'),false);
    const reset=[...rows.slice(0,-1),{chain:{type:1,cardid:21957,team:false}},draw(1-myTeam)];
    const resetTracker=new PublicHandTracker();
    const resetEvents=resetTracker.update('reset-seat',reset.length,1,[],readActions(log(reset),myTeam,table).handChanges,1);
    assert.deepEqual(view(resetEvents,1,reset.length).cards,[]);
  }
});

test('confirmed top appears in the hand panel without counting as a hand card, then moves to hand on draw', () => {
  const store = new DuelStore();
  const accept = (rows, count, timestamp) => {
    store.accept({...scene(), session: 'top-panel', timestamp, logLength: rows.length,
      counts: {...scene().counts, opponentHand: count},
      publicHandObservation: {cards: [], changes: changes(rows)}});
    return store.view(timestamp);
  };
  const top = accept(cue(), 0, 1000);
  assert.equal(store.snapshot.publicHandEvents.filter(event => event.type === 'enter').length, 0);
  assert.equal(top.publicDeckTop, 200);
  assert.deepEqual(top.publicHand.cards, []);
  const topMarkup = renderSidebar(top, ['hand']);
  assert.match(topMarkup, /已确认 0 张/);
  assert.match(topMarkup, /对方已确认牌组顶端/);
  assert.match(topMarkup, /data-card-detail="200"/);
  assert.match(topMarkup, /顶牌/);

  const drawn = accept([...cue(), draw()], 1, 1100);
  assert.equal(drawn.publicDeckTop, null);
  assert.deepEqual(drawn.publicHand.cards, [{id: 200, count: 1}]);
  const drawnMarkup = renderSidebar(drawn, ['hand']);
  assert.match(drawnMarkup, /已确认 1 张/);
  assert.doesNotMatch(drawnMarkup, /对方已确认牌组顶端/);
});

test('deck reset and unavailable views hide prior top proof', () => {
  const make = (session = 'top-reset') => {
    const store = new DuelStore();
    const accept = (rows, timestamp, observation = true) => {
      store.accept({...scene(), session, timestamp, logLength: rows.length,
        counts: {...scene().counts, opponentHand: 0},
        ...(observation ? {publicHandObservation: {cards: [], changes: changes(rows)}} : {})});
      return store.view(timestamp);
    };
    return {store, accept};
  };
  const reset = make();
  assert.equal(reset.accept(cue(), 1000).publicDeckTop, 200);
  assert.equal(reset.accept([...cue(), {chain: {type: 1, cardid: 999, team: 0}}], 1100).publicDeckTop, null);

  const unavailable = make('top-unavailable');
  assert.equal(unavailable.accept(cue(), 1000).publicDeckTop, 200);
  assert.equal(unavailable.store.view(3001).publicDeckTop, null);
  assert.equal(unavailable.accept(cue(), 3100, false).publicDeckTop, null);
  unavailable.store.accept({...scene(), status: 'menu', session: null, timestamp: 3200});
  assert.equal(unavailable.store.view(3200).publicDeckTop, null);
});

test('bottom text, missing names, wrong selection and unknown effect prove no top card', () => {
  const cases = [
    cue(100, 200, 100, 12),
    cue().filter((_, index) => index !== 3),
    cue(100, 200, 300),
    [{chain: {type: 1, cardid: 999, team: 0}}, ...cue().slice(1)],
    cue().map((row, index) => index === 0 ? {chain: {type: 1, cardid: 21956, team: 1}} : row),
    cue().map((row, index) => index === 2 ? {action: move(19, 15, 0)} : row),
  ];
  for (const rows of cases) {
    assert.equal(changes(rows).some(c => c.type === 'deckTop'), false);
    assert.deepEqual(trace([...rows, draw()], 1).hand.cards, []);
  }
});

test('two identical revealed names leave one known top copy', () => {
  const rows = [...cue(100, 100, 100), draw()];
  assert.deepEqual(changes(rows).filter(c => c.type === 'deckTop').map(c => c.cardId), [100]);
  assert.deepEqual(trace(rows, 1).hand.cards, [{id: 100, count: 1}]);
});

test('own draw does not consume opponent top; two opponent draws consume it once', () => {
  const rows = [...cue(), draw(0), draw(1), draw(1)];
  const {events, hand} = trace(rows, 2);
  assert.deepEqual(events.filter(e => e.type === 'enter').map(e => e.cardId), [200, null]);
  assert.deepEqual(hand.cards, [{id: 200, count: 1}]);
});

test('later public draw confirmation does not duplicate the top card', () => {
  const rows = [...cue(), draw(), {name: 200}, {action: move(31, 13, 1)}];
  const {events, hand} = trace(rows, 1);
  assert.deepEqual(events.filter(e => e.type === 'enter').map(e => e.cardId), [200]);
  assert.deepEqual(hand.cards, [{id: 200, count: 1}]);
});

test('shuffle or another effect clears top proof while already drawn cards remain in hand', () => {
  for (const reset of [{chain: {type: 1, cardid: 999, team: 0}}, {textid: 12}, {action: move(19, 15, 1)}]) {
    const beforeDraw = [...cue(), reset, draw()];
    assert.deepEqual(trace(beforeDraw, 1).hand.cards, []);
    const afterDraw = [...cue(), draw(), reset];
    assert.deepEqual(trace(afterDraw, 1).hand.cards, [{id: 200, count: 1}]);
  }
});

test('incremental reads preserve proof across samples, repeat idempotently and discard it on rollback', () => {
  const rows = cue(), tracker = new PublicHandTracker();
  let history = null;
  const step = (sample, count, time) => {
    const result = readActionsIncremental(log(sample), 0, 'deck', history, table);
    history = result.history;
    return tracker.update('deck', sample.length, count, [], result.result.handChanges, time);
  };
  step(rows.slice(0, 3), 0, 1);
  step(rows.slice(0, 6), 0, 2);
  step(rows, 0, 3);
  const repeated = step(rows, 0, 4);
  assert.deepEqual(step([...rows, draw()], 1, 5).filter(e => e.type === 'enter').map(e => e.cardId), [200]);
  assert.deepEqual(step([...rows, draw()], 1, 6).filter(e => e.type === 'enter').map(e => e.cardId), [200]);
  assert.equal(repeated.filter(e => e.type === 'enter').length, 0);
  const rollback = step(rows.slice(0, 6), 1, 7);
  assert.deepEqual(view(rollback, 1, 6).cards, []);
});

test('normal draw window requires only draw phase rows after the last turn', () => {
  const valid = [{label: 'ShowTurn'}, {label: 'SeparateLine'}, {phase: 0}, {label: 'SeparateLine'}];
  const window = rows => {
    const sample = log(rows), base = sample.get('m_LogBaseItemList').get('_items');
    const prefix = rows.map((_, index) => ({label: base.at(index).get('loglabel'), index: base.at(index).get('dataindex')}));
    return normalDrawWindow(sample, prefix);
  };
  assert.deepEqual(window(valid), {turnIndex: 0, index: 2});
  for (const rows of [
    valid.slice(0, 2),
    [{label: 'ShowTurn'}, {phase: 1}],
    [{label: 'ShowTurn'}, {phase: 0}, {phase: 2}],
    [{label: 'ShowTurn'}, {phase: 0}, draw()],
    [{label: 'ShowTurn'}, {phase: 0}, {textid: 11}],
  ]) assert.equal(window(rows), undefined);
});

test('store infers a normal draw from paired public counts and consumes known top once', () => {
  const store = new DuelStore(), base = cue();
  const drawRows = [...base, {label: 'ShowTurn'}, {phase: 0}];
  const accept = (rows, hand, deckCount, timestamp, session = 'natural') => {
    const parsed = readActions(log(rows), 0, table);
    store.accept({...scene(), session, timestamp, logLength: rows.length,
      counts: {...scene().counts, opponentHand: hand},
      publicHandObservation: {cards: [], changes: parsed.handChanges,
        drawState: {deckCount, window: parsed.normalDraw}}});
    return store.view(timestamp).publicHand;
  };
  accept(base, 4, 30, 1000);
  assert.deepEqual(accept(drawRows, 5, 29, 1100).cards, [{id: 200, count: 1}]);
  assert.deepEqual(accept(drawRows, 5, 29, 1200).cards, [{id: 200, count: 1}]);
  const nextTurn = [...drawRows, {label: 'ShowTurn'}, {phase: 0}];
  assert.deepEqual(accept(nextTurn, 6, 28, 1300).cards, [{id: 200, count: 1}]);
  assert.equal(store.snapshot.publicHandEvents.filter(e => e.type === 'enter').length, 2);
  assert.deepEqual(store.snapshot.publicHandEvents.filter(e => e.type === 'enter').map(e => e.cardId), [200, null]);
});

test('normal draw waits for hand and deck count in either arrival order', () => {
  const base = cue(), drawRows = [...base, {label: 'ShowTurn'}, {phase: 0}];
  for (const handFirst of [true, false]) {
    const store = new DuelStore();
    const accept = (rows, hand, deckCount, timestamp) => {
      const parsed = readActions(log(rows), 0, table);
      store.accept({...scene(), session: `race-${handFirst}`, timestamp, logLength: rows.length,
        counts: {...scene().counts, opponentHand: hand},
        publicHandObservation: {cards: [], changes: parsed.handChanges,
          drawState: {deckCount, window: parsed.normalDraw}}});
      return store.view(timestamp).publicHand;
    };
    accept(base, 4, 30, 1000);
    const pending = accept(drawRows, handFirst ? 5 : 4, handFirst ? 30 : 29, 1100);
    assert.deepEqual(pending.cards, []);
    assert.equal(store.snapshot.publicHandBusy, true);
    assert.deepEqual(accept(drawRows, 5, 29, 1200).cards, [{id: 200, count: 1}]);
  }
});

test('unpaired or skipped counts expire without claiming the top card', () => {
  const base = cue(), drawRows = [...base, {label: 'ShowTurn'}, {phase: 0}];
  for (const [hand, deckCount] of [[5, 30], [4, 29], [6, 28]]) {
    const store = new DuelStore();
    const accept = timestamp => {
      const rows = timestamp === 1000 ? base : drawRows;
      const parsed = readActions(log(rows), 0, table);
      store.accept({...scene(), session: `bad-${hand}-${deckCount}`, timestamp, logLength: rows.length,
        counts: {...scene().counts, opponentHand: timestamp === 1000 ? 4 : hand},
        publicHandObservation: {cards: [], changes: parsed.handChanges,
          drawState: {deckCount: timestamp === 1000 ? 30 : deckCount, window: parsed.normalDraw}}});
      return store.view(timestamp).publicHand;
    };
    accept(1000);accept(1100);
    assert.deepEqual(accept(2700).cards, []);
    assert.equal(store.snapshot.publicHandEvents.filter(e => e.type === 'enter').length, 0);
  }
});

test('fresh attachment, new session and rollback cannot claim an unobserved normal draw', () => {
  const rows = [...cue(), {label: 'ShowTurn'}, {phase: 0}], parsed = readActions(log(rows), 0, table);
  const store = new DuelStore();
  const accept = (session, sampleRows, hand, deckCount, timestamp) => {
    const data = readActions(log(sampleRows), 0, table);
    store.accept({...scene(), session, timestamp, logLength: sampleRows.length,
      counts: {...scene().counts, opponentHand: hand},
      publicHandObservation: {cards: [], changes: data.handChanges,
        drawState: {deckCount, window: data.normalDraw}}});
    return store.view(timestamp).publicHand;
  };
  assert.deepEqual(accept('fresh', rows, 5, 29, 1000).cards, []);
  assert.equal(parsed.normalDraw.turnIndex, 8);
  assert.deepEqual(accept('next', rows, 5, 29, 1100).cards, []);
  accept('next', [...rows, {label: 'SeparateLine'}], 5, 29, 1200);
  assert.deepEqual(accept('next', rows.slice(0, 8), 5, 29, 1300).cards, []);
});

test('explicit draw in the phase never receives a second synthetic draw', () => {
  const store = new DuelStore(), base = cue(), phase = [...base, {label: 'ShowTurn'}, {phase: 0}];
  const accept = (rows, hand, deckCount, timestamp, forceWindow) => {
    const parsed = readActions(log(rows), 0, table);
    store.accept({...scene(), session: 'explicit', timestamp, logLength: rows.length,
      counts: {...scene().counts, opponentHand: hand},
      publicHandObservation: {cards: [], changes: parsed.handChanges,
        drawState: {deckCount, window: forceWindow ?? parsed.normalDraw}}});
  };
  accept(base, 4, 30, 1000);
  accept([...phase, draw()], 5, 29, 1100, {turnIndex: 8, index: 9});
  assert.deepEqual(store.snapshot.publicHandEvents.filter(e => e.type === 'enter').map(e => e.cardId), [200]);
});

test('own deck effects preserve top proof; opponent effects and deck moves reset it', () => {
  for (const id of [21953, 21955, 21957, 21961, 21962]) {
    for (const type of [0, 1]) {
      const rows = [...cue(), {chain: {type, cardid: id, team: 0}}, draw()];
      assert.deepEqual(trace(rows, 1).hand.cards, [{id: 200, count: 1}], `${id}/${type}`);
    }
  }
  for (const row of [
    {chain: {type: 1, cardid: 21953, team: 1}},
    {action: move(19, 15, 1)},
    {action: move(33, 2, 1, 15)},
  ]) assert.deepEqual(trace([...cue(), row, draw()], 1).hand.cards, []);
});

test('public draw disclosure corrects a mistaken top inference without adding a copy', () => {
  const rows = [...cue(), draw(), {name: 100}, {action: move(31, 13, 1)}];
  const {events, hand} = trace(rows, 1);
  assert.deepEqual(events.filter(e => e.type === 'enter').map(e => e.cardId), [100]);
  assert.deepEqual(hand.cards, [{id: 100, count: 1}]);
});

test('late explicit draw acknowledges the synthetic draw and later public name corrects it once', () => {
  const store = new DuelStore(), base = cue(), phase = [...base, {label: 'ShowTurn'}, {phase: 0}];
  const accept = (rows, hand, deckCount, timestamp) => {
    const parsed = readActions(log(rows), 0, table);
    store.accept({...scene(), session: 'late-draw', timestamp, logLength: rows.length,
      counts: {...scene().counts, opponentHand: hand},
      publicHandObservation: {cards: [], changes: parsed.handChanges,
        drawState: {deckCount, window: parsed.normalDraw}}});
    return store.snapshot.publicHandEvents;
  };
  accept(base, 4, 30, 1000);
  const synthetic = accept(phase, 5, 29, 1100);
  assert.deepEqual(synthetic.filter(e => e.type === 'enter').map(e => e.cardId), [200]);
  const explicitRows = [...phase, draw()];
  assert.equal(readActions(log(explicitRows), 0, table).handChanges.at(-1).normalDrawTurn, 8);
  const acknowledged = accept(explicitRows, 5, 29, 1200);
  assert.deepEqual(acknowledged.filter(e => e.type === 'enter').map(e => e.cardId), [200]);
  assert.deepEqual(accept(explicitRows, 5, 29, 1300), acknowledged);
  const revealedRows = [...explicitRows, {name: 100}, {action: move(31, 13, 1)}];
  const revealed = accept(revealedRows, 5, 29, 1400);
  assert.deepEqual(revealed.filter(e => e.type === 'enter').map(e => e.cardId), [100]);
  assert.deepEqual(view(revealed, 5, revealedRows.length).cards, [{id: 100, count: 1}]);
  assert.deepEqual(accept(revealedRows, 5, 29, 1500), revealed);
});

test('late two-card draw batch acknowledges only the first card', () => {
  const store = new DuelStore(), base = cue(), phase = [...base, {label: 'ShowTurn'}, {phase: 0}];
  const accept = (rows, hand, deckCount, timestamp) => {
    const parsed = readActions(log(rows), 0, table);
    store.accept({...scene(), session: 'late-batch', timestamp, logLength: rows.length,
      counts: {...scene().counts, opponentHand: hand},
      publicHandObservation: {cards: [], changes: parsed.handChanges,
        drawState: {deckCount, window: parsed.normalDraw}}});
    return store.snapshot.publicHandEvents;
  };
  accept(base, 4, 30, 1000);
  accept(phase, 5, 29, 1100);
  const rows = [...phase, {batch: [move(1, 13, 1), move(1, 13, 1)]}];
  const events = accept(rows, 6, 28, 1200);
  assert.deepEqual(events.filter(e => e.type === 'enter').map(e => e.cardId), [200, null]);
  assert.deepEqual(accept(rows, 6, 28, 1300), events);
});

test('a second explicit draw in the same turn has no normal-draw tag', () => {
  const rows = [...cue(), {label: 'ShowTurn'}, {phase: 0}, draw(), draw()];
  const draws = changes(rows).filter(c => c.type === 'enter');
  assert.deepEqual(draws.map(c => c.normalDrawTurn), [8, undefined]);
});

test('text table recovery reparses cached proof, and Cue chain closure preserves known top', () => {
  const rows = cue();
  const missing = readActionsIncremental(log(rows), 0, 'text-cache', null, []);
  assert.equal(missing.result.handChanges.some(c => c.type === 'deckTop'), false);
  const recovered = readActionsIncremental(log(rows), 0, 'text-cache', missing.history, table);
  assert.deepEqual(recovered.result.handChanges.filter(c => c.type === 'deckTop').map(c => c.cardId), [200]);
  const closure = [...rows, {chain: {type: 3, cardid: 21956, team: 0}}, draw()];
  assert.deepEqual(trace(closure, 1).hand.cards, [{id: 200, count: 1}]);
});
