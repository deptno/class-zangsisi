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
const fetch = require("isomorphic-fetch");
const jsdom_1 = require("jsdom");
const path = require("path");
const sequential_queue_1 = require("sequential-queue");
const zip_1 = require("./modules/zip");
var Path;
(function (Path) {
    Path[Path["ROOT"] = 0] = "ROOT";
    Path[Path["COMICS"] = 1] = "COMICS";
    Path[Path["COMICS_BOOK"] = 2] = "COMICS_BOOK";
})(Path || (Path = {}));
class Zangsisi {
    constructor() {
        this.comicsList = [];
        this.comics = {};
        this.books = {};
        this.path = '/';
        this.instructions = new sequential_queue_1.default();
        this.ls();
    }
    _getDomList(target, selector, map) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(target);
                const text = yield response.text();
                const document = new jsdom_1.JSDOM(text).window.document;
                return Array.from(document.querySelectorAll(selector)).map(map);
            }
            catch (ex) {
                console.error(ex);
                return [];
            }
        });
    }
    _getMangaList() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getDomList('http://zangsisi.net', '#manga-list a', element => ({
                title: element.getAttribute('data-title'),
                link: element.getAttribute('href')
            }));
        });
    }
    _getManga(target) {
        return __awaiter(this, void 0, void 0, function* () {
            const manga = this.comicsList.find(manga => manga.title === target);
            if (!manga) {
                throw new Error(`manga list can't find ${target}`);
            }
            return this._getDomList(manga.link, '#post .contents a', element => ({
                title: element.textContent,
                link: element.getAttribute('href')
            }));
        });
    }
    _getBooks(target) {
        return __awaiter(this, void 0, void 0, function* () {
            const mangaBooks = this.comics[this.getPath(true)].find(manga => manga.title === target);
            if (!mangaBooks) {
                throw new Error(`manga books can't find ${target}`);
            }
            return this._getDomList(mangaBooks.link, '#post .contents img', (element, title) => ({
                title,
                link: element.getAttribute('src')
            }));
        });
    }
    getPath(dir) {
        if (dir) {
            return path.dirname(this.path).slice(1);
        }
        return path.basename(this.path);
    }
    updatePath(nextPath) {
        this.path = nextPath === '/' ? this.path = '/' : path.join(this.path, nextPath);
        // this.debug();
    }
    debug() {
        console.log('[debug] path: ' + this.path);
    }
    depth() {
        return this.path === '/' ? 0 : this.path.match(/\//g).length;
    }
    _cd(target) {
        return __awaiter(this, void 0, void 0, function* () {
            // console.log('cd ', target);
            if (target === '/' || target === '..') {
                this.updatePath(target);
                return;
            }
            const depth = this.depth();
            if (depth === Path.ROOT) {
                const manga = this.comicsList.find(manga => manga.title === target);
                if (!manga) {
                    this.debug();
                    throw new Error(`operation failed: manga list can't find ${target}`);
                }
                this.updatePath(manga.title);
                yield this._ls();
            }
            else if (depth === Path.COMICS) {
                const mangaBooks = this.comics[this.getPath()].find(manga => manga.title === target);
                if (!mangaBooks) {
                    this.debug();
                    throw new Error(`operation failed: manga books can't find ${target}`);
                }
                this.updatePath(mangaBooks.title);
                yield this._ls();
            }
            else {
                throw new Error(`operation failed: maximum depth limitation, check depth ${depth}`);
            }
        });
    }
    _ls() {
        return __awaiter(this, void 0, void 0, function* () {
            const pathLevel = this.depth();
            const currentPath = this.getPath();
            if (pathLevel === Path.ROOT) {
                if (this.comicsList.length === 0) {
                    this.comicsList = yield this._getMangaList();
                }
                return this.comicsList;
            }
            else if (pathLevel === Path.COMICS) {
                if (!this.comics[currentPath]) {
                    this.comics[currentPath] = yield this._getManga(currentPath);
                }
                return this.comics[currentPath];
            }
            else if (pathLevel === Path.COMICS_BOOK) {
                if (!this.books[currentPath]) {
                    this.books[currentPath] = this._getBooks(currentPath);
                }
                return this.books[currentPath];
            }
        });
    }
    template() {
        return `<!DOCTYPE html>
<html lang="ko">
<head>
<title>${this.getPath()}</title>
</head>
<body/>
<h1>${this.getPath()}</h1>
</body>
</html>`;
    }
    _html(manga, template = this.template(), selector = 'body') {
        return __awaiter(this, void 0, void 0, function* () {
            const document = new jsdom_1.JSDOM(template).window.document;
            const images = manga || (yield this._getBooks(this.getPath()));
            const body = jsdom_1.JSDOM.fragment(images.map(image => `<p><img src="${image.link}"/></p>`).join('\n'));
            document.querySelector(selector).appendChild(body);
            return document.documentElement.outerHTML;
        });
    }
    cd(target) {
        if (target.startsWith('/')) {
            this._cd('/');
        }
        target
            .split('/')
            .filter(x => x)
            .map(step => this.instructions.push(this._cd.bind(this, step)));
    }
    ls() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.instructions.push(this._ls.bind(this));
        });
    }
    html() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.instructions.push(() => this._html());
        });
    }
    bookHtml(...books) {
        return __awaiter(this, void 0, void 0, function* () {
            const depth = this.depth();
            if (depth === Path.COMICS_BOOK) {
                this.updatePath('..');
            }
            try {
                const result = yield Promise.all(books.map(this._getBooks.bind(this)));
                const merged = result.reduce((ret, curr) => {
                    ret.push(...curr);
                    return ret;
                }, []);
                return this.instructions.push(() => this._html(merged));
            }
            catch (ex) {
                console.error(ex);
            }
        });
    }
    download() {
        return __awaiter(this, void 0, void 0, function* () {
            const level = this.depth();
            const zip = new zip_1.default();
            if (level !== Path.COMICS_BOOK) {
                console.error(`check current path ${this.getPath()}`);
                throw null;
            }
            try {
                const list = yield this.ls();
                yield Promise.all(list.map(({ link }) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const response = yield fetch(encodeURI(link));
                        const buffer = yield response.buffer();
                        zip.add(path.basename(link), buffer);
                    }
                    catch (ex) {
                        console.error(`fetch error: ${link}`, ex);
                    }
                })));
                return zip.buffer();
            }
            catch (ex) {
                console.error(ex);
                throw null;
            }
        });
    }
}
exports.default = Zangsisi;
