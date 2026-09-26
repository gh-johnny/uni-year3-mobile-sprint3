import { create } from 'qrcode/lib/core/qrcode';
import Svg, { Path, Rect } from 'react-native-svg';

export type QrMatrix = { size: number; isDark: (row: number, column: number) => boolean };

/** Encodes `value` into a QR matrix using the pure-JS core of `qrcode` (no canvas/DOM). */
export function qrMatrix(value: string): QrMatrix {
  const { modules } = create(value, { errorCorrectionLevel: 'M' });
  return { size: modules.size, isDark: (row, column) => modules.get(row, column) === 1 || modules.get(row, column) === true };
}

/** One SVG path for all dark modules — cheap to render at any size. */
export function qrPath(matrix: QrMatrix): string {
  let d = '';
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.isDark(row, column)) d += `M${column} ${row}h1v1h-1z`;
    }
  }
  return d;
}

export type QrCodeProps = { value: string; size?: number; color?: string; background?: string; testID?: string };

export function QrCode({ value, size = 180, color = '#00095B', background = '#FFFFFF', testID }: QrCodeProps) {
  const matrix = qrMatrix(value);
  const quiet = 2;
  const box = matrix.size + quiet * 2;
  return (
    <Svg testID={testID} width={size} height={size} viewBox={`${-quiet} ${-quiet} ${box} ${box}`} accessibilityLabel={value}>
      <Rect x={-quiet} y={-quiet} width={box} height={box} fill={background} />
      <Path d={qrPath(matrix)} fill={color} />
    </Svg>
  );
}
