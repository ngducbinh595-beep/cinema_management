/**
 * Bộ tạo mã QR chuẩn ISO/IEC 18004 (Byte Mode UTF-8, Error Correction Level M / L)
 * Thuần TypeScript, không phụ thuộc thư viện ngoài — tạo ma trận QR quét được bằng mọi camera điện thoại.
 */

interface VersionSpec {
  version: number;
  ecBits: number; // 0b00 = M, 0b01 = L
  ecCodewordsPerBlock: number;
  group1Blocks: number;
  group1DataCodewords: number;
  group2Blocks: number;
  group2DataCodewords: number;
  alignmentCenters: number[];
}

// Bảng cấu hình chuẩn ISO/IEC 18004 (ưu tiên mức M cho chuỗi ngắn/vừa, mức L cho chuỗi dài tới 271 bytes UTF-8)
const VERSION_SPECS: VersionSpec[] = [
  { version: 1, ecBits: 0b00, ecCodewordsPerBlock: 10, group1Blocks: 1, group1DataCodewords: 16, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [] },
  { version: 2, ecBits: 0b00, ecCodewordsPerBlock: 16, group1Blocks: 1, group1DataCodewords: 28, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 18] },
  { version: 3, ecBits: 0b00, ecCodewordsPerBlock: 26, group1Blocks: 1, group1DataCodewords: 44, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 22] },
  { version: 4, ecBits: 0b00, ecCodewordsPerBlock: 18, group1Blocks: 2, group1DataCodewords: 32, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 26] },
  { version: 5, ecBits: 0b00, ecCodewordsPerBlock: 24, group1Blocks: 2, group1DataCodewords: 43, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 30] },
  { version: 6, ecBits: 0b00, ecCodewordsPerBlock: 16, group1Blocks: 4, group1DataCodewords: 27, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 34] },
  { version: 7, ecBits: 0b00, ecCodewordsPerBlock: 18, group1Blocks: 4, group1DataCodewords: 31, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 22, 38] },
  { version: 8, ecBits: 0b00, ecCodewordsPerBlock: 22, group1Blocks: 2, group1DataCodewords: 38, group2Blocks: 2, group2DataCodewords: 39, alignmentCenters: [6, 24, 42] },
  { version: 9, ecBits: 0b00, ecCodewordsPerBlock: 22, group1Blocks: 3, group1DataCodewords: 36, group2Blocks: 2, group2DataCodewords: 37, alignmentCenters: [6, 26, 46] },
  { version: 9, ecBits: 0b01, ecCodewordsPerBlock: 30, group1Blocks: 2, group1DataCodewords: 116, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 26, 46] },
  { version: 10, ecBits: 0b01, ecCodewordsPerBlock: 18, group1Blocks: 2, group1DataCodewords: 68, group2Blocks: 2, group2DataCodewords: 69, alignmentCenters: [6, 28, 50] },
];

// Bảng mũ và logarit trên trường hữu hạn GF(2^8) với đa thức nguyên thủy 0x11D
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = buildGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    for (let j = 0; j < ecCount - 1; j++) {
      rem[j] = rem[j + 1];
    }
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function selectSpec(byteLength: number): VersionSpec {
  for (const spec of VERSION_SPECS) {
    const totalDataCodewords =
      spec.group1Blocks * spec.group1DataCodewords +
      spec.group2Blocks * spec.group2DataCodewords;
    const countBits = spec.version <= 9 ? 8 : 16;
    const maxBytes = Math.floor((totalDataCodewords * 8 - 4 - countBits) / 8);
    if (byteLength <= maxBytes) {
      return spec;
    }
  }
  return VERSION_SPECS[VERSION_SPECS.length - 1];
}

