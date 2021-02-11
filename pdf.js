
"use strict";
const chromium = require("chrome-aws-lambda");
var AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");

AWS.config.update({ region: "us-east-1" });
const s3 = new AWS.S3();

module.exports.pdf = async (event, context, callBack) => {


  //Please construct URL / query string here.

  //https://open.growlibro.com/invoice/569b7b30cfb940e678a4a6aff2ebdb58
  
  const pdfPreviewUrl = 'https://open.growlibro.com/${event.params.querystring.doctype}/${event.params.querystring.uuid}';

  //For local use:
  const data = {
    title: "Ako si Darna!",
    text: "Ang pinakabayot sa tibuok kalibutan"
  }

  const executablePath = event.isOffline
    ? "./node_modules/puppeteer/.local-chromium/mac-674921/chrome-mac/Chromium.app/Contents/MacOS/Chromium"
    : await chromium.executablePath;
  const file = fs.readFileSync(path.resolve(__dirname, "template.hbs"), 'utf8')
  const template = handlebars.compile(file)
  const html = template(data)

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

    // page.setContent(html);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }
    });
    const output_filename = `${new Date().getTime()}`;
    // Response with PDF (or error if something went wrong )
    const response = {
      headers: {
        "Content-type": "application/json",
      },
      statusCode: 200,
      // body: {event, context},
      body: {url: `https://growlibro-pdf.s3.amazonaws.com/public/pdfs/${output_filename}.pdf`},
    // body: JSON.stringify({url: `https://growlibro-pdf.s3.amazonaws.com/public/pdfs/${output_filename}`}),
      isBase64Encoded: false
    };


    // 
    
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

    // context.succeed(response);
    callBack(null, response);

  } catch (error) {
    return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};