import * as fetch from 'isomorphic-fetch';
import {JSDOM} from 'jsdom';
import * as path from 'path';
import SequentialQueue from 'sequential-queue';
import {spawn} from 'child_process';

interface ComicsLink {
    title: string | number;
    link: string;
}
type Comics = ComicsLink;
type MapFunc = (value: Element, index?: number, array?: Element[]) => ComicsLink;

enum Path {
    ROOT,
    COMICS,
    COMICS_BOOK
}

export default class Zangsisi {
    private comicsList: ComicsLink[] = [];
    private comics = {};
    private books = {};
    private path = '/';
    private instructions = new SequentialQueue();

    constructor() {
        this.ls();
    }

    private async _getDomList(target: string, selector: string, map: MapFunc) {
        try {
            const response = await fetch(target);
            const text = await response.text();
            const document: Document = new JSDOM(text).window.document;
            return Array.from(document.querySelectorAll(selector)).map(map);
        } catch (ex) {
            console.error(ex);
            return [];
        }
    }

    private async _getMangaList(): Promise<ComicsLink[]> {
        return this._getDomList('http://zangsisi.net', '#manga-list a', element => ({
            title: element.getAttribute('data-title'),
            link : element.getAttribute('href')
        }));
    }

    private async _getManga(target: string): Promise<ComicsLink[]> {
        const manga = this.comicsList.find(manga => manga.title === target);
        if (!manga) {
            throw new Error(`manga list can't find ${target}`);
        }
        return this._getDomList(manga.link, '#post .contents a', element => ({
            title: element.textContent,
            link : element.getAttribute('href')
        }));
    }

    private async _getBooks(target: string): Promise<ComicsLink[]> {
        const mangaBooks = this.comics[this.getPath(true)].find(manga => manga.title === target);
        if (!mangaBooks) {
            throw new Error(`manga books can't find ${target}`);
        }
        return this._getDomList(mangaBooks.link, '#post .contents img', (element, title) => ({
            title,
            link: element.getAttribute('src')
        }));
    }

    private getPath(dir?: boolean): string {
        if (dir) {
            return path.dirname(this.path).slice(1);
        }
        return path.basename(this.path);
    }

    private updatePath(nextPath): void {
        this.path = nextPath === '/' ? this.path = '/' : path.join(this.path, nextPath);
        // this.debug();
    }

    private debug(): void {
        console.log('[debug] path: ' + this.path);
    }

    private depth(): number {
        return this.path === '/' ? 0 : this.path.match(/\//g).length;
    }

    private async _cd(target: string): Promise<void> {
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
            await this._ls();
        } else if (depth === Path.COMICS) {
            const mangaBooks = this.comics[this.getPath()].find(manga => manga.title === target);
            if (!mangaBooks) {
                this.debug();
                throw new Error(`operation failed: manga books can't find ${target}`);
            }
            this.updatePath(mangaBooks.title);
            await this._ls();
        } else {
            throw new Error(`operation failed: maximum depth limitation, check depth ${depth}`);
        }
    }

    private async _ls(): Promise<(ComicsLink | Comics)[]> {
        const pathLevel = this.depth();
        const currentPath = this.getPath();

        if (pathLevel === Path.ROOT) {
            if (this.comicsList.length === 0) {
                this.comicsList = await this._getMangaList();
            }
            return this.comicsList;
        } else if (pathLevel === Path.COMICS) {
            if (!this.comics[currentPath]) {
                this.comics[currentPath] = await this._getManga(currentPath);
            }
            return this.comics[currentPath];
        } else if (pathLevel === Path.COMICS_BOOK) {
            if (!this.books[currentPath]) {
                this.books[currentPath] = this._getBooks(currentPath);
            }
            return this.books[currentPath];
        }
    }

    private template(): string {
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

    private async _html(manga?: Comics[], template = this.template(), selector = 'body') {
        const document: Document = new JSDOM(template).window.document;
        const images = manga || await this._getBooks(this.getPath());
        const body = JSDOM.fragment(images.map(image => `<p><img src="${image.link}"/></p>`).join('\n'));
        document.querySelector(selector).appendChild(body);
        return document.documentElement.outerHTML;
    }

    cd(target): void {
        if (target.startsWith('/')) {
            this._cd('/');
        }
        target
            .split('/')
            .filter(x => x)
            .map(step => this.instructions.push(this._cd.bind(this, step)));
    }

    async ls(): Promise<(ComicsLink | Comics)[]> {
        return this.instructions.push(this._ls.bind(this));
    }

    async html() {
        return this.instructions.push(() => this._html());
    }

    async bookHtml(...books: string[]) {
        const depth = this.depth();
        if (depth === Path.COMICS_BOOK) {
            this.updatePath('..');
        }
        try {
            const result = await Promise.all(books.map(this._getBooks.bind(this)));
            const merged: ComicsLink[] = result.reduce<Comics[]>((ret, curr: ComicsLink[]) => {
                ret.push(...curr);
                return ret;
            }, []);
            return this.instructions.push(() => this._html(merged));
        } catch (ex) {
            console.error(ex);
        }
    }

    async download(filename) {
        const level = this.depth();

        if (level !== Path.COMICS_BOOK) {
            console.error(`check current path ${this.getPath()}`);
            throw null;
        }

        try {
            const list = await this.ls();
            const bytes = await new Promise(resolve => {
                const child = spawn('node', [
                        `${__dirname}/../../node_modules/zip-remote-resources/index.js`,
                        filename,
                        JSON.stringify(list.map(r => r.link))
                    ],
                    {stdio: [0,'pipe',process.stderr]}
                );
                child.stdout.on('data', x => resolve(parseInt(x.toString())));
            });
            return bytes;
        } catch(ex) {
            console.error(ex);
            throw null;
        }
    }
}
