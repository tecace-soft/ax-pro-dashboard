# AX Pro Dashboard
A minimal Vite + React + TypeScript dashboard app to allow users to view usage of HR AX Pro Teams Chatbot.

## Requirements
- Node.js 18+ (recommended)

## Install
```bash
npm install
```

## Run (development)
```bash
npm run dev
```
Open the printed local URL in your browser.

- Login access code: `tecace`
- After logging in, you can open Settings (gear icon) or Sign out (arrow icon) in the top bar.

## Build (production)
```bash
npm run build
```

## Preview the production build
```bash
npm run preview
```

## Project structure
- `src/pages/Login.tsx`: one-field login page (accepts `tecace`).
- `src/pages/Dashboard.tsx`: placeholder dashboard with Settings modal and icon buttons.
- `src/ui/icons.tsx`: SVG icon components.
- `src/styles/theme.css`: global theme.
- `src/styles/dashboard.css`: dashboard-specific styles. 