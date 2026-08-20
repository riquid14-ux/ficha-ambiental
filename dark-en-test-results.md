# Dark Mode & EN Translation Test Results

## Landing Page (ambientfich.co)
- PASS: Dark background, white text, logo visible, "Iniciar sessão" button green
- PASS: Minimal and confidential design

## Issues to investigate:
1. Internal pages: need to verify dark mode works after login (filter invert(1) on #root)
2. EN translation: need to verify all pages show EN when language is toggled
3. The user reports titles still black in dark mode - this suggests the filter isn't being applied
4. Possible issue: the ThemeContext toggleTheme function may not be persisting the dark class correctly

## Root cause analysis:
- The filter is applied via JavaScript in ThemeContext.tsx when dark mode is toggled
- It targets document.getElementById('root') and applies filter: invert(1) hue-rotate(180deg)
- The sidebar is re-inverted to stay dark
- Images/iframes are re-inverted to look normal
- If the user sees black titles, it means the filter ISN'T being applied to the content area
