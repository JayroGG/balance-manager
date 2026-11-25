// Append the non-empty entries of `params` to `path` as a query string. `undefined`, `null` and ''
// are dropped, so callers can pass optional filters straight through. (ADR-021)
export const withQuery = (path, params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  });
  const str = qs.toString();
  return str ? `${path}?${str}` : path;
};
