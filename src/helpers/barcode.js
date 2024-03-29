const bwipjs = require('bwip-js'); // Barcode and QRCode
const fs = require('fs');

module.exports = class Barcode {
  static async generateQRCode(text, backgroundColor = 'FFFFFF') {
    let base64;

    base64 = await new Promise((resolve, reject) => { 
      bwipjs.toBuffer(
        {
          bcid: 'datamatrix',
          text: text,
          backgroundcolor: backgroundColor,
          scale: 4,
        },
        function(err, png) {
          if (err) {
            resolve('');
          } else {
            resolve(png.toString('base64'));
          }
        }
      );
    });

    return base64;
  }

  static async generateBarcode(
    text,
    type,
    height,
    width,
    showText,
    backgroundColor = 'FFFFFF'
  ) {
    let base64;

    base64 = await new Promise((resolve, reject) => { 
      bwipjs.toBuffer(
        {
          bcid: type,
          text: text,
          scale: 3,
          height: height,
          width: width,
          includetext: showText,
          textxalign: 'center',
          backgroundcolor: backgroundColor,
        },
        function(err, png) {
          if (err) {
            resolve('');
          } else {
            resolve(png.toString('base64'));
          }
        }
      );
    });

    return base64;
  }

  static async generateQRCodeFile(file, text, backgroundColor = 'FFFFFF') {
    try {
      fs.writeFileSync(
        file,
        await this.generateQRCode(text, backgroundColor),
        'base64'
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  static generateBarcodeFile(
    file,
    text,
    type,
    height,
    width,
    showText,
    backgroundColor = 'FFFFFF'
  ) {
    try {
      fs.writeFileSync(
        file,
        this.generateBarcode(
          text,
          type,
          height,
          width,
          showText,
          backgroundColor
        ),
        'base64'
      );
      return true;
    } catch (err) {
      return false;
    }
  }
};
