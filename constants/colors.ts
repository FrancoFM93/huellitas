export const Colors = {
  primary: '#1D9E75',
  primaryLight: '#D1FAE5',
  primaryDark: '#15755A',

  alert: '#E53E3E',
  alertLight: '#FED7D7',

  warning: '#DD6B20',
  warningLight: '#FEEBC8',

  info: '#3182CE',
  infoLight: '#BEE3F8',

  success: '#38A169',
  successLight: '#C6F6D5',

  severity1: '#68D391', // low
  severity2: '#F6E05E', // minor
  severity3: '#F6AD55', // moderate
  severity4: '#FC8181', // serious
  severity5: '#E53E3E', // critical

  background: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  text: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#718096',
  textDisabled: '#A0AEC0',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const

export type ColorKey = keyof typeof Colors
