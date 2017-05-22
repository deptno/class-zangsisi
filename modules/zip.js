"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
