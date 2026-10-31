// QR Code encoder (ISO/IEC 18004), versions 1-40, all four error correction
// levels. No dependencies. The text goes in numeric, alphanumeric or byte mode
// (UTF-8), whichever is the most compact one that can hold all of it.

const ECC_LEVELS = {
	L: { ordinal: 0, formatBits: 1 },
	M: { ordinal: 1, formatBits: 0 },
	Q: { ordinal: 2, formatBits: 3 },
	H: { ordinal: 3, formatBits: 2 },
};

// Indexed by [level ordinal][version]; index 0 is unused.
const ECC_CODEWORDS_PER_BLOCK = [
	[-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
	[-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
	[-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
	[-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
	[-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
	[-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

// The characters of alphanumeric mode, in the order of their values.
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// Mode indicator and character count bits for versions 1-9, 10-26 and 27-40.
const MODES = {
	numeric: { indicator: 0b0001, countBits: [10, 12, 14] },
	alphanumeric: { indicator: 0b0010, countBits: [9, 11, 13] },
	byte: { indicator: 0b0100, countBits: [8, 16, 16] },
};

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

/**
 * Encodes text as a QR code.
 *
 * @param {string} text  Any text. Digits only go in numeric mode; digits,
 *   uppercase letters, space and $%*+-./: in alphanumeric mode; anything
 *   else in byte mode, as UTF-8.
 * @param {'L'|'M'|'Q'|'H'} level  Error correction level.
 * @returns {{version: number, size: number, mask: number, mode: string, modules: boolean[][]}}
 *   `modules[y][x]` is true for a dark module.
 * @throws {RangeError} If the text does not fit in a version 40 symbol.
 */
export function encode(text, level = 'M') {
	const ecc = ECC_LEVELS[level];
	if (!ecc) {
		throw new TypeError('Unknown error correction level: ' + level);
	}
	const segment = makeSegment(text);
	const mode = MODES[segment.mode];

	let version = 1;
	for (; ; version++) {
		const capacityBits = numDataCodewords(version, ecc.ordinal) * 8;
		const usedBits = 4 + charCountBits(mode, version) + segment.bits.length;
		if (usedBits <= capacityBits) {
			break;
		}
		if (version >= 40) {
			throw new RangeError('Data too long');
		}
	}

	const bits = [];
	const append = (value, length) => appendBits(bits, value, length);
	append(mode.indicator, 4);
	append(segment.count, charCountBits(mode, version));
	for (const bit of segment.bits) {
		bits.push(bit);
	}
	const capacityBits = numDataCodewords(version, ecc.ordinal) * 8;
	append(0, Math.min(4, capacityBits - bits.length)); // Terminator
	append(0, (8 - (bits.length % 8)) % 8); // Byte alignment
	for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
		append(pad, 8);
	}
	const dataCodewords = new Array(bits.length / 8).fill(0);
	bits.forEach((bit, i) => {
		dataCodewords[i >>> 3] |= bit << (7 - (i & 7));
	});

	return { ...buildSymbol(version, ecc, addEccAndInterleave(dataCodewords, version, ecc)), mode: segment.mode };
}

// Picks the mode for the text and encodes its data bits, without the mode
// indicator and the character count.
function makeSegment(text) {
	const bits = [];
	const append = (value, length) => appendBits(bits, value, length);
	if (/^[0-9]+$/.test(text)) {
		// Groups of three digits in 10 bits; a last group of two in 7, of one in 4.
		for (let i = 0; i < text.length; i += 3) {
			const group = text.slice(i, i + 3);
			append(Number(group), group.length * 3 + 1);
		}
		return { mode: 'numeric', count: text.length, bits };
	}
	if (/^[0-9A-Z $%*+./:-]+$/.test(text)) {
		// Pairs of characters in 11 bits; a last single one in 6.
		for (let i = 0; i < text.length; i += 2) {
			const first = ALPHANUMERIC.indexOf(text[i]);
			if (i + 1 < text.length) {
				append(first * 45 + ALPHANUMERIC.indexOf(text[i + 1]), 11);
			} else {
				append(first, 6);
			}
		}
		return { mode: 'alphanumeric', count: text.length, bits };
	}
	const bytes = new TextEncoder().encode(text);
	for (const b of bytes) {
		append(b, 8);
	}
	return { mode: 'byte', count: bytes.length, bits };
}

// Appends the lowest `length` bits of `value`, most significant first.
function appendBits(bits, value, length) {
	for (let i = length - 1; i >= 0; i--) {
		bits.push((value >>> i) & 1);
	}
}

function charCountBits(mode, version) {
	return mode.countBits[version < 10 ? 0 : version < 27 ? 1 : 2];
}

function numRawDataModules(version) {
	let result = (16 * version + 128) * version + 64;
	if (version >= 2) {
		const numAlign = Math.floor(version / 7) + 2;
		result -= (25 * numAlign - 10) * numAlign - 55;
		if (version >= 7) {
			result -= 36;
		}
	}
	return result;
}

function numDataCodewords(version, eccOrdinal) {
	return (
		Math.floor(numRawDataModules(version) / 8) -
		ECC_CODEWORDS_PER_BLOCK[eccOrdinal][version] * NUM_ERROR_CORRECTION_BLOCKS[eccOrdinal][version]
	);
}

function addEccAndInterleave(data, version, ecc) {
	const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc.ordinal][version];
	const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc.ordinal][version];
	const rawCodewords = Math.floor(numRawDataModules(version) / 8);
	const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
	const shortBlockLen = Math.floor(rawCodewords / numBlocks);

	const blocks = [];
	const divisor = reedSolomonDivisor(blockEccLen);
	for (let i = 0, k = 0; i < numBlocks; i++) {
		const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
		k += dat.length;
		const eccBytes = reedSolomonRemainder(dat, divisor);
		if (i < numShortBlocks) {
			dat.push(0);
		}
		blocks.push(dat.concat(eccBytes));
	}

	const result = [];
	for (let i = 0; i < blocks[0].length; i++) {
		blocks.forEach((block, j) => {
			// Skip the padding byte of short blocks.
			if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
				result.push(block[i]);
			}
		});
	}
	return result;
}

// Reed-Solomon over GF(2^8) with the polynomial x^8 + x^4 + x^3 + x^2 + 1.
function reedSolomonDivisor(degree) {
	const result = new Array(degree).fill(0);
	result[degree - 1] = 1;
	let root = 1;
	for (let i = 0; i < degree; i++) {
		for (let j = 0; j < result.length; j++) {
			result[j] = gfMultiply(result[j], root);
			if (j + 1 < result.length) {
				result[j] ^= result[j + 1];
			}
		}
		root = gfMultiply(root, 0x02);
	}
	return result;
}

function reedSolomonRemainder(data, divisor) {
	const result = divisor.map(() => 0);
	for (const b of data) {
		const factor = b ^ result.shift();
		result.push(0);
		divisor.forEach((coef, i) => {
			result[i] ^= gfMultiply(coef, factor);
		});
	}
	return result;
}

function gfMultiply(x, y) {
	let z = 0;
	for (let i = 7; i >= 0; i--) {
		z = (z << 1) ^ ((z >>> 7) * 0x11d);
		z ^= ((y >>> i) & 1) * x;
	}
	return z;
}

function buildSymbol(version, ecc, codewords) {
	const size = version * 4 + 17;
	const modules = Array.from({ length: size }, () => new Array(size).fill(false));
	const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

	const setFunction = (x, y, dark) => {
		modules[y][x] = dark;
		isFunction[y][x] = true;
	};
	const bit = (value, i) => ((value >>> i) & 1) !== 0;

	function drawFormatBits(mask) {
		const data = (ecc.formatBits << 3) | mask;
		let rem = data;
		for (let i = 0; i < 10; i++) {
			rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
		}
		const bits = ((data << 10) | rem) ^ 0x5412;
		for (let i = 0; i <= 5; i++) {
			setFunction(8, i, bit(bits, i));
		}
		setFunction(8, 7, bit(bits, 6));
		setFunction(8, 8, bit(bits, 7));
		setFunction(7, 8, bit(bits, 8));
		for (let i = 9; i < 15; i++) {
			setFunction(14 - i, 8, bit(bits, i));
		}
		for (let i = 0; i < 8; i++) {
			setFunction(size - 1 - i, 8, bit(bits, i));
		}
		for (let i = 8; i < 15; i++) {
			setFunction(8, size - 15 + i, bit(bits, i));
		}
		setFunction(8, size - 8, true); // Always dark
	}

	function drawVersion() {
		if (version < 7) {
			return;
		}
		let rem = version;
		for (let i = 0; i < 12; i++) {
			rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
		}
		const bits = (version << 12) | rem;
		for (let i = 0; i < 18; i++) {
			const dark = bit(bits, i);
			const a = size - 11 + (i % 3);
			const b = Math.floor(i / 3);
			setFunction(a, b, dark);
			setFunction(b, a, dark);
		}
	}

	function drawFinder(cx, cy) {
		for (let dy = -4; dy <= 4; dy++) {
			for (let dx = -4; dx <= 4; dx++) {
				const dist = Math.max(Math.abs(dx), Math.abs(dy));
				const x = cx + dx;
				const y = cy + dy;
				if (x >= 0 && x < size && y >= 0 && y < size) {
					setFunction(x, y, dist !== 2 && dist !== 4);
				}
			}
		}
	}

	function drawAlignment(cx, cy) {
		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
			}
		}
	}

	// Function patterns.
	for (let i = 0; i < size; i++) {
		setFunction(6, i, i % 2 === 0);
		setFunction(i, 6, i % 2 === 0);
	}
	drawFinder(3, 3);
	drawFinder(size - 4, 3);
	drawFinder(3, size - 4);
	const align = alignmentPositions(version, size);
	const n = align.length;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) {
				drawAlignment(align[i], align[j]);
			}
		}
	}
	drawFormatBits(0); // Placeholder so the area is marked as function modules.
	drawVersion();

	// Data modules, in the zigzag order of the specification.
	let i = 0;
	for (let right = size - 1; right >= 1; right -= 2) {
		if (right === 6) {
			right = 5;
		}
		for (let vert = 0; vert < size; vert++) {
			for (let j = 0; j < 2; j++) {
				const x = right - j;
				const upward = ((right + 1) & 2) === 0;
				const y = upward ? size - 1 - vert : vert;
				if (!isFunction[y][x] && i < codewords.length * 8) {
					modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
					i++;
				}
			}
		}
	}

	function applyMask(mask) {
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				let invert;
				switch (mask) {
					case 0: invert = (x + y) % 2 === 0; break;
					case 1: invert = y % 2 === 0; break;
					case 2: invert = x % 3 === 0; break;
					case 3: invert = (x + y) % 3 === 0; break;
					case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
					case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
					case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
					default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
				}
				if (!isFunction[y][x] && invert) {
					modules[y][x] = !modules[y][x];
				}
			}
		}
	}

	// Pick the mask with the lowest penalty.
	let bestMask = 0;
	let minPenalty = Infinity;
	for (let mask = 0; mask < 8; mask++) {
		applyMask(mask);
		drawFormatBits(mask);
		const penalty = penaltyScore(modules, size);
		if (penalty < minPenalty) {
			bestMask = mask;
			minPenalty = penalty;
		}
		applyMask(mask); // Undo
	}
	applyMask(bestMask);
	drawFormatBits(bestMask);

	return { version, size, mask: bestMask, modules };
}

