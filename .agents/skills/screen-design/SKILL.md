---
name: screen-design
description: Template and checklist for building or modifying mobile screens in the Bubble app. Use when the user provides a Figma screenshot or describes a screen to build/update. Ensures layout, colors, interactivity, and data flow are captured completely before coding.
---

# Screen Design Template

When the user asks to build or modify a screen, gather all the details below before writing code. If anything is missing, ask. This prevents rework.

## How to Use

1. The user provides a Figma screenshot and/or description
2. Fill in each section of the template from what they provide
3. Ask about any gaps before coding
4. Reference `mobile/src/styles/theme.ts` for all color/spacing/typography tokens
5. Build the screen following the completed template

## Template

Copy and fill in this template for each screen:

```
SCREEN: [Screen Name]
FILE: mobile/src/screens/[path]/[ScreenName].tsx

## 1. Layout Structure
- [ ] Header: [fixed/scrollable] — [describe: back button, title, right action]
- [ ] Separator: [progress bar / border / none]
- [ ] Body: [scrollable / static] — [describe content sections]
- [ ] Footer: [fixed / floating-transparent / none] — [describe: buttons, tabs]
- [ ] Safe area handling: [yes/no, which edges]

## 2. Components & Interactions
For each interactive element:
- [ ] [Element name]: [tap action] — [what happens: navigate, modal, state change]
- [ ] [Element name]: [tap action] — [what happens]
(List all tappable elements — buttons, cards, toggles, inputs, pickers)

## 3. Visual Spec
- Background: [theme token, e.g. Colors.background.primary]
- Header style: [font size, weight, color, alignment]
- Button variant: [primary/secondary/ghost/destructive + theme tokens]
- Cancel/dismiss color: [e.g. Colors.status.error for red]
- Selection states: [describe selected vs unselected appearance]
- Grid/list layout: [columns, gap, item shape, aspect ratio, corner radius]
- Progress bar: [height, colors, position]

## 4. Data & State
- Local state: [list all useState hooks needed]
- API calls: [endpoint, method, auth required, request/response shape]
- Navigation params: [what's passed in/out]
- Validation: [what's required before proceeding]

## 5. Edge Cases
- Empty state: [what shows when no data]
- Loading state: [spinner, skeleton, disabled buttons]
- Error handling: [alerts, inline errors, retry]
- Keyboard: [avoiding behavior, dismiss on tap]
```

## Checklist Before Coding

- [ ] All interactive elements have defined behavior (no orphan buttons)
- [ ] Colors reference theme tokens, not hardcoded hex values
- [ ] Layout sections (header, body, footer) have clear fixed/scroll/float behavior
- [ ] Data flow is defined: what state exists, what API calls happen, what's validated
- [ ] Selected/active states are described for any selectable items

## Project-Specific Rules

- **Always import from theme**: `import { Colors, Spacing, Radius, Typography, ... } from '../../styles/theme'`
- **Cancel buttons**: Use `Colors.status.error` (red) for cancel/destructive text
- **Primary action buttons**: Use `Colors.text.secondary` (dark charcoal pill) or gradient per design
- **Progress bars**: 2px height, `Colors.border.light` inactive, `Colors.brand.primary` active
- **Floating footers**: `position: 'absolute'`, no background, no border — content scrolls behind
- **Headers**: No bottom border when progress bar serves as separator
- **Images in grids**: Square (1:1), `borderRadius: Radius.md` (12px), `resizeMode="cover"`
- **Safe areas**: Use `SafeAreaView` with `paddingTop` for Android StatusBar

## Example: Filled Template

```
SCREEN: Create Bubble - Step 1 (Category Picker)
FILE: mobile/src/screens/main/CreateBubbleScreen.tsx

## 1. Layout Structure
- [x] Header: fixed — back arrow (left), "Create a Bubble" title (center), Cancel (right, red)
- [x] Separator: 2px progress bar (5 segments, fills based on step)
- [x] Body: scrollable — prompt text + 3-column image grid
- [x] Footer: floating-transparent — dark pill "Next" button, centered

## 2. Components & Interactions
- [x] Back arrow: tap → go to previous step or goBack()
- [x] Cancel: tap → navigation.goBack() (exits wizard)
- [x] Category image: tap → toggle selection (only one at a time)
- [x] Next button: tap → advance to step 2 (disabled if no category selected)

## 3. Visual Spec
- Background: Colors.background.primary (#FFFFFF)
- Header: Typography.sizes.md, bold, Colors.text.primary, centered
- Cancel text: Typography.sizes.base, medium weight, Colors.status.error
- Next button: height 48, Radius.full, Colors.text.secondary bg, white text
- Category images: square, Radius.md corners, 8px gap
- Selected: 2.5px blue border overlay + checkmark badge, label turns blue
- Progress: 2px segments, Colors.border.light / Colors.brand.primary

## 4. Data & State
- Local state: category (string), step (number)
- No API calls on this step
- Validation: category must be selected to enable Next

## 5. Edge Cases
- No empty state (categories are hardcoded)
- Button disabled (opacity 0.5) when no category selected
```
