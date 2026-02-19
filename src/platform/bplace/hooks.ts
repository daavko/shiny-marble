// // ==UserScript==
// // @name         New Userscript
// // @namespace    http://tampermonkey.net/
// // @version      2026-02-09
// // @description  try to take over the world!
// // @author       You
// // @match        https://bplace.art/
// // @icon         https://www.google.com/s2/favicons?sz=64&domain=bplace.art
// // @grant        none
// // @run-at       document-end
// // ==/UserScript==
//
// (function () {
//     'use strict';
//
//     import('./assets/vendor-DgdZrGGt.js').then((m) => {
//         let foundMap = false;
//         const useRefOriginal = m.b.useRef;
//         const patchedRefs = new Set();
//         function found() {
//             for (const patchedRef of patchedRefs) {
//                 // todo
//                 const refObj = patchedRef.deref();
//                 if (refObj) {
//                     const val = refObj.current;
//                     Object.defineProperty(refObj, 'current', {
//                         value: val,
//                         configurable: true,
//                         enumerable: true,
//                         writable: true,
//                     });
//                 }
//             }
//             console.log('unpatched refs', patchedRefs.size);
//             patchedRefs.clear();
//         }
//         m.b.useRef = (...args) => {
//             const ref = useRefOriginal(...args);
//             const refRef = new WeakRef(ref);
//             patchedRefs.add(refRef);
//             let val = ref.current;
//             Object.defineProperty(ref, 'current', {
//                 get: () => {
//                     return val;
//                 },
//                 set: (newVal) => {
//                     val = newVal;
//                     if (
//                         !foundMap &&
//                         typeof newVal === 'object' &&
//                         newVal != null &&
//                         newVal._canvas instanceof HTMLCanvasElement
//                     ) {
//                         foundMap = true;
//                         console.log('found map', newVal);
//                         window.maplibreinstance = newVal;
//                         m.b.useRef = useRefOriginal;
//                         found();
//                     }
//                 },
//                 configurable: true,
//                 enumerable: true,
//             });
//             return ref;
//         };
//     });
//
//     // Your code here...
// })();
