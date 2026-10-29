import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import {
  Building2, CheckCircle2, Crosshair, LocateFixed, MapPinned, Navigation,
  RefreshCw, Save, Search, ShieldCheck,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import {
  getApiErrorMessage, getCompanyLocation, searchPlaces, updateCompanyLocation,
  type PlaceSuggestion,
} from '../services/api';

type FormState = { address: string; latitude: string; longitude: string };
const EMPTY_FORM: FormState = { address: '', latitude: '', longitude: '' };
const control = 'mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 sm:text-sm';

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function mapUrl(latitude: number, longitude: number) {
  const latDelta = 0.006;
  const lngDelta = 0.009;
  const bbox = [longitude - lngDelta, latitude - latDelta, longitude + lngDelta, latitude + latDelta].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export default function CompanyLocationScreen() {
  const { t, language } = useLanguage();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM);
  const [radius, setRadius] = useState(100);
  const [source, setSource] = useState<'env' | 'redis'>('env');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [positionReady, setPositionReady] = useState(true);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const skipSearch = useRef(true);

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const hasValidCoordinates = validCoordinates(latitude, longitude);
  const dirty = form.address.trim() !== savedForm.address.trim()
    || form.latitude !== savedForm.latitude || form.longitude !== savedForm.longitude;

  const load = async (signal?: AbortSignal) => {
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await getCompanyLocation(signal);
      const next = {
        address: result.data.address,
        latitude: String(result.data.latitude),
        longitude: String(result.data.longitude),
      };
      skipSearch.current = true;
      setForm(next); setSavedForm(next); setRadius(result.allowedRadiusMeters);
      setSource(result.data.source); setUpdatedAt(result.data.updatedAt);
      setPositionReady(true); setConfirmed(false); setSuggestions([]);
    } catch (cause) {
      if (!signal?.aborted) setError(getApiErrorMessage(cause, 'Could not load company location. Please try again.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return; }
    const query = form.address.trim();
    if (query.length < 3 || positionReady) { setSuggestions([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchPlaces(query, controller.signal)
        .then(result => { if (!controller.signal.aborted) setSuggestions(result.places.slice(0, 5)); })
        .catch(() => { if (!controller.signal.aborted) setSuggestions([]); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.address, positionReady]);

  const previewUrl = useMemo(() => hasValidCoordinates ? mapUrl(latitude, longitude) : '', [hasValidCoordinates, latitude, longitude]);
  const updatedLabel = updatedAt ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(updatedAt)) : t('Initial environment configuration');

  function selectPlace(place: PlaceSuggestion) {
    skipSearch.current = true;
    setForm({
      address: place.display || place.resolvedAddress || place.address || place.name,
      latitude: String(place.latitude), longitude: String(place.longitude),
    });
    setSuggestions([]); setPositionReady(true); setConfirmed(false); setMessage(''); setError('');
  }

  function useCurrentLocation() {
    setError(''); setMessage('');
    if (!navigator.geolocation) {
      setError('Your browser does not support location access. Enter coordinates manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setForm(value => ({
        ...value,
        latitude: position.coords.latitude.toFixed(8),
        longitude: position.coords.longitude.toFixed(8),
      }));
      setPositionReady(true); setConfirmed(false); setLocating(false);
      setMessage(`GPS position captured with approximately ${Math.round(position.coords.accuracy)} m accuracy. Review it before saving.`);
    }, () => {
      setLocating(false);
      setError('Could not access GPS. Allow location permission or enter coordinates manually.');
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (!form.address.trim()) return setError('Enter the company address.');
    if (!hasValidCoordinates) return setError('Enter valid latitude and longitude coordinates.');
    if (!positionReady) return setError('Select an address suggestion or confirm the coordinates again.');
    if (!confirmed) return setError('Confirm that the address and map position are correct before saving.');
    setSaving(true);
    try {
      const result = await updateCompanyLocation({ address: form.address.trim(), latitude, longitude });
      const next = { address: result.data.address, latitude: String(result.data.latitude), longitude: String(result.data.longitude) };
      skipSearch.current = true;
      setForm(next); setSavedForm(next); setRadius(result.allowedRadiusMeters);
      setSource(result.data.source); setUpdatedAt(result.data.updatedAt); setConfirmed(false);
      setMessage('Company location saved. New attendance check-ins use this position immediately.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not save company location. Please try again.'));
    } finally { setSaving(false); }
  }

  return <AppShell breadcrumb={['Workforce', 'Company location']}>
    <SectionHeader title="Company location" description="Set the office position used to validate employee check-in and check-out.">
      <Button variant="secondary" disabled={loading || saving} onClick={() => void load()}><RefreshCw size={16}/>{t('Reload')}</Button>
    </SectionHeader>

    {error && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{t(error)}</p>}
    {message && <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={18}/>{t(message)}</p>}

    <MotionConfig reducedMotion="user">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(480px,1.08fr)]">
        <form onSubmit={save} className="space-y-5">
          <Card className="overflow-visible p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><Building2 size={22}/></span><div><h2 className="text-lg font-semibold text-slate-950">{t('Office attendance point')}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{t('Choose a verified address and coordinate pair for attendance validation.')}</p></div></div>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${source === 'redis' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>{t(source === 'redis' ? 'Saved configuration' : 'Initial configuration')}</span>
            </div>

            <fieldset disabled={loading || saving} className="mt-6 space-y-5 disabled:opacity-60">
              <label className="relative block text-sm font-semibold text-slate-700">{t('Company address')} <span className="text-red-600">*</span>
                <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input required maxLength={500} autoComplete="off" value={form.address} onChange={event => { setForm(value => ({ ...value, address: event.target.value })); setPositionReady(false); setConfirmed(false); setMessage(''); }} className={`${control} pl-11`} placeholder={t('Type at least 3 characters to search for an address')} role="combobox" aria-expanded={suggestions.length > 0} aria-controls="company-location-suggestions" /></div>
                {(searching || (!positionReady && form.address.trim().length >= 3)) && <span className="mt-2 block text-xs font-normal text-slate-500">{t(searching ? 'Searching addresses...' : suggestions.length ? 'Select a suggestion to match the address with coordinates.' : 'No suggestions found. You can enter coordinates manually.')}</span>}
                {suggestions.length > 0 && <div id="company-location-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15">{suggestions.map(place => <button key={place.refId || `${place.latitude}-${place.longitude}`} type="button" role="option" onClick={() => selectPlace(place)} className="flex min-h-12 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-500"><MapPinned className="mt-0.5 shrink-0 text-orange-500" size={18}/><span className="min-w-0"><span className="block text-sm font-semibold text-slate-800">{place.name || place.display}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{place.resolvedAddress || place.address || place.display}</span></span></button>)}</div>}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">{t('Latitude')} <span className="text-red-600">*</span><input required type="number" min="-90" max="90" step="any" value={form.latitude} onChange={event => { setForm(value => ({ ...value, latitude: event.target.value })); setPositionReady(true); setConfirmed(false); }} className={control}/></label>
                <label className="block text-sm font-semibold text-slate-700">{t('Longitude')} <span className="text-red-600">*</span><input required type="number" min="-180" max="180" step="any" value={form.longitude} onChange={event => { setForm(value => ({ ...value, longitude: event.target.value })); setPositionReady(true); setConfirmed(false); }} className={control}/></label>
              </div>

              <Button type="button" variant="secondary" disabled={locating} onClick={useCurrentLocation}><LocateFixed size={17}/>{t(locating ? 'Getting current GPS...' : 'Use current GPS position')}</Button>
            </fieldset>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><ShieldCheck size={20}/></span><div><h2 className="font-semibold text-slate-950">{t('Verify before applying')}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{t('This change affects future employee check-ins immediately. Existing attendance records are not changed.')}</p></div></div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 transition hover:border-orange-200 hover:bg-orange-50/40"><input type="checkbox" checked={confirmed} disabled={loading || saving || !hasValidCoordinates || !positionReady} onChange={event => setConfirmed(event.target.checked)} className="mt-1 size-4 accent-orange-500"/><span>{t('I have verified that the address and coordinates point to the correct company location.')}</span></label>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500">{t('Last update')}: {updatedLabel}</p><Button type="submit" disabled={loading || saving || !dirty || !confirmed}><Save size={17}/>{t(saving ? 'Saving location...' : 'Save company location')}</Button></div>
          </Card>
        </form>

        <Card className="overflow-hidden xl:sticky xl:top-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950"><Navigation size={20} className="text-orange-500"/>{t('Location preview')}</h2><p className="mt-1 text-sm text-slate-500">{t('Review the map marker before saving the attendance point.')}</p></div>
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200"><Crosshair size={15}/>{t('Allowed radius')}: {radius} m</span>
          </div>
          <div className="relative min-h-[420px] bg-slate-100 sm:min-h-[540px]">
            {previewUrl ? <iframe key={previewUrl} title={t('Company location map')} src={previewUrl} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer" /> : <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"><MapPinned size={42} className="text-slate-300"/><p className="mt-4 font-semibold text-slate-700">{t('Enter valid coordinates to preview the map.')}</p></div>}
            {loading && <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-orange-500" size={28}/><p className="mt-3 text-sm font-medium text-slate-600">{t('Loading company location...')}</p></div></div>}
          </div>
          <div className="grid gap-3 border-t border-slate-100 bg-white p-5 sm:grid-cols-2 sm:px-6"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{t('Latitude')}</p><p className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900">{hasValidCoordinates ? latitude.toFixed(8) : '—'}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{t('Longitude')}</p><p className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900">{hasValidCoordinates ? longitude.toFixed(8) : '—'}</p></div></div>
        </Card>
      </motion.div>
    </MotionConfig>
  </AppShell>;
}
