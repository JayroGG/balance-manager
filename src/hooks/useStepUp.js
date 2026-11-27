import { createElement, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { authApi } from '../services/api/auth';
import { isBiometricEnabled, promptBiometric, readStoredCreds } from '../services/storage/biometric';
import StepUpModal from '../screens/Transfers/StepUpModal';

// Fresh-identity gate for transfers (ADR-018/027). getPermit() resolves a single-use permit string, or
// null when the user cancelled. Biometric on -> device prompt -> stored password -> POST /auth/step-up;
// anything else (off, cancelled, failed, no creds) -> email+password modal. The permit is only returned
// to the caller: never put in redux/storage.
export const useStepUp = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const userEmail = useSelector((s) => s.auth?.user?.email) ?? '';
  const [modal, setModal] = useState(null); // { email } | null
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);

  // track:false keeps the password (arg) and the permit (result) out of the redux mutation state, which
  // redux-persist would otherwise write to storage.
  const fetchPermit = useCallback(
    async (password) => {
      const res = await dispatch(authApi.endpoints.stepUp.initiate({ password }, { track: false })).unwrap();
      return res?.permit ?? null;
    },
    [dispatch],
  );

  const close = (value) => {
    pending.current?.(value);
    pending.current = null;
    setModal(null);
    setError(null);
    setBusy(false);
  };

  const getPermit = useCallback(async () => {
    if (pending.current) return null; // a prompt is already open
    let email = userEmail;
    try {
      if (await isBiometricEnabled()) {
        const bio = await promptBiometric(t('transfers.stepUpPrompt'));
        if (bio.success) {
          const { creds } = await readStoredCreds();
          if (creds) {
            email = creds.email || email;
            try {
              const permit = await fetchPermit(creds.password);
              if (permit) return permit;
            } catch {
              /* stale stored password etc. -> fall through to the modal */
            }
          }
        }
      }
    } catch {
      /* biometric unavailable -> modal */
    }
    return new Promise((resolve) => {
      pending.current = resolve;
      setModal({ email });
    });
  }, [userEmail, fetchPermit, t]);

  const onSubmit = async (password) => {
    setBusy(true);
    setError(null);
    try {
      const permit = await fetchPermit(password);
      close(permit);
    } catch (e) {
      setBusy(false);
      setError(e?.status === 401 || e?.status === 400 || e?.status === 403 ? t('transfers.wrongPassword') : (e?.message ?? t('transfers.stepUpFailed')));
    }
  };

  const stepUpModal = modal
    ? createElement(StepUpModal, {
        visible: true,
        email: modal.email,
        busy,
        error,
        onSubmit,
        onCancel: () => close(null),
      })
    : null;

  return { getPermit, stepUpModal };
};
