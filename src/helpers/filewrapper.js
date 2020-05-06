const fs = require('fs');

module.exports = class FileWrapper {
  static ensureExists(path, mask, cb) {
    if (typeof mask == 'function') {
      cb = mask;
      mask = '0777';
    }

    fs.mkdir(path, mask, function(err) {
      if (err) {
        if (err.code == 'EEXIST') {
          cb(null);
        } else {
          cb(err);
        }
      } else {
        cb(null);
      }
    });
  }

  static randomFileNames(directory, digits, extension) {
    let result = '';

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }

    if (directory.substring(directory.length) != '/') {
      directory += '/';
    }

    if (extension.length > 1 && extension.substring(0, 1) != '.') {
      extension = '.' + extension;
    }

    while (true) {
      const name = this.randomNames(digits) + extension;

      if (!fs.existsSync(directory + name)) {
        result = name;
        break;
      }
    }

    return result;
  }

  static randomNames(digits) {
    const characters =
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';

    for (let i = 0; i < digits; i++) {
      const position = Math.floor(Math.random() * characters.length + 1);
      result += characters.substring(position - 1, position);
    }

    return result;
  }

  static removeFile(file) {
    try {
      fs.unlinkSync(file);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }
};
