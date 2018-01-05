# Typescript example of Spectre exploit

Source code based on C example (main.c) from this paper: https://spectreattack.com/spectre.pdf
The example needs SharedArrayBuffer, Atomics and Web Workers in order to measure memory read latency. It's tested in Chrome 63.0.3239.84 64-bit on Windows 10
and most likely won't work in newer versions due to https://www.chromium.org/Home/chromium-security/ssca
