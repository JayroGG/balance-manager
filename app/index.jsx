import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { selectIsAuthed } from '../src/reducers/auth';

// Boot redirect: bypass/has-token → tabs; otherwise the (disabled) auth flow. (ADR-001/004)
export default function Index() {
  const authed = useSelector(selectIsAuthed);
  return <Redirect href={authed ? '/(tabs)/dashboard' : '/(auth)/login'} />;
}
