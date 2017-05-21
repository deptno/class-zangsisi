import * as fetch from 'isomorphic-fetch';
import {JSDOM} from 'jsdom';
import * as path from 'path';
import SequentialQueue from 'sequential-queue';

interface MangaLink {
    title: string | number;
    link: string;
}
type Manga = MangaLink;
type MapFunc = (value: Element, index?: number, array?: Element[]) => MangaLink;

enum Path {
    ROOT,
    COMICS,
    COMICS_BOOK
}

export default class Zangsisi {
    private comicsList: MangaLink[] = [];
    private comics;
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

    private async _getMangaList(): Promise<MangaLink[]> {
        return this._getDomList('http://zangsisi.net', '#manga-list a', element => ({
            title: element.getAttribute('data-title'),
            link : element.getAttribute('href')
        }));
    }

    async _getManga(target: string): Promise<MangaLink[]> {
        const manga = this.comicsList.find(manga => manga.title === target);
        if (!manga) {
            throw new Error(`manga list can't find ${target}`);
        }
        return this._getDomList(manga.link, '#post .contents a', element => ({
            title: element.textContent,
            link : element.getAttribute('href')
        }));
    }

    async _getBooks(target: string): Promise<MangaLink[]> {
        const mangaBooks = this.comics.find(manga => manga.title === target);
        if (!mangaBooks) {
            throw new Error(`manga books can't find ${target}`);
        }
        return this._getDomList(mangaBooks.link, '#post .contents img', (element, title) => ({
            title,
            link: element.getAttribute('src')
        }));
    }

    currentPath(): string {
        return this.path.slice(this.path.lastIndexOf('/') + 1);
    }

    updatePath(nextPath): void {
        this.path = nextPath === '/' ? this.path = '/' : path.join(this.path, nextPath);
        this.debug();
    }

    debug() {
        // console.log('[debug] path: ' + this.path);
    }

    depth() {
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
                throw new Error(`operation failed: manga list can't find ${target}`);
            }
            this.updatePath(manga.title);
            await this._ls();
        } else if (depth === Path.COMICS) {
            const mangaBooks = this.comics.find(manga => manga.title === target);
            if (!mangaBooks) {
                throw new Error(`operation failed: manga books can't find ${target}`);
            }
            this.updatePath(mangaBooks.title);
            await this._ls();
        } else {
            throw new Error(`operation failed: maximum depth limitation, check depth ${depth}`);
        }
    }

    private async _ls(): Promise<(MangaLink | Manga)[]> {
        const pathLevel = this.depth();
        // console.log('ls ', this.currentPath(), pathLevel);

        if (pathLevel === Path.ROOT) {
            return this.comicsList = await this._getMangaList();
        } else if (pathLevel === Path.COMICS) {
            return this.comics = await this._getManga(this.currentPath());
        } else if (pathLevel === Path.COMICS_BOOK) {
            return this._getBooks(this.currentPath());
        }
    }

    private template(): string {
        return `<!DOCTYPE html>
<html lang="ko">
<head>
<title>${this.currentPath()}</title>
</head>
<body/>
<h1>${this.currentPath()}</h1>
</body>
</html>`;
    }

    private async _html(manga?: Manga[], template = this.template(), selector = 'body') {
        const document: Document = new JSDOM(template).window.document;
        const images = manga || await this._getBooks(this.currentPath());
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

    async ls(): Promise<(MangaLink | Manga)[]> {
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
            const merged: MangaLink[] = result.reduce<Manga[]>((ret, curr: MangaLink[]) => {
                ret.push(...curr);
                return ret;
            }, []);
            return this.instructions.push(() => this._html(merged));
        } catch (ex) {
            console.error(ex);
        }
    }
}