function alignmentPositions(version, size) {
	if (version === 1) {
		return [];
	}
	const count = Math.floor(version / 7) + 2;
	const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
	const result = [6];
	for (let pos = size - 7; result.length < count; pos -= step) {
		result.splice(1, 0, pos);
	}
	return result;
}

function penaltyScore(modules, size) {
	let result = 0;

	const finderAddHistory = (runLength, history) => {
		if (history[0] === 0) {
			runLength += size; // Light border
		}
		history.pop();
		history.unshift(runLength);
	};
	const finderCountPatterns = (history) => {
		const n = history[1];
		const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
		return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) + (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
	};
	const finderTerminateAndCount = (runColor, runLength, history) => {
		if (runColor) {
			finderAddHistory(runLength, history);
			runLength = 0;
		}
		runLength += size; // Light border
		finderAddHistory(runLength, history);
		return finderCountPatterns(history);
	};

	// Runs of the same color and finder-like patterns, in rows then columns.
	for (const byRow of [true, false]) {
		for (let a = 0; a < size; a++) {
			let runColor = false;
			let runLength = 0;
			const history = [0, 0, 0, 0, 0, 0, 0];
			for (let b = 0; b < size; b++) {
				const color = byRow ? modules[a][b] : modules[b][a];
				if (color === runColor) {
					runLength++;
					if (runLength === 5) {
						result += PENALTY_N1;
					} else if (runLength > 5) {
						result++;
					}
				} else {
					finderAddHistory(runLength, history);
					if (!runColor) {
						result += finderCountPatterns(history) * PENALTY_N3;
					}
					runColor = color;
					runLength = 1;
				}
			}
			result += finderTerminateAndCount(runColor, runLength, history) * PENALTY_N3;
		}
	}

	// 2x2 blocks of the same color.
	for (let y = 0; y < size - 1; y++) {
		for (let x = 0; x < size - 1; x++) {
			const color = modules[y][x];
			if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) {
				result += PENALTY_N2;
			}
		}
	}

	// Balance of dark and light modules.
	let dark = 0;
	for (const row of modules) {
		for (const color of row) {
			if (color) {
				dark++;
			}
		}
	}
	const total = size * size;
	const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
	result += k * PENALTY_N4;
	return result;
}
