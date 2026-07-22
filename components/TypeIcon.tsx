import Svg, { Circle, Path } from 'react-native-svg';
import type { PokemonType } from '@/lib/types';
import { TYPE_COLORS } from '@/lib/types-colors';
import { TYPE_GLYPH_PATH } from '@/lib/type-glyphs';

interface Props {
  type: PokemonType;
  size?: number;
  /** Omit the colored circle backdrop and draw the glyph alone, tinted to the type color. */
  bare?: boolean;
}

const GLYPH_VIEWBOX = 512;
const GLYPH_FILL_RATIO = 0.56;

export function TypeIcon({ type, size = 24, bare = false }: Props) {
  const glyphSize = size * GLYPH_FILL_RATIO;
  const offset = (size - glyphSize) / 2;
  const scale = glyphSize / GLYPH_VIEWBOX;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {!bare && <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={TYPE_COLORS[type]} />}
      <Path
        d={TYPE_GLYPH_PATH[type]}
        fill={bare ? TYPE_COLORS[type] : 'white'}
        fillRule="evenodd"
        transform={`translate(${offset} ${offset}) scale(${scale})`}
      />
    </Svg>
  );
}
