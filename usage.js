"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const path_1 = require("path");
const fs_1 = require("fs");
const nodeZip = require("node-zip");
class Zip {
    constructor() {
        this.zip = new nodeZip();
    }
    add(filename, buffer) {
        this.zip.file(filename, buffer);
    }
    buffer() {
        return this.blob = this.zip.generate({ base64: false, compression: 'DEFLATE' });
    }
}
exports.default = Zip;
var EList;
(function (EList) {
    EList[EList["Comics"] = 1] = "Comics";
    EList[EList["ComicsBook"] = 2] = "ComicsBook";
})(EList || (EList = {}));
const zangsisi = new index_1.default();
const ls = zangsisi.ls.bind(zangsisi);
const cd = zangsisi.cd.bind(zangsisi);
function list(target) {
    return __awaiter(this, void 0, void 0, function* () {
        cd(target);
        try {
            return yield ls();
        }
        catch (ex) {
            console.error(ex);
        }
    });
}
function download(target) {
    return __awaiter(this, void 0, void 0, function* () {
        cd(target);
        const level = target.split('/').filter(x => x).length;
        try {
            const zip = new Zip();
            const list = yield ls();
            if (level === EList.Comics) {
                const mapTitle = ({ title }) => path_1.join('/', target, title);
                const titles = list.map(mapTitle);
                const seqDownload = (book) => __awaiter(this, void 0, void 0, function* () {
                    if (!book) {
                        return;
                    }
                    console.log(`[download] ${book}`);
                    yield download(book);
                    seqDownload(titles.shift());
                });
                seqDownload(titles.shift());
            }
            else {
                yield Promise.all(list.map(({ link }) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const response = yield fetch(encodeURI(link));
                        const buffer = yield response.buffer();
                        zip.add(path_1.basename(link), buffer);
                    }
                    catch (ex) {
                        console.error(`fetch error: ${link}`, ex);
                    }
                })));
                fs_1.writeFileSync(`${path_1.basename(target).replace(/\s/g, '_')}.zip`, zip.buffer(), 'binary');
            }
        }
        catch (ex) {
            console.error(ex);
        }
    });
}
!function () {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[list]');
        console.log('[list] 1 depth', yield list('너의 이름은'));
        console.log('[list] 2 depth', yield list('/더 파이팅/더 파이팅 100권'));
        // console.log('[download] by comics name');
        // await download('/너의 이름은');
        // console.log('[download] by book');
        // await download('/너의 이름은/너의 이름은 1~2화');
        // await download('/더 파이팅/더 파이팅 100권');
    });
}();
