import { create } from 'qrcode/lib/core/qrcode';
import jsQR from 'jsqr';

function raster(value: string) {
  const qr = create(value, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const quiet = 4;
  const scale = 4;
  const cells = n + quiet * 2;
  const size = cells * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  data.fill(255);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(row, col)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = (col + quiet) * scale + dx;
          const y = (row + quiet) * scale + dy;
          const i = (y * size + x) * 4;
          data[i] = 23;
          data[i + 1] = 26;
          data[i + 2] = 43;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { data, size };
}

test('o QR do convite é lido de volta com o link do grupo', () => {
  const url = 'https://gym-chalenge.web.app/?entrar=GYM7K2';
  const { data, size } = raster(url);
  const decoded = jsQR(data, size, size);
  expect(decoded?.data).toBe(url);
});
