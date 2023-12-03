# Certificate Generator

This is a microservice which can be used to generate certificates and distribute to the recipients through email. The certificates can also be verified online; ensuring the authenticity.

This project contains two Zoho catalyst functions.

1. certificate_function
2. send_email

certificate_function :

1. POST /upload - User can leverage this API to upload the HTML template with placeholders, and a CSV dataset with the placeholder's value and email-id's.
2. GET /certificate endpoint - User can validate their certificate online by using the certificate id.
3. POST /preview endpoint - User can leverage this API to generate certificates.

send_email function :

1. This function is triggered automatically by the Catalyst event listeners on the event of a table insert to initate the process of certificate generations and send the email to the recipients by iterating through the CSV dataset.
