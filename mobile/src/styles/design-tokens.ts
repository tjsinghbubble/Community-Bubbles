export const EventCardTokens = {
  height: 118,
  borderRadius: 15,
  padding: 10,
  fill: '#FFFFFF',
  stroke: '#D9D9D9',
  strokeWidth: 1,

  image: {
    size: 98,
    borderRadius: 10,
    placeholder: '#D9D9D9',
  },

  colors: {
    label: '#969696',
    title: '#1E1F26',
    subtitle: '#4D4D4D',
  },
} as const;

export const ButtonSvgTokens = {
  height: 56,
  borderRadius: 28,
  outlineBorderRadius: 27.5,

  primary: {
    gradient: { start: '#35A8F7', end: 'white' },
    pressed: '#37ADFF',
    disabled: '#969696',
    text: '#FFFFFF',
  },

  outline: {
    stroke: '#35A8F7',
    pressedFillOpacity: 0.15,
    disabledStroke: '#98B4C8',
    text: '#35A8F7',
    disabledText: '#98B4C8',
  },

  destructive: {
    stroke: '#FF3B30',
    pressedFillOpacity: 0.1,
    text: '#FF3B30',
  },

  ghost: {
    stroke: '#98B4C8',
    pressedFillOpacity: 0.08,
    pressedFillColor: '#35A8F7',
    text: '#98B4C8',
  },
} as const;

export const BulletinPillTokens = {
  all: { fill: '#4D4D4D', height: 29, borderRadius: 14.5 },
  general: { fill: '#0EADFF', height: 26, borderRadius: 13 },
  announcements: { fill: '#F9AA2B', height: 26, borderRadius: 13 },
  communityHelp: { fill: '#34C759', height: 26, borderRadius: 13 },
  marketplace: { fill: '#FF666B', height: 26, borderRadius: 13 },
} as const;

export const TextInputTokens = {
  height: 57,
  borderRadius: 8,
  fill: '#FFFFFF',
  stroke: '#969696',
  errorStroke: '#FF3B30',
  labelOffset: 30,
  iconSize: 24,
} as const;

export const TextAreaTokens = {
  height: 321,
  borderRadius: 8,
  fill: '#FFFFFF',
  stroke: '#969696',
  errorStroke: '#FF3B30',
  labelOffset: 30,
} as const;

export const SelectDropdownTokens = {
  height: 57,
  rowHeight: 77,
  borderRadius: 8,
  fill: '#FFFFFF',
  stroke: '#969696',
} as const;

export const RadioTokens = {
  size: 20,
  outerRadius: 9,
  innerRadius: 5,
  strokeWidth: 2,
  activeColor: '#35A8F7',
  inactiveColor: '#969696',
} as const;

export const CheckboxTokens = {
  size: 18,
  borderRadius: 4,
  stroke: '#4D4D4D',
  checkedFill: '#D9D9D9',
  uncheckedFill: '#FFFFFF',
  checkmarkColor: '#1C1B1F',
} as const;

export const NavBarTokens = {
  background: '#FFFFFF',
  borderTopColor: '#D9D9D9',
  borderTopWidth: 1,
  activeColor: '#35A8F7',
  inactiveColor: '#4D4D4D',
  iconSize: 24,
  height: 90,
} as const;
