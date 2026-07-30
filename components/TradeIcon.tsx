import Svg, { Rect, Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

// Two cards side by side with a bidirectional swap arrow between them —
// same react-native-svg convention as TypeIcon, no image asset.
export function TradeIcon({ size = 24, color = '#ffffff' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="1.5" y="4" width="8.5" height="12.5" rx="1.6" stroke={color} strokeWidth="1.6" />
      <Rect x="14" y="7" width="8.5" height="12.5" rx="1.6" stroke={color} strokeWidth="1.6" />
      <Path d="M9 9.5H16.5M16.5 9.5L14 7M16.5 9.5L14 12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 14.5H7.5M7.5 14.5L10 12M7.5 14.5L10 17" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
