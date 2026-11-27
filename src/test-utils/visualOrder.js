// SortableList keeps native rows in mount order and positions them with translateY, so the render-tree
// order is NOT the visual order. Sort the row nodes by (mounted slot * height + translateY).
// Requires the reanimated mock's useAnimatedStyle to be lazy (re-evaluated on read) — see lazyStyle.
export const lazyStyle = (f) => ({
  get transform() {
    return f().transform;
  },
});

// Nearest ancestor of a rendered row node that carries the given prop.
export const rowView = (n, prop) => {
  let c = n.parent;
  while (c && !c.props?.[prop]) c = c.parent;
  return c;
};

export const visualOrder = (nodes, rowHeight = 100) =>
  nodes
    .map((n, i) => ({ n, y: i * rowHeight + (rowView(n, 'onLayout').props.style?.transform?.[0]?.translateY ?? 0) }))
    .sort((a, b) => a.y - b.y)
    .map(({ n }) => n);
