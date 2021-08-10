const net = require("net");
const fs = require("fs");
const Barcode = require("./helpers/barcode");
const FileWrapper = require("./helpers/filewrapper");
const PNG = require("pngjs").PNG;
const rgbaToZ64 = require("zpl-image").rgbaToZ64;
const Printer = require("./printer");

const PRINTER_TYPE = require("./helpers/printerType");
const {
  ZPL_LOGO_REGISTERED_LETTER,
  ZPL_LOGO_PAC,
  ZPL_LOGO_SEDEX,
  ZPL_LOGO_SEDEX_10,
} = require("./logos/logos");

module.exports = class CorreiosZPL {
  async printLabel(obj) {
    if (!obj || !obj.options || !obj.label) {
      throw new Error(
        "O parâmetro necessário não foi repassado corretamente, por favor revise as instruções."
      );
    }

    const zplCode = this.zplCode(obj);

    return this.print(obj.options, zplCode);
  }

  zplCode(obj) {
    if (!obj || !obj.label) {
      throw new Error(
        "O parâmetro necessário não foi repassado corretamente, por favor revise as instruções."
      );
    }

    const options = obj.options;
    const label = this.prepareFields(obj.label);

    options.workDir = options.workDir || "./tmp";
    options.darknessLevel = options.darknessLevel || 20;

    let mailLogo = ZPL_LOGO_PAC;
    const zplQRCode = this.generateZplQrCode(obj);

    if (label.serviceName.toUpperCase().includes("CARTA")) {
      mailLogo = ZPL_LOGO_REGISTERED_LETTER;
    } else if (
      label.serviceName.toUpperCase().includes("SEDEX 10") ||
      label.serviceName.toUpperCase().includes("SEDEX 12") ||
      label.serviceName.toUpperCase().includes("HOJE")
    ) {
      mailLogo = ZPL_LOGO_SEDEX_10;
    } else if (label.serviceName.toUpperCase().includes("SEDEX")) {
      mailLogo = ZPL_LOGO_SEDEX;
    }

    const customLogo =
      options.customLogoZpl && options.customLogoZpl.startsWith("^GF")
        ? options.customLogoZpl
        : "";

    const zplCode = `^XA
        ^CI28
        ^MD${options.darknessLevel}
        
        ${customLogo === "" ? "" : "^FO40,50" + customLogo + "^FS"}
        
        ^FO305,50${zplQRCode}^FS
        
        ^FO620,50${mailLogo}^FS
        
        ^CF0,40
        ^FO245,342^A@N,0,40,E:ARI001.FNT^FD${label.humanTrackNumber}^FS
        
        ${
          label.weight && label.weight > 0
            ? "^CF0,20^FO50,340^FDPeso (g): " + label.weight + "^FS"
            : ""
        }
        
        ${
          label.invoice && label.invoice !== ""
            ? "^CF0,20^FO610,340^FDNF: " + label.invoice + "^FS"
            : ""
        }
          
        ${
          label.plp && label.plp !== ""
            ? "^FO610,250^A@N,0,16,E:ARI000.FNT^FDPLP: " + label.plp + "^FS"
            : ""
        }
        ${
          label.contract && label.contract !== ""
            ? "^FO610,270^A@N,0,16,E:ARI000.FNT^FDContrato: " +
              label.contract +
              "^FS"
            : ""
        }
        ${
          label.serviceName && label.serviceName !== ""
            ? "^FO610,290^A@N,0,16,E:ARI000.FNT^FDServiço: " +
              label.serviceName +
              "^FS"
            : ""
        }
        
        ^BY4,2,160
        ^FO50,385^BC^FD${label.trackNumber}^FS
        
        ^CF0,20
        ^FO50,600^FDRecebedor:^FS
        ^FO150,615^GB615,1,1^FS
        
        ^FO50,620^FDAssinatura:^FS
        ^FO150,635^GB335,1,1^FS
        
        ^FO500,620^FDDocumento:^FS
        ^FO600,635^GB165,1,1^FS
        
        
        ^FO50,640^GB715,550,3^FS
        ^FO50,1090^GB715,100,3^FS
        
        ^CF0,25
        ^FO56,650^A@N,0,25,E:ARI001.FNT^FDDestinatário:^FS
        ^FO210,650^A@N,0,25,E:ARI000.FNT^FD${label.recipient.name}^FS
        ${
          label.recipient.careOf !== ""
            ? "^FO56,675^A@N,0,25,E:ARI000.FNT^FDA/C: " +
              label.recipient.careOf +
              "^FS"
            : ""
        }
        ^FO56,700^A@N,0,25,E:ARI000.FNT^FD${
          label.recipient.address + ", " + label.recipient.addressNumber
        }^FS
        ^FO56,725^A@N,0,25,E:ARI000.FNT^FD${
          (label.recipient.complement !== ""
            ? label.recipient.complement + " - "
            : "") + label.recipient.neighborhood
        }^FS
        ^FO56,750^A@N,0,25,E:ARI001.FNT^FD${label.recipient.zipCode}^FS
        ^FO190,750^A@N,0,25,E:ARI000.FNT^FD${
          label.recipient.city + "/" + label.recipient.state
        }^FS
        ^FO56,775^A@N,0,25,E:ARI000.FNT^FDOBS: ${label.remarks}^FS
        
        ^BY2,2,160
        ^FO450,900^BC^FD${label.recipient.zipCode}^FS
        
        ^CF0,15
        ^FO56,1100^A@N,0,20,E:ARI000.FNT^FDRemetente: ${label.sender.name}^FS
        ^FO56,1125^A@N,0,20,E:ARI000.FNT^FD${
          label.sender.address +
          ", " +
          label.sender.addressNumber +
          (label.sender.complement !== "" ? ", " + label.sender.complement : "")
        }^FS
        ^FO56,1150^A@N,0,20,E:ARI000.FNT^FD${
          label.sender.zipCode +
          " - " +
          label.sender.city +
          "/" +
          label.sender.state
        }^FS
        
        ^XZ`;

    return zplCode;
  }

  print(options, zplCode) {
    if (
      options.printerType &&
      options.printerType === PRINTER_TYPE.NETWORK_PRINTER
    ) {
      if (!options.printerAddress) {
        throw new Error(
          "O endereço da impressora não foi informado, por favor reveja as instruções."
        );
      }

      options.printerPort = options.printerPort || 9100;
      options.timeout = options.timeout || 30000;

      return new Promise(async (resolve, reject) => {
        var printer = await net.connect({
          host: options.printerAddress,
          port: options.printerPort,
          timeout: options.timeout,
        });

        printer.write(Buffer.from(zplCode), null, function () {
          resolve("Dados enviados para a impressora");
          printer.destroy();
        });

        printer.on("error", function (error) {
          resolve(false);
          printer.destroy();
          throw new Error("Erro de conexão com a impressora: ", error);
        });

        printer.on("timeout", function () {
          resolve(false);
          printer.destroy();
          throw new Error("Timeout durante a conexão com a impressora: ");
        });
      });
    } else {
      if (!options.printerName) {
        throw new Error(
          "O nome da impressora não foi informado. Reveja as instruções de uso."
        );
      }

      try {
        const printers = Printer.list();
        let printerFound = false;

        if (!printers) {
          throw new Error(
            "Não foi possível ler a lista de impressoras instaladas."
          );
        }

        printers.map((printer) => {
          if (printer === options.printerName) {
            printerFound = true;
          }
        });

        if (!printerFound) {
          throw new Error("A impressoa informada não está instalada.");
        }

        const printer = new Printer(options.printerName);

        return printer.printRaw(zplCode);
      } catch (err) {
        throw new Error(err);
      }
    }
  }

  generateZplQrCode(obj) {
    let qrFile = "";
    try {
      qrFile = FileWrapper.randomFileNames(obj.options.workDir, 10, ".png");
      const qrCodeFile = Barcode.generateQRCodeFile(
        obj.options.workDir + "/" + qrFile,
        this.makeQRString(obj.label)
      );

      let buf = fs.readFileSync(obj.options.workDir + "/" + qrFile);
      let png = PNG.sync.read(buf);
      let res = rgbaToZ64(png.data, png.width, { black: 53 });

      return `^GFA,${res.length},${res.length},${res.rowlen},${res.z64}`;
    } catch (err) {
      throw new Error(err.message);
    } finally {
      FileWrapper.removeFile(obj.options.workDir + "/" + qrFile);
    }
  }

  makeQRString(label) {
    label.recipient.phone = label.recipient.phone.padStart(12, "0");

    return (
      label.recipient.zipCode +
      label.recipient.zipCodeComplement +
      label.sender.zipCode +
      label.sender.zipCodeComplement +
      label.recipient.zipCodeValidator +
      label.idv +
      label.trackNumber +
      label.extraServices +
      label.postCard +
      label.serviceCode +
      label.group +
      label.recipient.zipCodeComplement +
      label.recipient.complement +
      label.invoiceValue +
      label.recipient.phone +
      label.latitude +
      label.longitude +
      "|"
    );
  }

  zipCodeVD(zipCode) {
    let sum = 0;

    for (let i = 0; i < zipCode.length; i++) {
      if (zipCode.substring(i, i + 1) != "-") {
        sum = sum + parseInt(zipCode.substring(i, i + 1));
      }
    }

    if (sum % 10 != 0) {
      let sumd = sum;
      while (sumd % 10 != 0) {
        sumd++;
      }

      return (sumd - sum).toString();
    } else {
      return "0";
    }
  }

  prepareFields(label) {
    if (!label) {
      throw new Error(
        "Nenhuma informação repassada para a geração da etiqueta."
      );
    } else if (!label.recipient) {
      throw new Error("Os dados do destinatário não foram informados.");
    } else if (!label.sender) {
      throw new Error("Os dados do remetente não foram informados.");
    } else {
      // Prepara os campos de acordo com o padrão dos correios
      label.recipient.careOf = label.recipient.careOf
        ? label.recipient.careOf
        : "";
      label.sender.name = label.sender.name ? label.sender.name : "";
      label.sender.address = label.sender.address ? label.sender.address : "";
      label.sender.addressNumber = label.sender.addressNumber
        ? label.sender.addressNumber
        : "";
      label.sender.complement = label.sender.complement
        ? label.sender.complement
        : "";
      label.sender.neighborhood = label.sender.neighborhood
        ? label.sender.neighborhood
        : "";
      label.sender.city = label.sender.city ? label.sender.city : "";
      label.sender.state = label.sender.state ? label.sender.state : "";
      label.sender.zipCode = label.sender.zipCode
        ? label.sender.zipCode
        : "00000000";
      label.sender.zipCodeComplement = (!label.sender.addressNumber
        ? ""
        : typeof label.sender.addressNumber == "number"
        ? label.sender.addressNumber.toString()
        : label.sender.addressNumber
      ).padStart(5, "0");
      label.recipient.address = label.recipient.address
        ? label.recipient.address
        : "";
      label.recipient.addressNumber = label.recipient.addressNumber
        ? label.recipient.addressNumber
        : "";
      label.recipient.complement = label.recipient.complement
        ? label.recipient.complement.trim()
        : "";
      label.recipient.neighborhood = label.recipient.neighborhood
        ? label.recipient.neighborhood
        : "";
      label.recipient.city = label.recipient.city ? label.recipient.city : "";
      label.recipient.state = label.recipient.state
        ? label.recipient.state
        : "";
      label.recipient.zipCode = !label.recipient.zipCode
        ? "00000000"
        : label.recipient.zipCode;
      label.recipient.zipCodeComplement = (!label.recipient.addressNumber
        ? ""
        : typeof label.recipient.addressNumber == "number"
        ? label.recipient.addressNumber.toString()
        : label.recipient.addressNumber
      ).padStart(5, "0");
      label.recipient.phone = label.recipient.phone
        ? label.recipient.phone
        : "";
      label.serviceCode = label.serviceCode ? label.serviceCode : "";
      label.serviceName = label.serviceName ? label.serviceName : "";
      label.invoice = label.invoice ? label.invoice : "";
      label.weight = label.weight ? label.weight : 0;
      label.invoiceValue = label.invoiceValue ? label.invoiceValue : 0;
      label.remarks = label.remarks ? label.remarks : "";

      if (label.recipient.address.length > 50) {
        label.recipient.address = label.recipient.Address.substring(0, 50);
      }

      if (label.recipient.complement.length > 20) {
        label.recipient.complement = label.recipient.complement.substring(
          0,
          20
        );
      }

      if (label.recipient.neighborhood.length > 50) {
        label.recipient.neighborhood = label.recipient.neighborhood.substring(
          0,
          50
        );
      }

      if (label.recipient.city.length > 50) {
        label.recipient.city = label.recipient.city.substring(0, 50);
      }

      if (!label.sender.zipCode.includes("-")) {
        label.sender.zipCode =
          label.sender.zipCode.substring(0, 5) +
          "-" +
          label.sender.zipCode.substring(5, 8);
      }

      if (!label.recipient.zipCode.includes("-")) {
        label.recipient.zipCode =
          label.recipient.zipCode.substring(0, 5) +
          "-" +
          label.recipient.zipCode.substring(5, 8);
      }

      if (typeof label.invoiceValue == "number") {
        label.invoiceValue = Number(
          label.invoiceValue.toFixed(0).toString().padStart(5, "0")
        );
      } else {
        if (label.invoiceValue.includes(".")) {
          label.invoiceValue = label.invoiceValue.substring(
            0,
            label.invoiceValue.indexOf(".")
          );
        }
        label.invoiceValue = label.invoiceValue.padStart(5, "0");
      }

      label.humanTrackNumber =
        label.trackNumber.substring(0, 2) +
        " " +
        label.trackNumber.substring(2, 5) +
        " " +
        label.trackNumber.substring(5, 8) +
        " " +
        label.trackNumber.substring(8, 11) +
        " " +
        label.trackNumber.substring(11, 13);

      label.recipient.zipCodeValidator = this.zipCodeVD(
        label.recipient.zipCode
      );

      label.idv = "51";
      label.group = "00";
      label.extraServices =
        "25" +
        (label.services.receiptNotice ? "01" : "00") +
        (label.services.inHands ? "02" : "00") +
        (label.services.declaredValue ? "64" : "00") +
        (label.services.neighborDelivery ? "11" : "00") +
        (label.services.largeFormats ? "57" : "00");

      label.latitude = "-00.000000";
      label.longitude = "-00.000000";

      return label;
    }
  }

  convertPngToZplImage(file) {
    try {
      let buf = fs.readFileSync(file);
      let png = PNG.sync.read(buf);
      let res = rgbaToZ64(png.data, png.width, { black: 53 });

      this.options.customLogo = `^GFA,${res.length},${res.length},${res.rowlen},${res.z64}`;
    } catch (err) {
      throw new Error(err.message);
    }
  }
};
