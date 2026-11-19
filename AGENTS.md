# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

This is a standalone frontend repository. Install with `npm ci`, then start with `npm run dev`. Use the Local URL printed by Vite; port 5173 may move when busy. Do not assume a development server is already running.

Run `npm test`, `npm run typecheck` and `npm run build` before committing. Keep backend services, SQL, migrations and credentials outside this repository. The four demo login actors must remain unchanged.

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Mandatory UI/UX Design Rules

Apply these rules to every future UI implementation and refactor:

For any request to create, redesign, or review ERIS screens or components, use the project skill at `.agents/skills/ui-ux-pro-max/SKILL.md` when it is installed. Read its workflow and use its design-system search for a React + Tailwind SaaS dashboard before choosing layout, typography, colors, interaction states, and responsive behavior. Treat the ERIS rules below and the user's current request as the project-specific constraints if a generated recommendation differs. Review the finished UI for accessibility, responsive layout, readable contrast, and consistent components. If the skill is missing, say so and follow the rules below; do not claim its recommendations were applied.

1. **Design style:** Use a Modern Minimalist SaaS visual language inspired by Linear, Vercel, and Notion.
2. **Preferred component system:** Always prefer `shadcn/ui` components with Tailwind CSS. Do not hand-write raw CSS for buttons or form controls.
3. **Form layout:** Never stretch create or edit forms across the full viewport width. Place them in a Dialog (modal), Sheet (side drawer), or constrain them to `max-w-2xl`.
4. **Typography and color:** Use Inter or Plus Jakarta Sans. Descriptive text must use at least `text-slate-600`; do not use low-contrast light gray text. Use `rounded-md` consistently for buttons and inputs.
5. **Minimal actions:** Show at most one or two primary actions on each card or data row. Move secondary actions into a Dropdown Menu (`...`).
6. **Interaction behavior:** Every popover, dropdown, menu, dialog, and sheet must have intentional motion (normally 150–250 ms), visible hover/focus/pressed states, keyboard support, and predictable dismissal. Popovers and dropdowns must close on outside click and `Escape`; dialogs must close via an explicit control and `Escape`, and may close on backdrop click only when no unsaved input can be lost. Verify opening, closing, focus, overflow, and responsive placement before handing off UI work.
