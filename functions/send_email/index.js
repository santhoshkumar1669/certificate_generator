const catalyst = require('zcatalyst-sdk-node')
const csv = require('csv-parser')
const { Readable } = require('stream')
const axios = require('axios')
const FormData = require('form-data')
const AppConstants = require('./constants')
const fs = require('fs')
const path = require('path')
const os = require('os')
module.exports = async (event, context) => {
  try {
    const data = event.data[0] // event data
    const qrcodeGenURL = context.catalystHeaders['x-zc-project-domain'] + '/server/certificate_function/preview'
    const catalystApp = catalyst.initialize(context)
    const folder = catalystApp.filestore().folder(AppConstants.CatalystComponents.Folder.Templates)
    const htmlfileContents = await folder
      .downloadFile(data.HtmlFileId)
      .then((fileObject) => {
        return fileObject
      })
      .catch((err) => {
        throw err
      })

    const csvfileContents = await folder
      .downloadFile(data.CsvFileId)
      .then(async (fileObject) => {
        return await readCSVFromBuffer(fileObject)
          .then((rows) => {
            return rows
          })
          .catch((err) => {
            throw err
          })
      })
      .catch((error) => {
        throw error
      })
    let remainingTime = await context.getRemainingExecutionTimeMs()
    let count = data.count
    const CertificateMapperTable = catalystApp
      .datastore()
      .table(AppConstants.CatalystComponents.Table.CertificateMapper)

    for (let i = count; i < csvfileContents.length; i++) {
      if (remainingTime > 840000) { // Run loop till 14th minute as event function can run upto 15 minutes. After 14th minute, we will trigger next event for further processing.
        const rowData = csvfileContents[i]
        let ROW_ID = ''
        await CertificateMapperTable.insertRow({
          Name: rowData.name,
          Email: rowData.Emailid,
          FileID: ''
        })
          .then((row) => {
            ROW_ID = row.ROWID
          })
          .catch((err) => {
            throw err
          })
        const form = new FormData()
        // Append the HTML buffer
        form.append('htmlFile', htmlfileContents, {
          filename: 'CertificateTemplate.html',
          contentType: 'text/html'
        })
        // Append the JSON object
        form.append('rowData', JSON.stringify(rowData), {
          contentType: 'application/json'
        })
        form.append('genQrCode', data.genQrCode.toString(), {
          contentType: 'text/plain'
        })
        form.append('CID', ROW_ID.toString(), {
          contentType: 'text/plain'
        })
        const headers = form.getHeaders()
        headers[AppConstants.Headers.CodelibSecretKey] = process.env[AppConstants.Env.CodelibSecretKey]

        const response = await axios.post(qrcodeGenURL, form,
          {
            headers,
            responseType: 'arraybuffer'
          }
        ).catch((err) => {
          console.log(err)
        })

        const fileTmpPath = path.join(os.tmpdir(), rowData.name + '.pdf')
        fs.writeFileSync(fileTmpPath, response.data)

        await catalystApp
          .email()
          .sendMail({
            from_email: AppConstants.CatalystComponents.Email.FromEmail,
            to_email: [rowData.Emailid],
            html_mode: data.mailHtmlMode,
            cc: [data.mailCc],
            bcc: [data.mailBcc],
            subject: data.mailSubject,
            content: data.mailContent,
            attachments: [fs.createReadStream(fileTmpPath)] // create a file stream for the file attachment
          })
          .then((mailObject) => {
            console.log('Mail sent to :' + mailObject.to_email)
          })
          .catch((err) => {
            throw err
          })

        await catalystApp
          .filestore()
          .folder(AppConstants.CatalystComponents.Folder.Certificates)
          .uploadFile({
            code: fs.createReadStream(fileTmpPath),
            name: ROW_ID + '.pdf'
          })
          .then(async (fileObject) => {
            await CertificateMapperTable.updateRow({
              FileID: fileObject.id,
              ROWID: ROW_ID
            }).catch((err) => {
              throw err
            })
          })

        fs.unlinkSync(fileTmpPath)
        count++
        console.log('count : ' + count)
        remainingTime = await context.getRemainingExecutionTimeMs()
        console.log('Remaining function execution time: ' + remainingTime)
      } else {
        console.log('trigger next event')
        // update count to trigger next event
        // Use Table Meta Object to update a single row using ROWID which returns a promise
        await catalystApp
          .datastore()
          .table(AppConstants.CatalystComponents.Table.TemplateFileDetails)
          .updateRow({
            count,
            ROWID: data.ROWID
          })
          .then((row) => {
            console.log(row)
          })
          .catch((err) => {
            throw err
          })
        break
      }
    }
    context.closeWithSuccess()
  } catch (error) {
    console.error(error)
    context.closeWithFailure()
  }
}

async function readCSVFromBuffer (buffer) {
  return await new Promise((resolve, reject) => {
    const rows = []
    Readable.from(buffer)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row)
      })
      .on('end', () => {
        console.log('CSV buffer successfully processed.')
        resolve(rows)
      })
      .on('error', (error) => {
        reject(error)
      })
  })
}
