import { useState, type FormEvent } from 'react';
import { Button } from './ui';
import { Input } from './ui/input';
import { useLanguage } from '../context/LanguageContext';
import { getApiErrorMessage, updateMyContact, type EmployeeProfile } from '../services/api';

export function OwnContactEditor({ employee, onSaved }: { employee: EmployeeProfile; onSaved: (updated: EmployeeProfile) => void }) {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(employee.phone || '');
  const [address, setAddress] = useState(employee.address || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const dirty = phone.trim() !== (employee.phone || '') || address.trim() !== (employee.address || '');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true); setError('');
    try {
      const changes: { phone?: string; address?: string } = {};
      if (phone.trim() !== (employee.phone || '')) changes.phone = phone.trim();
      if (address.trim() !== (employee.address || '')) changes.address = address.trim();
      const updated = await updateMyContact(changes);
      setEditing(false); setSuccess(true); onSaved(updated);
    } catch (cause) {
      setError(getApiErrorMessage(cause, tr('Không lưu được thông tin. Vui lòng thử lại.', 'Could not save your information. Please retry.')));
    } finally { setSaving(false); }
  }
  if (!editing) return <div className="mt-5">
    {success && <p role="status" className="mb-3 text-sm text-emerald-700">{tr('Đã cập nhật thông tin liên hệ.', 'Contact information updated.')}</p>}
    <Button variant="secondary" onClick={() => { setPhone(employee.phone || ''); setAddress(employee.address || ''); setError(''); setSuccess(false); setEditing(true); }}>{tr('Sửa thông tin liên hệ', 'Edit contact information')}</Button>
  </div>;
  return <form onSubmit={save} aria-busy={saving} className="mt-5 max-w-2xl space-y-4 rounded-xl border border-slate-200 p-5">
    <div><h3 className="font-semibold text-slate-900">{tr('Thông tin liên hệ cá nhân', 'Personal contact information')}</h3><p className="mt-1 text-sm text-slate-600">{tr('Bạn có thể sửa số điện thoại và địa chỉ. Để đổi thông tin công việc, vui lòng liên hệ HR.', 'You may edit your phone and address. Contact HR to change employment information.')}</p></div>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div><label htmlFor="own-contact-phone" className="mb-2 block text-sm font-medium text-slate-700">{tr('Số điện thoại', 'Phone number')}</label><Input autoFocus id="own-contact-phone" type="tel" autoComplete="tel" required maxLength={30} value={phone} disabled={saving} onChange={event => setPhone(event.target.value)} /><p className="mt-1 text-xs text-slate-600">{tr('Nhập 8–15 chữ số; có thể dùng mã quốc gia.', 'Enter 8–15 digits; a country code is allowed.')}</p></div>
    <div><label htmlFor="own-contact-address" className="mb-2 block text-sm font-medium text-slate-700">{tr('Địa chỉ hiện tại', 'Current address')}</label><Input id="own-contact-address" autoComplete="street-address" required maxLength={2000} value={address} disabled={saving} onChange={event => setAddress(event.target.value)} /><p className="mt-1 text-xs text-slate-600">{tr('Nhập địa chỉ đầy đủ để hệ thống tính lại khoảng cách tới công ty.', 'Enter a complete address so the system can recalculate the distance to the company.')}</p></div>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving || !dirty}>{saving ? tr('Đang lưu…', 'Saving…') : tr('Lưu thay đổi', 'Save changes')}</Button><Button type="button" variant="secondary" disabled={saving} onClick={() => { if (!dirty || window.confirm(tr('Bỏ những thay đổi chưa lưu?', 'Discard unsaved changes?'))) { setEditing(false); setError(''); } }}>{tr('Hủy', 'Cancel')}</Button></div>
  </form>;
}
