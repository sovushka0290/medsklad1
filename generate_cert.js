const forge = require('node-forge');
const pki = forge.pki;
const keys = pki.rsa.generateKeyPair(2048);
const cert = pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
const attrs = [
  {name: 'commonName', value: 'localhost'},
  {name: 'countryName', value: 'KZ'},
  {shortName: 'ST', value: 'Almaty'},
  {name: 'localityName', value: 'Almaty'},
  {name: 'organizationName', value: 'MedSklad'},
  {shortName: 'OU', value: 'IT'}
];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);
const pemCert = pki.certificateToPem(cert);
const pemKey = pki.privateKeyToPem(keys.privateKey);
const fs = require('fs');
if (!fs.existsSync('./ssl')) fs.mkdirSync('./ssl');
fs.writeFileSync('./ssl/server.crt', pemCert);
fs.writeFileSync('./ssl/server.key', pemKey);
console.log('Certs generated successfully in ./ssl/');
