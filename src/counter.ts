(() => {

let sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
let counter32 = new Int32Array(sharedBuffer);
Atomics.store(counter32, 0, 0);

postMessage(counter32, undefined);

while (1) {
  Atomics.add(counter32, 0, 1);
}

})();