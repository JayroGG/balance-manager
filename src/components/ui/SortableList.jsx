import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { dropHaptic, liftHaptic } from '../../theme/motion';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Snap, no overshoot: short ease-out for every settle / displacement.
const SNAP = { duration: 170, easing: Easing.out(Easing.cubic) };

// Generic vertical-only drag-to-reorder list (translateY only — never horizontal). Long-press arms the
// drag (impact haptic + lift: scale + shadow); on drop the row springs into its slot (success haptic).
// All rows are rendered (ScrollView, not a virtualized list) so every row is measured — meant for short
// lists. Gesture callbacks run on the JS thread (runOnJS) so layout math stays plain JS. Needs
// GestureHandlerRootView at the root. `onReorder(keys, items)` receives the new key order and the reordered items.

// Pure: move the item at `from` to index `to`; returns a new array (same ref when nothing moves).
export const moveItem = (list, from, to) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
};

// Pure: index the dragged row would land on given its translation (dragged centre vs. row spans).
export const targetIndex = (heights, from, dy) => {
  const tops = [];
  let acc = 0;
  heights.forEach((h) => {
    tops.push(acc);
    acc += h;
  });
  const center = tops[from] + heights[from] / 2 + dy;
  if (center < 0) return 0;
  if (center >= acc) return heights.length - 1;
  let to = from;
  heights.forEach((h, i) => {
    if (center >= tops[i] && center < tops[i] + h) to = i;
  });
  return to;
};

// Edge auto-scroll: while the FINGER is within EDGE px of the viewport top/bottom (and has moved ARM px since the
// lift, so lifting a row that already sits near an edge does not run away) the list scrolls every TICK ms, up to
// MAX_STEP px per 16ms (linear in how deep into the zone the finger is; full speed past it), scaled by the real
// elapsed time so a busy JS thread does not slow it.
const EDGE = 72;
const MAX_STEP = 14;
const TICK = 16;
const ARM = 8;

// Pure: signed scroll step (px) for a finger at viewport y; never moves past [0, maxPos] and never pulls back
// from an overscrolled position (iOS bounce / refresh spinner).
export const autoScrollStep = (fingerY, viewH, pos, maxPos, scale = 1) => {
  let d = 0;
  if (fingerY < EDGE) d = -MAX_STEP * Math.min(1, (EDGE - fingerY) / EDGE);
  else if (fingerY > viewH - EDGE) d = MAX_STEP * Math.min(1, (fingerY - (viewH - EDGE)) / EDGE);
  d *= scale;
  if (d < 0) return pos <= 0 ? 0 : Math.max(d, -pos);
  if (d > 0) return pos >= maxPos ? 0 : Math.min(d, maxPos - pos);
  return 0;
};

