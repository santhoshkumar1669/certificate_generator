class AppConstants {
  static Headers = {
    CodelibSecretKey: 'catalyst-codelib-secret-key'
  }

  static Env = {
    CodelibSecretKey: 'CODELIB_SECRET_KEY',
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
