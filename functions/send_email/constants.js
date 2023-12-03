class AppConstants {
  static Headers = {
    SecretKey: 'secret-key'
  }

  static Env = {
    SecretKey: 'SECRET_KEY'
  }

  static CatalystComponents = {
    Folder: {
      Templates: 'Templates',
      Certificates: 'Certificates'

    },
    Table: {
      TemplateFileDetails: 'TemplateFileDetails',
      CertificateMapper: 'CertificateMapper'
    },
    Email: {
      FromEmail: 'xxx@abc.com'
    }
  }
}

module.exports = AppConstants
