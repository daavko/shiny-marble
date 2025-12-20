// // ==UserScript==
// // @name         New Userscript
// // @namespace    http://tampermonkey.net/
// // @version      2025-12-11
// // @description  try to take over the world!
// // @author       You
// // @match        https://wplace.live/
// // @icon         https://www.google.com/s2/favicons?sz=64&domain=wplace.live
// // @grant        none
// // @run-at       document-end
// // ==/UserScript==
//
// (function () {
//     'use strict';
//     console.log('calling import on main svelte module');
//     import('/_app/immutable/chunks/HtHXdD60.js').then((v) => {
//         const c = v.a$.prototype.capture;
//         console.log('installing svelte reactivity class proxy');
//         v.a$.prototype.capture = function (...args) {
//             if (args[0]?.v?._canvas && args[0].v._canvas instanceof HTMLCanvasElement) {
//                 console.log('map value found');
//                 console.log(args[0].v);
//                 window.libremapinstance = args[0].v;
//                 v.a$.prototype.capture = c;
//             }
//             return c.apply(this, args);
//         };
//     });
//
//     // Your code here...
// })();

// todo: go through all preloaded modules, import each module, check for whatever has the .prototype.capture method,
//  patch it to detect the map instance
