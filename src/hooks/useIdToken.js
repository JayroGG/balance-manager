import { useSelector } from 'react-redux';
import { selectToken } from '../reducers/auth';

// Thin read of the auth seam. Screens that need the token use this; they never touch storage. (ADR-001)
export const useIdToken = () => useSelector(selectToken);