function Row({ index, base, shift, onMeasure, onLift, onMove, onDrop, onCancel, children }) {
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);
  const sh = useSharedValue(0); // drag displacement of a non-dragged row (animated)
  const bs = useSharedValue(base); // slot base: display slot top - mounted slot top (instant, like the native layout)
  const prevIndex = useRef(index);
  const baseRef = useRef(base);
  // Native views never change order (see SortableList): a row's slot is only ever a transform. Displaced
  // rows glide to their displacement while the drag is on; when the drop reorders the data the base changes by
  // exactly the displacement it had, so both are set without animation (visually continuous). The base is
  // never animated: the native layout it compensates moves instantly too.
  useLayoutEffect(() => {
    const moved = prevIndex.current !== index;
    prevIndex.current = index;
    baseRef.current = base;
    bs.value = base;
    sh.value = moved ? shift : withTiming(shift, SNAP);
  }, [base, shift, index]);
  // zIndex follows `lift` (set at lift, back to 0 only when the settle animation ends) so no commit flips it.
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value + sh.value + bs.value }, { scale: 1 + 0.03 * lift.value }],
    zIndex: lift.value > 0 ? 10 : 0,
    shadowColor: '#000',
    shadowOpacity: 0.25 * lift.value,
    shadowRadius: 10 * lift.value,
    shadowOffset: { width: 0, height: 4 * lift.value },
    elevation: 8 * lift.value,
  }));
  // The gesture is built ONCE and reads the latest props through a ref: rebuilding it on every render
  // (a render happens whenever the drop target changes) can make RNGH cancel it mid-drag.
  const latest = useRef({});
  latest.current = { index, onLift, onMove, onDrop, onCancel };
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(300)
        .onStart((e) => {
          liftHaptic();
          lift.value = withTiming(1, SNAP);
          latest.current.onLift(
            latest.current.index,
            (v) => {
              ty.value = v;
            },
            e?.y ?? 0,
          );
        })
        .onUpdate((e) => {
          // `extra` = how far the list auto-scrolled since the lift, so the row stays under the finger.
          const extra = latest.current.onMove(latest.current.index, e.translationY);
          ty.value = e.translationY + extra;
        })
        .onFinalize((e, success) => {
          if (!success) {
            // Cancelled/failed after (or without) activation: restore everything, no reorder.
            latest.current.onCancel();
            ty.value = withTiming(0, SNAP);
            lift.value = withTiming(0, SNAP);
            return;
          }
          // The row's slot moves by `delta`; shift the slot base and counter-offset the translation by the
          // same amount so the row stays under the finger (auto-scroll included), then snap to rest. Transforms only.
          const base0 = baseRef.current;
          const { delta, extra } = latest.current.onDrop(latest.current.index, e.translationY);
          bs.value = base0 + delta;
          ty.value = e.translationY + extra - delta;
          ty.value = withTiming(0, SNAP);
          lift.value = withTiming(0, SNAP);
          dropHaptic();
        }),
    [],
  );
  return (
    <GestureDetector gesture={pan}>
      <Animated.View onLayout={(e) => onMeasure(e.nativeEvent.layout.height)} style={style}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export default function SortableList({ data, renderItem, keyExtractor, onReorder, ...rest }) {
  const heights = useRef({}); // by key, so a measurement survives reordering
  const mounted = useRef(null); // key-stable native order: the order rows first rendered (the saved order)
  const [drag, setDrag] = useState(null); // { from, to } — display indices
  const [, bump] = useState(0);
  const scrollRef = useRef(null);
  const view = useRef({ h: 0, content: 0, innerY: 0, y: 0 }); // viewport h, content h, list offset in content, idle scroll y
  const auto = useRef({ timer: null, from: -1, dy: 0, pos: 0, pos0: 0, setTy: null, touchY: 0, last: 0 });
  const calc = useRef(null); // latest render's closure, for the auto-scroll timer
  const keys = data.map(keyExtractor);
  const hs = () => keys.map((k) => heights.current[k] ?? 0);

  // Keep native order stable across drops/refetches: drop removed keys, append new ones.
  const keySet = new Set(keys);
  mounted.current = [...(mounted.current ?? []).filter((k) => keySet.has(k)), ...keys.filter((k) => !(mounted.current ?? []).includes(k))];
  const order = mounted.current;

  const tops = (list) => {
    const t = {};
    let acc = 0;
    list.forEach((k) => {
      t[k] = acc;
      acc += heights.current[k] ?? 0;
    });
    return t;
  };
  const displayTop = tops(keys);
  const mountedTop = tops(order);

  const shiftFor = (i) => {
    if (!drag) return 0;
    const { from, to } = drag;
    const hf = heights.current[keys[from]] ?? 0;
    if (i > from && i <= to) return -hf;
    if (i < from && i >= to) return hf;
    return 0;
  };

  const stopAuto = () => {
    clearInterval(auto.current.timer);
    auto.current.timer = null;
  };
  useEffect(() => stopAuto, []);

  const scrolled = () => auto.current.pos - auto.current.pos0;
  calc.current = () => {
    const a = auto.current;
    const h = hs();
    const now = Date.now();
    const scale = Math.min(4, (now - a.last) / TICK);
    a.last = now;
    if (Math.abs(a.dy) < ARM) return;
    // finger position in the viewport: row top (content) + where the finger grabbed the row + drag, minus scroll
    const finger = view.current.innerY + h.slice(0, a.from).reduce((x, y) => x + y, 0) + a.touchY + a.dy - a.pos0;
    const d = autoScrollStep(finger, view.current.h, a.pos, view.current.content - view.current.h, scale);
    if (!d) return;
    a.pos += d;
    scrollRef.current?.scrollTo?.({ y: a.pos, animated: false });
    a.setTy?.(a.dy + scrolled());
    const to = targetIndex(h, a.from, a.dy + scrolled());
    setDrag((cur) => (cur && cur.from === a.from && cur.to !== to ? { from: a.from, to } : cur));
  };

  const lift = (i, setTy, touchY) => {
    const a = auto.current;
    stopAuto();
    const y0 = Math.max(0, view.current.y);
    Object.assign(a, { from: i, dy: 0, pos: y0, pos0: y0, setTy, touchY, last: Date.now() });
    a.timer = setInterval(() => calc.current(), TICK);
    setDrag({ from: i, to: i });
  };

  const drop = (from, dy) => {
    const extra = scrolled();
    stopAuto();
    const to = targetIndex(hs(), from, dy + extra);
    setDrag(null);
    if (to === from) return { delta: 0, extra };
    const h = hs();
    // slot delta of the moved row after the reorder
    const delta = to > from ? h.slice(from + 1, to + 1).reduce((a, b) => a + b, 0) : -h.slice(to, from).reduce((a, b) => a + b, 0);
    // keys are STRINGS-or-whatever keyExtractor returns (React keys) — hand back the items too so the
    // caller never has to map keys back to typed ids (a numeric id vs '2' mismatch broke vault order).
    onReorder(moveItem(keys, from, to), moveItem(data, from, to));
    return { delta, extra };
  };

  return (
    <ScrollView
      {...rest}
      ref={scrollRef}
      scrollEnabled={!drag}
      scrollEventThrottle={16}
      onScroll={(e) => {
        view.current.y = e.nativeEvent.contentOffset.y;
        rest.onScroll?.(e);
      }}
      onScrollEndDrag={(e) => {
        view.current.y = e.nativeEvent.contentOffset.y;
        rest.onScrollEndDrag?.(e);
      }}
      onMomentumScrollEnd={(e) => {
        view.current.y = e.nativeEvent.contentOffset.y;
        rest.onMomentumScrollEnd?.(e);
      }}
      onLayout={(e) => {
        view.current.h = e.nativeEvent.layout.height;
        rest.onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        view.current.content = h;
        rest.onContentSizeChange?.(w, h);
      }}
    >
      <View onLayout={(e) => (view.current.innerY = e.nativeEvent.layout.y)}>
        {order.map((key) => {
          const index = keys.indexOf(key);
          return (
            <Row
              key={key}
              index={index}
              base={displayTop[key] - mountedTop[key]}
              shift={shiftFor(index)}
              onMeasure={(height) => {
                if (heights.current[key] !== height) {
                  const first = heights.current[key] === undefined;
                  heights.current[key] = height;
                  if (!first || order.some((k, i) => k !== keys[i])) bump((n) => n + 1);
                }
              }}
              onLift={lift}
              onMove={(i, dy) => {
                auto.current.dy = dy;
                const to = targetIndex(hs(), i, dy + scrolled());
                setDrag((d) => (d && d.from === i && d.to === to ? d : { from: i, to }));
                return scrolled();
              }}
              onDrop={drop}
              onCancel={() => {
                stopAuto();
                setDrag(null);
              }}
            >
              {renderItem({ item: data[index], index })}
            </Row>
          );
        })}
      </View>
    </ScrollView>
  );
}