function encodeDataCodewords(utf8Bytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const totalDataCodewords =
    spec.group1Blocks * spec.group1DataCodewords +
    spec.group2Blocks * spec.group2DataCodewords;
  const countBits = spec.version <= 9 ? 8 : 16;
  const maxBytes = Math.floor((totalDataCodewords * 8 - 4 - countBits) / 8);
  const payload = utf8Bytes.length > maxBytes ? utf8Bytes.slice(0, maxBytes) : utf8Bytes;

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Mode indicator cho Byte Mode = 0100
  pushBits(0b0100, 4);
  pushBits(payload.length, countBits);
  for (let i = 0; i < payload.length; i++) {
    pushBits(payload[i], 8);
  }

  const capacityBits = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, capacityBits - bits.length);
  pushBits(0, terminatorLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(totalDataCodewords);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) {
      b = (b << 1) | bits[i + k];
    }
    codewords[byteIdx++] = b;
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (byteIdx < totalDataCodewords) {
    codewords[byteIdx++] = padBytes[padIdx % 2];
    padIdx++;
  }

  return codewords;
}

function interleaveBlocks(dataCodewords: Uint8Array, spec: VersionSpec): Uint8Array {
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < spec.group1Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + spec.group1DataCodewords);
    offset += spec.group1DataCodewords;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomonRemainder(block, spec.ecCodewordsPerBlock));
  }

  for (let i = 0; i < spec.group2Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + spec.group2DataCodewords);
    offset += spec.group2DataCodewords;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomonRemainder(block, spec.ecCodewordsPerBlock));
  }

  const maxDataLen = Math.max(spec.group1DataCodewords, spec.group2DataCodewords);
  const result: number[] = [];

  for (let col = 0; col < maxDataLen; col++) {
    for (const block of dataBlocks) {
      if (col < block.length) {
        result.push(block[col]);
      }
    }
  }

  for (let col = 0; col < spec.ecCodewordsPerBlock; col++) {
    for (const ec of ecBlocks) {
      result.push(ec[col]);
    }
  }

  return new Uint8Array(result);
}

function drawFinderPattern(
  modules: boolean[][],
  isFunction: boolean[][],
  topRow: number,
  leftCol: number
) {
  const size = modules.length;
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = topRow + dr;
      const c = leftCol + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      modules[r][c] = inOuter && (onBorder || inCenter);
      isFunction[r][c] = true;
    }
  }
}

function drawAlignmentPattern(
  modules: boolean[][],
  isFunction: boolean[][],
  centerRow: number,
  centerCol: number
) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      const dist = Math.max(Math.abs(dr), Math.abs(dc));
      modules[r][c] = dist !== 1;
      isFunction[r][c] = true;
    }
  }
}

function drawFormatBits(
  modules: boolean[][],
  isFunction: boolean[][],
  ecBits: number,
  mask: number
) {
  const size = modules.length;
  const data = (ecBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;

  const getBit = (idx: number) => ((bits >>> idx) & 1) !== 0;

  // Quanh góc trên-trái
  for (let i = 0; i <= 5; i++) {
    modules[8][i] = getBit(14 - i);
    isFunction[8][i] = true;
  }
  modules[8][7] = getBit(8);
  isFunction[8][7] = true;
  modules[8][8] = getBit(7);
  isFunction[8][8] = true;
  modules[7][8] = getBit(6);
  isFunction[7][8] = true;
  for (let i = 0; i <= 5; i++) {
    modules[5 - i][8] = getBit(5 - i);
    isFunction[5 - i][8] = true;
  }

  // Nửa dưới-trái và nửa trên-phải
  for (let i = 0; i <= 6; i++) {
    modules[size - 1 - i][8] = getBit(14 - i);
    isFunction[size - 1 - i][8] = true;
  }
  for (let i = 0; i <= 7; i++) {
    modules[8][size - 8 + i] = getBit(7 - i);
    isFunction[8][size - 8 + i] = true;
  }

  // Dark module cố định
  modules[size - 8][8] = true;
  isFunction[size - 8][8] = true;
}

function drawVersionBits(modules: boolean[][], isFunction: boolean[][], version: number) {
  if (version < 7) return;
  const size = modules.length;
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  const bits = (version << 12) | rem;

  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modules[a][b] = bit;
    isFunction[a][b] = true;
    modules[b][a] = bit;
    isFunction[b][a] = true;
  }
}

