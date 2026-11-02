// c00_demo.js: a demo chapter showing the shot API. Replace with the film's chapters (one file per chapter, one scene each).
// chapter(name, start, end, [[t0, fn | null], ...]): fn(t, lt, dur) paints the WHOLE frame; t song time, lt = t - t0.
// null = not painted yet (the storyboard placeholder shows instead). Every shot needs camera movement and one event.
(() => {
  // shot 1: the city at night; the camera sinks from the moon to a lit window, the lead walks in.
  function city(t, lt, dur) {
    const z = kf(lt, [[0, 1], [dur, 1.35]]), cy = kf(lt, [[0, 420], [dur, 700]]);
    camBegin(W / 2, cy, z);
    nightCity(t, { lit: kf(lt, [[0, .1], [3, .5]]) });
    me(kf(lt, [[0, -200], [6, 760]], easeOut), H - 70, 9, { ...move('idle', t), walk: lt * 2.2, eyes: 'look', lookX: 1 });
    camEnd();
    snowfall(t, { k: .6 });
  }
  // shot 2: the room; lamp switches on at 12 s (world.js lampOn), the lead looks out of the window (nested city).
  function room(t, lt, dur) {
    camBegin(kf(lt, [[0, 960], [dur, 1100]]), 560, kf(lt, [[0, 1], [dur, 1.2]]));
    roomSet(t);
    const m = mood(t, [[10, 'normal'], [12.2, 'happy', 'spark']]);
    me(900, ROOM.floor, 16, { ...m, ...move('sway', t), aR: .9 });
    speechBubble(1060, 600, 60, { pop: seg(lt, 3, 3.6), heart: seg(lt, 3.6, 4.2) });
    camEnd();
  }
  chapter('demo', 0, CONFIG.duration, [[0, city], [10, room]]);
})();
