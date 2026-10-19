import { motion } from 'motion/react';

const screens = [
  {
    id: 'admin', label: 'System Admin',
    image: '/product-previews/admin-dashboard.png', width: 2553, height: 1230,
    alt: 'Giao diện quản trị ERIS: tài khoản, phân quyền và trạng thái hệ thống.',
    position: 'left-[-3%] top-[8%] z-10 w-[72%] sm:left-0 sm:w-[66%]',
    folded: { opacity: 0, x: '24%', y: 65, rotate: 0, scale: 0.94 },
    spread: { opacity: 1, x: '0%', y: 0, rotate: -11, scale: 1 },
    hover: { y: -14, rotate: -9, zIndex: 40 },
    delay: 0.12,
  },
  {
    id: 'employee', label: 'Employee / ESS',
    image: '/product-previews/employee-dashboard.png', width: 2557, height: 1230,
    alt: 'Giao diện nhân viên ERIS: hồ sơ, chấm công, yêu cầu, phiếu lương và khảo sát.',
    position: 'right-[-3%] top-[8%] z-20 w-[72%] sm:right-0 sm:w-[66%]',
    folded: { opacity: 0, x: '-24%', y: 65, rotate: 0, scale: 0.94 },
    spread: { opacity: 1, x: '0%', y: 0, rotate: 11, scale: 1 },
    hover: { y: -14, rotate: 9, zIndex: 40 },
    delay: 0.2,
  },
  {
    id: 'hr', label: 'HR',
    image: '/product-previews/hr-dashboard.png', width: 2557, height: 1195,
    alt: 'Dashboard HR của ERIS: tổng quan nhân viên, truy cập nhanh và tín hiệu theo phòng ban.',
    position: 'left-1/2 top-[30%] z-30 w-[94%] -translate-x-1/2 sm:w-[84%] lg:w-[78%]',
    folded: { opacity: 0, x: '0%', y: 95, rotate: 0, scale: 0.92 },
    spread: { opacity: 1, x: '0%', y: 0, rotate: 0, scale: 1 },
    hover: { y: -10, rotate: 0, zIndex: 40 },
    delay: 0.3,
  },
];

export function LandingProductPreview() {
  return (
    <motion.section
      aria-label="Ba giao diện HR, quản trị và nhân viên của ERIS"
      initial="folded"
      whileInView="spread"
      viewport={{ once: true, amount: 0.2 }}
      className="relative z-10 mx-auto mt-16 aspect-[1.45/1] w-full max-w-[1320px] sm:mt-20 sm:aspect-[1.65/1] lg:mt-24 lg:aspect-[1.85/1]"
    >
      {screens.map(screen => (
        <motion.a
          key={screen.id}
          href={screen.image}
          target="_blank"
          rel="noreferrer"
          aria-label={`Xem giao diện ${screen.label} đầy đủ (mở tab mới)`}
          variants={{ folded: screen.folded, spread: screen.spread }}
          transition={{ type: 'spring', stiffness: 85, damping: 22, delay: screen.delay }}
          whileHover={{ ...screen.hover, transition: { type: 'spring', stiffness: 180, damping: 24, delay: 0 } }}
          whileFocus={{ ...screen.hover, transition: { duration: 0.2, delay: 0 } }}
          className={`absolute block origin-[50%_90%] overflow-hidden rounded-xl border-[3px] border-white bg-white shadow-[0_22px_65px_rgba(71,52,42,0.18)] ring-1 ring-slate-200/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 sm:rounded-[22px] sm:border-[5px] ${screen.position}`}
        >
          <img src={screen.image} alt={screen.alt} width={screen.width} height={screen.height} className="block h-auto w-full" decoding="async" />
        </motion.a>
      ))}
    </motion.section>
  );
}
