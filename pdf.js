"use strict";
const chromium = require("chrome-aws-lambda");
var AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

AWS.config.update({ region: "us-east-1" });
const s3 = new AWS.S3();

module.exports.pdf = async (event, context, callBack) => {

  const docType = event.params.querystring.doctype;
  const pdfPreviewUrl = `https://open.growlibro.com/${docType}/${event.params.querystring.uuid}`
  const executablePath = await chromium.executablePath;
  let browser = null;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto(pdfPreviewUrl);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }
    });
    
    const output_filename = `${docType}-${new Date().getTime()}.pdf`;
    const response = {
      headers: {
        "Content-type": "application/json",
      },
      statusCode: 200,
      body: {url: `https://growlibro-pdf.s3.amazonaws.com/public/pdfs/${output_filename}`},
      isBase64Encoded: false
    };

    const s3Params = {
      Bucket: "growlibro-pdf",
      Key: `public/pdfs/${output_filename}`,
      Body: pdf,
      ContentType: "application/pdf",
      ServerSideEncryption: "AES256",
      ACL: 'public-read'
    };

    await s3.putObject(s3Params, err => {
      if (err) {
        console.log("err", err);
        return callBack(null, { error });  
      }
    });

    callBack(null, response);

  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};