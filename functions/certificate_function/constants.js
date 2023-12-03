class AppConstants {
  static Headers = {
    SecretKey: 'secret-key'
  }

  static Env = {
    SecretKey: 'SECRET_KEY',
    CDP_END_POINT: 'CDP_END_POINT'
  }

  static CatalystComponents = {
    Folder: {
      Templates: 'Templates',
      Certificates: 'Certificates'

    },
    Table: {
      TemplateFileDetails: 'TemplateFileDetails',
      CertificateMapper: 'CertificateMapper'
    }
  }
}

module.exports = AppConstants
