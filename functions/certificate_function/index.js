'use strict'
const express = require('express')
const app = express()
app.use(express())
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })
const fs = require('fs')
const catalyst = require('zcatalyst-sdk-node')
const path = require('path')
const os = require('os')
const QRCode = require('qrcode')
const puppeteer = require('puppeteer-core')
const { AuthService } = require('./services')
const { AppError, ErrorHandler } = require('./utils')
const AppConstants = require('./constants')

app.use((req, res, next) => {
  try {
    if (
      !AuthService.getInstance().isValidRequest(
        req.get(AppConstants.Headers.SecretKey)
      )
    ) {
      throw new AppError(
        401,
        "You don't have permission to perform this operation. Kindly contact your administrator for more details."
      )
    }
    next()
  } catch (err) {
    const { statusCode, ...others } = ErrorHandler.getInstance().processError(err)
    res.status(statusCode).send(others)
  }
})

const uploadMiddleware = upload.fields([
  { name: 'htmlFile', maxCount: 1 },
  { name: 'csvFile', maxCount: 1 }
])

app.post('/upload', uploadMiddleware, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError(400, 'No files were uploaded.')
    }
    const { htmlFile, csvFile } = req.files
    if (!htmlFile || !csvFile) {
      throw new AppError(400, 'Missing required files.')
    }
    if (htmlFile[0].mimetype !== 'text/html') {
      throw new AppError(400, 'htmlFile should be a of type html.')
    } if (csvFile[0].mimetype !== 'text/csv') {
      throw new AppError(400, 'csvFile should be a of type csv.')
    }
    const {
      mailSubject,
      mailHtmlMode,
      mailContent,
      mailCc, mailBcc, count, genQrCode
    } = req.body

    if (!mailSubject || !mailHtmlMode || !mailContent || !genQrCode || !count) {
      throw new AppError(400, 'Invalid input value provided. Please provide proper values for email subject, email html mode, email content and QrCode generate flag.')
    }
    const arr = [req.files.htmlFile[0], req.files.csvFile[0]]
    const catalystApp = catalyst.initialize(req)
    const dsData = []

    for (const file of arr) {
      const outputFilePath = path.join(os.tmpdir(), file.originalname)
      fs.writeFileSync(outputFilePath, file.buffer)
      await catalystApp
        .filestore()
        .folder(AppConstants.CatalystComponents.Folder.Templates)
        .uploadFile({
          code: fs.createReadStream(outputFilePath),
          name: file.originalname
        })
        .then((fileObject) => {
          dsData.push(fileObject.id)
        })
        .catch((err) => {
          throw err
        })
    }

    await catalystApp
      .datastore()
      .table(AppConstants.CatalystComponents.Table.TemplateFileDetails)
      .insertRow({
        HtmlFileId: dsData[0],
        CsvFileId: dsData[1],
        mailSubject,
        mailHtmlMode,
        mailContent,
        mailCc,
        mailBcc,
        genQrCode,
        count
      })
      .catch((err) => {
        throw err
      })
    res.status(200).send({ status: 'success', message: 'Details were successfully uploaded. Mail will be sent to the recipients accordingly.' })
  } catch (error) {
    const { statusCode, ...others } = ErrorHandler.getInstance().processError(error)
    res.status(statusCode).send(others)
  }
})

app.get('/certificate', async (req, res) => {
  try {
    const ROWID = req.query.CID
    if (!ROWID) {
      throw new Error('Certificate id has not been passed.')
    }
    const catalystApp = catalyst.initialize(req)
    let FileID = ''
    await catalystApp.datastore().table(AppConstants.CatalystComponents.Table.CertificateMapper).getRow(ROWID).then((resp) => {
      FileID = resp.FileID
    }).catch((err) => {
      throw err
    })
    await catalystApp.filestore().folder(AppConstants.CatalystComponents.Folder.Certificates).getFileStream(FileID).then((fileObject) => {
      res.setHeader('Content-disposition', 'inline; filename="' + ROWID + '.pdf' + '"')
      res.setHeader('Content-type', 'application/pdf')
      res.status(200)
      fileObject.pipe(res)
    }).catch((err) => {
      throw err
    })
  } catch (error) {
    const { statusCode, ...others } = ErrorHandler.getInstance().processError(error)
    res.status(statusCode).send(others)
  }
})

app.post('/preview', upload.single('htmlFile'), async (req, res) => {
  try {
    if (!req.file || Object.keys(req.file).length === 0) {
      throw new AppError(400, 'No file has been uploaded. Please upload the html file for preview.')
    }
    if (req.file.mimetype !== 'text/html') {
      throw new AppError(400, 'File should be a of type html.')
    }
    if (!req.body.rowData) {
      throw new AppError(400, 'Pass the html placeholders as json.')
    }
    const rowData = JSON.parse(req.body.rowData)
    if (!req.body.genQrCode) {
      throw new AppError(400, 'Pass the flag to determine the generation of QR Code.')
    }
    const genQrCode = req.body.genQrCode

    let htmlfileContents = Buffer.from(req.file.buffer).toString('utf-8')
    for (const [placeholder, value] of Object.entries(rowData)) {
      htmlfileContents = htmlfileContents.replace(
        new RegExp(`{{${placeholder}}}`, 'g'),
        value
      )
    }
    if (genQrCode.toLowerCase() === 'true') {
      const qrcodeGenURL = 'https://' + req.headers.host + '/server/certificate_function/certificate?CID='
      let ROWID = 'xxx'
      if (req.body.CID) {
        ROWID = req.body.CID
      }
      const qrCodeData = await QRCode.toDataURL(qrcodeGenURL + ROWID)
      htmlfileContents = htmlfileContents.replace(
        '/{{qrCodeData}}/g',
        qrCodeData
      )
    }
    const browser = await puppeteer.connect({
      browserWSEndpoint: process.env[AppConstants.Env.CDP_END_POINT]
    })
    const page = await browser.newPage()
    await page.setContent(htmlfileContents, { waitUntil: 'domcontentloaded' })
    const pdfBuffer = await page.pdf({ format: 'A4' })
    res.setHeader('Content-disposition', 'inline; filename="' + 'Certificate' + '.pdf' + '"')
    res.setHeader('Content-type', 'application/pdf')
    res.send(pdfBuffer)
    await browser.close()
  } catch (error) {
    const { statusCode, ...others } = ErrorHandler.getInstance().processError(error)
    res.status(statusCode).send(others)
  }
})

app.all('*', function (req, res) {
  res.status(404).send({
    status: 'failure',
    message: "We couldn't find the requested url."
  })
})
module.exports = app
