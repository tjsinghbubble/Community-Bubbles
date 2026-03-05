# Design Specifications

This file maps each SVG design asset to its corresponding screen/component and documents the extracted dimensions, colors, and spacing values. These values are programmatically enforced via `mobile/src/styles/design-tokens.ts`.

---

## Event Cards

**SVG Source**: `icons/Event Cards.svg`
**Used By**: `screens/main/UpcomingScreen.tsx`, event card lists across the app

| Property | Value | SVG Reference |
|---|---|---|
| Card width | 345 (full-width minus horizontal padding) | `viewBox="0 0 345 118"` |
| Card height | 118 | `height="117"` + 1px stroke |
| Card border radius | 15 (rx=14.5) | `rx="14.5"` |
| Card fill | `#FFFFFF` | `fill="white"` |
| Card stroke | `#D9D9D9`, 1px | `stroke="#D9D9D9"` |
| Image size | 98 x 98 | `width="98" height="98"` |
| Image border radius | 10 | `rx="10"` |
| Image inset from card edge | 10 | `x="10" y="10"` |
| Image placeholder fill | `#D9D9D9` | mask `fill="#D9D9D9"` |
| Label text color (bubble name) | `#969696` | `fill="#969696"` |
| Title text color | `#1E1F26` | `fill="#1E1F26"` |
| Subtitle text color (date, location) | `#4D4D4D` | `fill="#4D4D4D"` |

---

## Buttons

**SVG Source**: `icons/Buttons/` (7 files)
**Used By**: `components/BubbleButton.tsx`

### Button=Default.svg (Primary)
| Property | Value |
|---|---|
| Size | 313 x 56 |
| Border radius | 28 |
| Fill | Linear gradient: `#35A8F7` → `white` |
| Gradient coords | x1=0, y1=0.083, x2=105.144, y2=267.375 (userSpaceOnUse) |
| Text color | `#FFFFFF` |

### Button=Pressed.svg (Primary Pressed)
| Property | Value |
|---|---|
| Fill | `#37ADFF` solid |

### Button=Disabled.svg (Primary Disabled)
| Property | Value |
|---|---|
| Fill | `#969696` solid |

### Button=Outlined.svg (Outline)
| Property | Value |
|---|---|
| Stroke | `#35A8F7` |
| Fill | none |
| Border radius | 27.5 |
| Text color | `#35A8F7` |

### Button=Outlined Pressed.svg (Outline Pressed)
| Property | Value |
|---|---|
| Fill | `#35A8F7` at 15% opacity |
| Stroke | `#35A8F7` |

### Button=Outlined Disabled.svg (Outline Disabled)
| Property | Value |
|---|---|
| Stroke | `#98B4C8` |
| Fill | none |
| Text color | `#98B4C8` |

### Button=Red Outline.svg (Destructive)
| Property | Value |
|---|---|
| Stroke | `#FF3B30` |
| Fill | none |
| Text color | `#FF3B30` |

---

## Bulletin Board Pills

**SVG Source**: `icons/BulletinBoard/` (6 files)
**Used By**: `screens/main/BulletinBoardScreen.tsx`

| Pill | Fill Color | Height | Border Radius | SVG File |
|---|---|---|---|---|
| All | `#4D4D4D` | 29 | 14.5 | `All.svg` |
| General | `#0EADFF` | 26 | 13 | `General.svg` |
| Announcements | `#F9AA2B` | 26 | 13 | `Announcements.svg` |
| Community Help | `#34C759` | 26 | 13 | `Community Help.svg` |
| Marketplace | `#FF666B` | 26 | 13 | `Marketplace.svg` |
| TopMenu (combined) | — | 29 | 14.5 | `TopMenu.svg` |

---

## Text Input

**SVG Source**: `icons/TextInput/` (14 files)
**Used By**: Form inputs across CreateBubble, CreateEvent, EditBubble, EditEvent, auth screens

### Standard Input (Text=Default.svg)
| Property | Value |
|---|---|
| Width | 345 (full width) |
| Input height | 57 |
| Border radius | 8 (rx=7.5) |
| Fill | `#FFFFFF` |
| Stroke (default) | `#969696` |
| Stroke (error) | `#FF3B30` |
| Label offset | 30px above input |
| Icon placeholder | 24 x 24 at x=8, y=47 |
| Eye icon (password) | 24 x 24 at x=313, y=48 |

