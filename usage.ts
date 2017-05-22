import Zangsisi from './index';
import {basename, join} from 'path';
import {writeFileSync} from 'fs';
import * as nodeZip from 'node-zip';

export default class Zip {
    private zip = new nodeZip();
    private blob;

    add(filename, buffer) {
        this.zip.file(filename, buffer);
    }
    buffer(): Buffer {
        return this.blob = this.zip.generate({base64:false,compression:'DEFLATE'});
    }
}

enum EList {
    Comics = 1,
    ComicsBook
}

const zangsisi = new Zangsisi();
const ls = zangsisi.ls.bind(zangsisi);
const cd = zangsisi.cd.bind(zangsisi);

async function list(target) {
    cd(target);

    try {
        return await ls();
    } catch (ex) {
        console.error(ex);
    }
}

async function download(target) {
    cd(target);

    const level = target.split('/').filter(x => x).length;
    try {
        const zip = new Zip();
        const list = await ls();

        if (level === EList.Comics) {
            const mapTitle = ({title}) => join('/', target, title);
            const titles = list.map(mapTitle);

            const seqDownload = async book => {
                if (!book) {
                    return;
                }
                console.log(`[download] ${book}`);
                await download(book);
                seqDownload(titles.shift());
            };
            seqDownload(titles.shift());
        } else {
            await Promise.all(list.map(async ({link}) => {
                try {
                    const response = await fetch(encodeURI(link));
                    const buffer = await (response as any).buffer();
                    zip.add(basename(link), buffer);
                } catch(ex) {
                    console.error(`fetch error: ${link}`, ex);
                }
            }));

            writeFileSync(`${basename(target).replace(/\s/g, '_')}.zip`, zip.buffer(), 'binary');
        }
    } catch(ex) {
        console.error(ex);
    }
}

!async function() {
    console.log('[list]');
    console.log('[list] 1 depth', await list('너의 이름은'));
    console.log('[list] 2 depth', await list('/더 파이팅/더 파이팅 100권'));
    // console.log('[download] by comics name');
    // await download('/너의 이름은');
    // console.log('[download] by book');
    // await download('/너의 이름은/너의 이름은 1~2화');
    // await download('/더 파이팅/더 파이팅 100권');
}();
