import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { create } from 'qrcode/lib/core/qrcode';

// Matriz pura (sem canvas) desenhada em SVG. O mesmo desenho sai nítido no
// navegador e no Expo, e a correção alta aguenta a foto da tela na banca.
export function InviteQr({ value, size = 220 }: { value: string; size?: number }) {
  const drawing = useMemo(() => {
    if (!value) return '';
    const qr = create(value, { errorCorrectionLevel: 'H' });
    const n = qr.modules.size;
    const quiet = 4;
    const cells = n + quiet * 2;
    const cell = size / cells;
    let d = '';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (!qr.modules.get(row, col)) continue;
        const x = (col + quiet) * cell;
        const y = (row + quiet) * cell;
        d += `M${x} ${y}h${cell}v${cell}h-${cell}z`;
      }
    }
    return d;
  }, [value, size]);

  if (!drawing) return null;

  return (
    <View
      accessibilityLabel="QR code para entrar no grupo"
      style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 18, alignSelf: 'center' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        <Path d={drawing} fill="#171A2B" />
      </Svg>
    </View>
  );
}