### Variants
| Variant | SVG File | Stroke Color | Extra |
|---|---|---|---|
| Default | `Text=Default.svg` | `#969696` | — |
| Required | `Text=Required.svg` | `#969696` | Red asterisk `#FF3B30` |
| Error | `Text=Error.svg` | `#FF3B30` | Error message below |
| With icon | `Text=Icon.svg` | `#969696` | Left icon 24x24 |
| Password | `Text=Password.svg` | `#969696` | Right eye icon |
| Location | `Text=Location.svg` | `#969696` | Left pin icon, height=59 |
| Subtext | `Text=Subtext.svg` | `#969696` | Helper text below |

---

## Text Area

**SVG Source**: `icons/TextArea/` (4 files)
**Used By**: Description fields in CreateBubble, CreateEvent, EditBubble, EditEvent, CreatePost

### Standard Text Area (Property 1=Default.svg)
| Property | Value |
|---|---|
| Width | 345 (full width) |
| Height | 321 |
| Border radius | 8 (rx=7.5) |
| Fill | `#FFFFFF` |
| Stroke (default) | `#969696` |
| Stroke (error/Variant2) | `#FF3B30` |
| Label offset | 30px above |

---

## Select / Dropdown / Radio

**SVG Source**: `icons/Select-Drop-down, Radio/` (6 files)
**Used By**: Category selection, privacy settings, campus selection

### Dropdown (Property 1=Default.svg)
| Property | Value |
|---|---|
| Width | 345 |
| Height | 88 (with label), input 57 |
| Border radius | 8 (rx=7.5) |
| Fill | `#FFFFFF` |
| Stroke | `#969696` |

### Radio Row (Property 1=Selected Radio.svg / Unselected Radio.svg)
| Property | Value |
|---|---|
| Row height | 77 |
| Border radius | 8 (rx=7.5) |
| Fill | `#FFFFFF` |
| Stroke | `#969696` |
| Radio circle radius | 9 |
| Radio stroke | `#35A8F7`, 2px |

---

## Selection Controls (Checkbox / Radio)

**SVG Source**: `icons/SelectionControls - Checkbox, Radio/` (6 files)
**Used By**: Interest selection, settings toggles

### Radio Button (20 x 20)
| State | Outer Stroke | Inner Fill |
|---|---|---|
| Unselected + Inactive | `#969696`, 2px | none |
| Unselected + Active | `#35A8F7`, 2px | none |
| Selected + Inactive | `#969696`, 2px | `#969696` (r=5) |
| Selected + Active | `#35A8F7`, 2px | `#35A8F7` (r=5) |

### Checkbox (18 x 18)
| State | Border | Fill |
|---|---|---|
| Unchecked | `#4D4D4D` stroke, rx=3.5 | `#FFFFFF` |
| Checked | `#4D4D4D` stroke, rx=3.5 | `#D9D9D9` + checkmark `#1C1B1F` |

---

## Signup Flow

**SVG Source**: `icons/Bubble_SignUp/` (16 files: Frame 106–120)
**Used By**: Auth screens (onboarding illustrations)

These are full-frame illustration/layout SVGs used as visual references for the signup flow screens.

---

## NavBar

**SVG Source**: `icons/NavBar.svg`, `icons/NavBar-Tabs/` (5 files: Tab=Explore, Tab=Upcoming, Tab=Bubbles, Tab=Messages, Tab=Profile)
**Used By**: `navigation/MainNavigator.tsx`, `components/icons/`

Each SVG is a full 393×90 navbar mockup showing all 5 tabs, with the active tab highlighted.

### Tab Bar Container
| Property | Value | SVG Reference |
|---|---|---|
| Background | `#FFFFFF` | `fill="white"` |
| Top border | `#D9D9D9`, 1px | `fill="#D9D9D9"` mask path |
| Height | 90 | `viewBox="0 0 393 90"` |

### Icon Colors
| State | Color | SVG Reference |
|---|---|---|
| Active | `#35A8F7` | `fill="#35A8F7"` |
| Inactive | `#4D4D4D` | `fill="#4D4D4D"` |

### Tab Icons (components in `components/icons/`)
| Tab | Component | viewBox | Has stroke |
|---|---|---|---|
| Explore | `ExploreIcon` | `0 0 24 24` | No |
| Upcoming | `UpcomingIcon` | `0 0 18 24` | No |
| Bubbles | `BubblesIcon` | `-3 0 24 24` | Yes (0.4) |
| Messages | `MessagesIcon` | `0 0 20 22` | No |
| Profile | `ProfileIcon` | `0 0 24 24` | No |
