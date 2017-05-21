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
