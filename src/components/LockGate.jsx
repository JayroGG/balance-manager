import { useSelector } from 'react-redux';
import { useAppCover } from '../hooks/useAppCover';
import { PrivacyCover } from './PrivacyCover';
import Lock from '../screens/Lock';

// While locked the Lock screen replaces the app: children are not even mounted. While the app is inactive/in the
// background an opaque cover hides everything, the lock screen too (password mode shows the email).
export function LockGate({ children }) {
  const locked = useSelector((s) => s.lock.locked);
  const covered = useAppCover();
  return (
    <>
      {locked ? <Lock /> : children}
      {covered ? <PrivacyCover /> : null}
    </>
  );
}
