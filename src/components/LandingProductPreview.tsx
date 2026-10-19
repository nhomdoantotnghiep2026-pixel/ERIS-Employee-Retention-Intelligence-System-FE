import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, ShieldCheck, UserCog, UsersRound } from 'lucide-react';

const workspaces = [
  {
    id: 'hr', label: 'HR', title: 'Tổng quan nhân sự và giữ chân',
    description: 'Theo dõi nhân viên, xem xét rủi ro và truy cập các công cụ nhân sự.',
    image: '/product-previews/hr-dashboard.png', width: 2557, height: 1195, icon: UsersRound,
    alt: 'Dashboard HR của ERIS: tổng quan rủi ro, truy cập nhanh, nhân viên cần quan tâm và tín hiệu theo phòng ban.',
  },
  {
    id: 'admin', label: 'System Admin', title: 'Quản trị hệ thống',
    description: 'Quản lý tài khoản, phân quyền, cấu hình và nhật ký hoạt động.',
    image: '/product-previews/admin-dashboard.png', width: 2553, height: 1230, icon: UserCog,
    alt: 'Dashboard System Administration của ERIS: bốn tài khoản, bốn vai trò, trạng thái dịch vụ và hoạt động hệ thống.',
  },
  {
    id: 'employee', label: 'Employee / ESS', title: 'Không gian của nhân viên',
    description: 'Xem hồ sơ, chấm công, gửi yêu cầu, tra cứu phiếu lương và trả lời khảo sát.',
    image: '/product-previews/employee-dashboard.png', width: 2557, height: 1230, icon: ShieldCheck,
    alt: 'Dashboard Employee Self Service của ERIS: hồ sơ, chấm công, yêu cầu, phiếu lương, đánh giá và khảo sát.',
  },
];

export function LandingProductPreview() {
  const [selected, setSelected] = useState(0);
  const active = workspaces[selected];
  return (
    <motion.section
      aria-label="Khám phá giao diện ERIS theo vai trò"
      initial={{ opacity: 0, y: 60, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 105, damping: 22, delay: 0.48 }}
      className="relative z-10 mx-auto mt-12 w-full max-w-6xl pb-8 sm:mt-16 sm:pb-10 lg:mt-20"
    >
      <div className="overflow-hidden rounded-2xl border border-white bg-white shadow-[0_28px_80px_rgba(124,45,18,0.15)] ring-1 ring-slate-200/60 sm:rounded-[28px] sm:border-[6px]">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-600">Không gian {active.label}</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900 sm:text-base">{active.title}</h2>
          </div>
          <a href={active.image} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-orange-300 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:self-auto" aria-label={`Xem ảnh đầy đủ: ${active.title} (mở tab mới)`}>
            Xem ảnh đầy đủ <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="relative aspect-[2.075/1] overflow-hidden bg-[#f4f3f9]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={active.id}
              src={active.image}
              alt={active.alt}
              width={active.width}
              height={active.height}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="absolute inset-0 h-full w-full object-contain"
              decoding="async"
            />
          </AnimatePresence>
        </div>
        <p aria-live="polite" aria-atomic="true" className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5 sm:text-sm">{active.description}</p>
      </div>

      <div role="group" aria-label="Chọn màn hình để xem" className="mx-auto mt-4 grid max-w-4xl grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
        {workspaces.map((workspace, index) => {
          const Icon = workspace.icon;
          const isSelected = index === selected;
          return <button key={workspace.id} type="button" aria-pressed={isSelected} onClick={() => setSelected(index)} className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:flex-row sm:gap-3 sm:px-4 sm:text-left ${isSelected ? 'border-orange-300 bg-white text-orange-700 shadow-sm' : 'border-white/80 bg-white/75 text-slate-600 hover:border-orange-200 hover:bg-white'}`}>
            <Icon size={20} className="shrink-0" />
            <span className="text-[11px] font-bold sm:text-sm">{workspace.label}</span>
          </button>;
        })}
      </div>
    </motion.section>
  );
}