function shouldInvertMask(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function computePenaltyScore(modules: boolean[][]): number {
  const n = modules.length;
  let penalty = 0;

  // Rule 1: 5+ ô liên tiếp cùng màu trên hàng/cột
  for (let r = 0; r < n; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < n; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }
  for (let c = 0; c < n; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < n; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = modules[r][c];
        runLen = 1;
      }
    }
  }

  // Rule 2: Khối 2x2 cùng màu
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 4: Cân bằng tỷ lệ đen/trắng
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) dark++;
    }
  }
  const total = n * n;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  if (k > 0) penalty += k * 10;

  return penalty;
}

/**
 * Tạo ma trận điểm đen/trắng (boolean[][]) cho nội dung UTF-8 bất kỳ.
 */
export function generateQRMatrix(content: string): boolean[][] {
  const utf8Bytes = new TextEncoder().encode(content || "CINEMA-MANAGEMENT");
  const spec = selectSpec(utf8Bytes.length);
  const size = spec.version * 4 + 17;

  const baseModules: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );

  // 1. Finder patterns ở 3 góc
  drawFinderPattern(baseModules, isFunction, 0, 0);
  drawFinderPattern(baseModules, isFunction, 0, size - 7);
  drawFinderPattern(baseModules, isFunction, size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      baseModules[6][i] = i % 2 === 0;
      isFunction[6][i] = true;
    }
    if (!isFunction[i][6]) {
      baseModules[i][6] = i % 2 === 0;
      isFunction[i][6] = true;
    }
  }

  // 3. Alignment patterns
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      drawAlignmentPattern(baseModules, isFunction, centers[i], centers[j]);
    }
  }

  // 4. Đặt chỗ trước cho Format bits & Version bits
  drawFormatBits(baseModules, isFunction, spec.ecBits, 0);
  drawVersionBits(baseModules, isFunction, spec.version);

  // 5. Mã hóa dữ liệu + Reed-Solomon ECC và điền theo dải 2 cột zigzag
  const dataCodewords = encodeDataCodewords(utf8Bytes, spec);
  const allCodewords = interleaveBlocks(dataCodewords, spec);

  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const byteVal = allCodewords[bitIdx >>> 3];
            dark = ((byteVal >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          baseModules[r][c] = dark;
        }
      }
    }
  }

  // 6. Thử 8 mặt nạ (mask 0..7) và chọn mask có điểm phạt thấp nhất
  let bestMatrix = baseModules;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseModules.map((row) => [...row]);
    const fnCopy = isFunction.map((row) => [...row]);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!fnCopy[r][c] && shouldInvertMask(mask, r, c)) {
          candidate[r][c] = !candidate[r][c];
        }
      }
    }
    drawFormatBits(candidate, fnCopy, spec.ecBits, mask);
    const score = computePenaltyScore(candidate);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMatrix = candidate;
    }
  }

  return bestMatrix;
}

/**
 * Tạo chuỗi nội dung mã QR chuẩn hóa cho vé xem phim.
 */
export function buildTicketQRPayload(params: {
  bookingCode: string;
  movieTitle?: string;
  cinemaName?: string;
  roomName?: string;
  showDate?: string;
  showtime?: string;
  seats?: string;
  qrUrl?: string | null;
}): string {
  const cleanSeats = (params.seats || "")
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim();
  const baseUrl =
    params.qrUrl || `https://cinemamanagement.vn/checkin/${encodeURIComponent(params.bookingCode)}`;
  const metaParts = [
    `CODE:${params.bookingCode}`,
    params.showDate && params.showtime ? `TIME:${params.showtime} ${params.showDate}` : "",
    params.roomName ? `ROOM:${params.roomName}` : "",
    cleanSeats ? `SEATS:${cleanSeats}` : "",
  ].filter(Boolean);

  return `${baseUrl}?v=${encodeURIComponent(metaParts.join("|"))}`;
}
