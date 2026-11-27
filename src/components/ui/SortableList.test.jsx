import { render, screen, act } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockHaptics = { impactAsync: jest.fn(), notificationAsync: jest.fn() };
jest.mock('expo-haptics', () => ({
  impactAsync: (...a) => mockHaptics.impactAsync(...a),
  notificationAsync: (...a) => mockHaptics.notificationAsync(...a),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
const mockHandlers = {};
jest.mock('react-native-gesture-handler', () => {
  const chain = new Proxy(
    {},
    {
      get: (_, name) => (fn) => {
        if (typeof fn === 'function') mockHandlers[name] = fn;
        return chain;
      },
    },
  );
  return { Gesture: { Pan: () => chain }, GestureDetector: ({ children }) => children };
});
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v) => require('react').useRef({ value: v }).current,
    useAnimatedStyle: (f) => require('../../test-utils/visualOrder').lazyStyle(f),
    withSpring: (v) => v,
    Easing: { out: (f) => f, cubic: 1 },
    withTiming: (v) => v,
  };
});

import SortableList, { moveItem, targetIndex } from './SortableList';

const data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('SortableList', () => {
  it('pure helpers: moveItem + targetIndex', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a'], 0, 0)).toEqual(['a']);
    expect(targetIndex([50, 50, 50], 0, 60)).toBe(1);
    expect(targetIndex([50, 50, 50], 2, -500)).toBe(0);
    expect(targetIndex([50, 50, 50], 0, 500)).toBe(2);
  });

  it('renders every row via renderItem', () => {
    render(<SortableList data={data} keyExtractor={(i) => i.id} renderItem={({ item }) => <Text>{item.id}</Text>} onReorder={() => {}} />);
    ['a', 'b', 'c'].forEach((id) => expect(screen.getByText(id)).toBeTruthy());
  });

  it('cancelled gesture after lift restores scrolling and does not reorder', () => {
    const onReorder = jest.fn();
    const { UNSAFE_getByType } = render(
      <SortableList data={data} keyExtractor={(i) => i.id} renderItem={({ item }) => <Text>{item.id}</Text>} onReorder={onReorder} />,
    );
    const { ScrollView } = require('react-native');
    act(() => mockHandlers.onStart());
    expect(UNSAFE_getByType(ScrollView).props.scrollEnabled).toBe(false);
    act(() => mockHandlers.onFinalize({ translationY: 0 }, false));
    expect(UNSAFE_getByType(ScrollView).props.scrollEnabled).toBe(true);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('drop reorders data but never reorders native rows (key-stable mount order)', () => {
    const { Text } = require('react-native');
    const rows = () => screen.getAllByText(/^[abc]$/).map((n) => n.props.children);
    const { visualOrder } = require('../../test-utils/visualOrder');
    const visual = () => visualOrder(screen.getAllByText(/^[abc]$/), 50).map((n) => n.props.children);
    const Host = () => {
      const [d, setD] = require('react').useState(data);
      return (
        <SortableList data={d} keyExtractor={(i) => i.id} renderItem={({ item }) => <Text>{item.id}</Text>} onReorder={(_k, items) => setD(items)} />
      );
    };
    render(<Host />);
    expect(rows()).toEqual(['a', 'b', 'c']);
    ['a', 'b', 'c'].forEach((id) => {
      const view = require('../../test-utils/visualOrder').rowView(screen.getByText(id), 'onLayout');
      act(() => view.props.onLayout({ nativeEvent: { layout: { height: 50 } } }));
    });
    // handlers belong to the last row ('c', index 2): drag it to the top
    act(() => mockHandlers.onStart());
    act(() => mockHandlers.onFinalize({ translationY: -110 }, true));
    expect(rows()).toEqual(['a', 'b', 'c']);
    // display order changed through offsets only
    expect(visual()).toEqual(['c', 'a', 'b']);
  });

  it('a key added at the top after rows were measured pushes the others down on its first measure', () => {
    const { Text } = require('react-native');
    const { visualOrder, rowView } = require('../../test-utils/visualOrder');
    const Host = () => {
      const [d, setD] = require('react').useState(data);
      return (
        <>
          <Text testID="add" onPress={() => setD([{ id: 'n' }, ...data])}>
            add
          </Text>
          <SortableList data={d} keyExtractor={(i) => i.id} renderItem={({ item }) => <Text>{item.id}</Text>} onReorder={() => {}} />
        </>
      );
    };
    const { fireEvent } = require('@testing-library/react-native');
    render(<Host />);
    const measure = () =>
      ['a', 'b', 'c', 'n'].forEach((id) => {
        const t = screen.queryByText(id);
        if (t) act(() => rowView(t, 'onLayout').props.onLayout({ nativeEvent: { layout: { height: 50 } } }));
      });
    measure();
    fireEvent.press(screen.getByTestId('add'));
    measure();
    expect(visualOrder(screen.getAllByText(/^[abcn]$/), 50).map((n) => n.props.children)).toEqual(['n', 'a', 'b', 'c']);
  });
});
