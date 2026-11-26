import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
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

function Row({ index, active, shift, onMeasure, onLift, onMove, onDrop, onCancel, children }) {
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);
  const sh = useSharedValue(0); // displacement of a non-dragged row while others are dragged
  const prevIndex = useRef(index);
  // Displaced rows glide to their offset while the drag is on. When the drop reorders the data the
  // layout itself has already moved by that offset, so it snaps to 0 in the same frame instead.
  useLayoutEffect(() => {
    const moved = prevIndex.current !== index;
    prevIndex.current = index;
    sh.value = moved ? shift : withTiming(shift, SNAP);
  }, [shift, index]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value + sh.value }, { scale: 1 + 0.03 * lift.value }],
    zIndex: active ? 10 : 0,
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
        .onStart(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          lift.value = withTiming(1, SNAP);
          latest.current.onLift(latest.current.index);
        })
        .onUpdate((e) => {
          ty.value = e.translationY;
          latest.current.onMove(latest.current.index, e.translationY);
        })
        .onFinalize((e, success) => {
          if (!success) {
            // Cancelled/failed after (or without) activation: restore everything, no reorder.
            latest.current.onCancel();
            ty.value = withTiming(0, SNAP);
            lift.value = withTiming(0, SNAP);
            return;
          }
          // The row's layout slot changes by `delta` when the data reorders; offset the translation by it
          // so the row stays under the finger, then snap to rest.
          const delta = latest.current.onDrop(latest.current.index, e.translationY);
          ty.value = e.translationY - delta;
          ty.value = withTiming(0, SNAP);
          lift.value = withTiming(0, SNAP);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
  const [drag, setDrag] = useState(null); // { from, to }
  const keys = data.map(keyExtractor);
  const hs = () => keys.map((k) => heights.current[k] ?? 0);

  const shiftFor = (i) => {
    if (!drag) return 0;
    const { from, to } = drag;
    const hf = heights.current[keys[from]] ?? 0;
    if (i > from && i <= to) return -hf;
    if (i < from && i >= to) return hf;
    return 0;
  };

  const drop = (from, dy) => {
    const to = targetIndex(hs(), from, dy);
    setDrag(null);
    if (to === from) return 0;
    const h = hs();
    // slot delta of the moved row after the reorder
    const delta = to > from ? h.slice(from + 1, to + 1).reduce((a, b) => a + b, 0) : -h.slice(to, from).reduce((a, b) => a + b, 0);
    // keys are STRINGS-or-whatever keyExtractor returns (React keys) — hand back the items too so the
    // caller never has to map keys back to typed ids (a numeric id vs '2' mismatch broke vault order).
    onReorder(moveItem(keys, from, to), moveItem(data, from, to));
    return delta;
  };

  return (
    <ScrollView {...rest} scrollEnabled={!drag}>
      <View>
        {data.map((item, index) => (
          <Row
            key={keys[index]}
            index={index}
            active={drag?.from === index}
            shift={shiftFor(index)}
            onMeasure={(height) => {
              heights.current[keys[index]] = height;
            }}
            onLift={(i) => setDrag({ from: i, to: i })}
            onMove={(i, dy) => {
              const to = targetIndex(hs(), i, dy);
              setDrag((d) => (d && d.from === i && d.to === to ? d : { from: i, to }));
            }}
            onDrop={drop}
            onCancel={() => setDrag(null)}
          >
            {renderItem({ item, index })}
          </Row>
        ))}
      </View>
    </ScrollView>
  );
}
