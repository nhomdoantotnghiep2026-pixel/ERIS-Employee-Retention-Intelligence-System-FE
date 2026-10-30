import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock3, Crosshair, LogIn, LogOut, MapPin, Radio } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { ApiError, getApiErrorMessage, getAttendanceConfig, getTodayAttendance, recordAttendance, type AttendanceResult, type TodayAttendance } from '../services/api';
import { getAttendanceLocation } from '../utils/attendanceLocation';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';

function attendanceError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Attendance service is unavailable. Please contact your administrator.';
    const messages: Record<string, string> = {
      NON_WORKDAY: 'Attendance is not available for this work date.',
      ALREADY_CHECKED_IN: 'You have already checked in today. Attendance has been refreshed.',
      ALREADY_CHECKED_OUT: 'You have already checked out today. Attendance has been refreshed.',
      CHECK_IN_REQUIRED: 'Check in before checking out.',
      STALE_LOCATION: 'Your location has expired. Please try again to get a fresh GPS location.',
      ATTENDANCE_CONFLICT: 'Attendance changed. Please reload before trying again.',
    };
    const message = messages[error.code || ''];
    if (message) return message;
    if (error.status === 403) return 'Attendance requires an ACTIVE employee profile linked to your account.';
  }
  return getApiErrorMessage(error, 'Could not load attendance. Please try again.');
}

export default function MyAttendance() {
  const { t, language } = useLanguage();
  const { user } = useRole();
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { error, message: notice, setError, setMessage: setNotice } = useAutoDismissFeedback();
  const [rejection, setRejection] = useState<AttendanceResult | null>(null);
  const [maximumAccuracy, setMaximumAccuracy] = useState(100);
  const [reload, setReload] = useState(0);
  const actionRequest = useRef<AbortController | null>(null);
  const actionBusy = useRef(false);
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';

  useEffect(() => {
    const controller = new AbortController();
    setToday(null); setLoading(true); setBusy(false); setError(''); setNotice(''); setRejection(null);
    void Promise.all([getTodayAttendance(controller.signal), getAttendanceConfig(controller.signal).catch(() => null)])
      .then(([result, config]) => { if (!controller.signal.aborted) { setToday(result); if (config) setMaximumAccuracy(config.maximumAccuracyMeters); } })
      .catch(cause => { if (!controller.signal.aborted) setError(attendanceError(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); actionRequest.current?.abort(); actionBusy.current = false; };
  }, [reload, user.email]);

  async function record(action: 'check-in' | 'check-out') {
    if (actionBusy.current || loading || !today?.workday) return;
    if (today.checkedOut || (action === 'check-in' ? today.checkedIn : !today.checkedIn)) return;
    const controller = new AbortController();
    actionRequest.current = controller;
    actionBusy.current = true;
    setBusy(true); setError(''); setNotice(''); setRejection(null);
    let saved = false;
    try {
      const location = await getAttendanceLocation(controller.signal);
      const result = await recordAttendance(action, location, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.persisted) {
        setRejection(result);
        setError(result.status === 'LOW_ACCURACY'
          ? 'GPS accuracy is too low. Attendance was not saved.'
          : 'You are outside the allowed attendance radius. Attendance was not saved.');
        return;
      }
      saved = true;
      setNotice(action === 'check-in' ? 'Check-in recorded successfully.' : 'Check-out recorded successfully.');
      setToday(null);
      const updated = await getTodayAttendance(controller.signal);
      if (!controller.signal.aborted) setToday(updated);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(saved ? 'Attendance was saved, but could not be refreshed. Please reload attendance.' : attendanceError(cause));
      if (cause instanceof ApiError && cause.status === 409) {
        setToday(null);
        try {
          const updated = await getTodayAttendance(controller.signal);
          if (!controller.signal.aborted) setToday(updated);
        } catch { /* Keep actions disabled until the user reloads successfully. */ }
      }
    } finally {
      if (!controller.signal.aborted) { actionBusy.current = false; setBusy(false); }
    }
  }

  function time(value?: string | null) {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
  }
  const statusLabels: Record<string, string> = { PRESENT: 'On time', LATE: 'Late', ON_LEAVE: 'On leave', HOLIDAY: 'Holiday', ABSENT: 'Absent' };
  const status = today?.attendance?.attendanceStatus;
  const phase = today?.checkedOut ? 'Workday completed' : today?.checkedIn ? 'Currently checked in' : 'Not checked in';
  const date = today?.date && Number.isFinite(Date.parse(today.date))
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${today.date}T12:00:00+07:00`)) : '—';

  return <AppShell breadcrumb={['Self Service', 'My Attendance']}>
    <SectionHeader title={t('My Attendance')} description={t('Record working time using your current GPS location.')} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Clock3 className="text-orange-500" size={26} /><div><h2 className="font-bold text-slate-900">{date}</h2><p className="text-sm text-slate-500">{today ? t(phase) : t('Today’s attendance')}</p></div></div>
          <Button variant="secondary" disabled={loading || busy} onClick={() => setReload(value => value + 1)}>{t('Reload attendance')}</Button>
        </div>
        {loading && <p role="status" className="mt-5 text-sm text-slate-500">{t('Loading attendance...')}</p>}
        {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={20}/><div className="min-w-0"><p className="text-sm font-semibold">{t(error)}</p>
            {rejection?.status === 'LOW_ACCURACY' && <><div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-red-100"><Radio size={16} className="text-red-500"/><span>{t('GPS error radius')}: <strong className="tabular-nums">{Math.round(rejection.accuracyMeters)} m</strong></span></div>
              <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-red-100"><Crosshair size={16} className="text-emerald-600"/><span>{t('Required maximum')}: <strong className="tabular-nums">≤ {maximumAccuracy} m</strong></span></div>
            </div><p className="mt-3 text-sm leading-6 text-red-700">{t('Move near a window or outdoors, enable precise location and Wi-Fi, then try again. Desktop and device-emulation GPS may be less accurate than a phone.')}</p></>}
            {rejection?.status === 'OUTSIDE' && <><div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-red-100"><MapPin size={16} className="text-red-500"/><span>{t('Distance to office')}: <strong className="tabular-nums">{rejection.distanceMeters} m</strong></span></div>
              <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-red-100"><Crosshair size={16} className="text-emerald-600"/><span>{t('Allowed radius')}: <strong className="tabular-nums">≤ {rejection.allowedRadiusMeters} m</strong></span></div>
            </div><p className="mt-3 text-sm leading-6 text-red-700">{t('Move within the configured office radius and request a fresh GPS position before trying again.')}</p></>}
          </div></div>
        </div>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(notice)}</p>}
        {today && <>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {[[t('Check-in'), time(today.checkedInAt)], [t('Check-out'), time(today.checkedOutAt)], [t('Working minutes'), today.attendance?.workingMinutes ?? '—'], [t('Overtime minutes'), today.attendance?.overtimeMinutes ?? '—']].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 text-xl font-bold text-slate-900">{value}</dd></div>)}
          </dl>
          {status && <p className="mt-4 text-sm text-slate-600">{t('Status')}: <strong>{t(statusLabels[status] || status)}</strong></p>}
          {!today.workday && <p className="mt-4 text-sm text-slate-600">{t('Attendance is not available for this work date.')}</p>}
        </>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled={loading || busy || !today?.workday || today.checkedIn || today.checkedOut} onClick={() => void record('check-in')}><LogIn size={17} />{t('Check in')}</Button>
          <Button variant="secondary" disabled={loading || busy || !today?.workday || !today.checkedIn || today.checkedOut} onClick={() => void record('check-out')}><LogOut size={17} />{t('Check out')}</Button>
        </div>
        {busy && <p role="status" className="mt-3 text-sm text-slate-500">{t('Getting GPS location and recording attendance...')}</p>}
      </Card>
      <Card className="h-fit p-6"><MapPin size={25} className="text-orange-500" /><h2 className="mt-3 font-bold text-slate-900">{t('Attendance policy')}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{t('Allow location access when checking in or out. You must be within 100 m of the office with an accurate GPS location.')}</p><div className="mt-4 rounded-xl bg-orange-50 p-3 text-sm text-orange-900"><strong>{t('GPS requirement')}:</strong> {t('error radius')} ≤ {maximumAccuracy} m</div><p className="mt-3 text-sm leading-6 text-slate-600">{t('Attendance times and working minutes are calculated by the server in Vietnam time. Check out on the same work date after checking in.')}</p></Card>
    </div>
  </AppShell>;
}
